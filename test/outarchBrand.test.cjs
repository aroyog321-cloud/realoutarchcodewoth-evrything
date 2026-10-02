"use strict";

// The app is OUTARCH: its logo is where the old "MC" marks were, and no
// surface a person reads still says Mission Control. Identifiers that other
// programs and saved data depend on (mission-control:* channels and storage
// keys, the MCP server key, the VS Code extension id) are deliberately kept.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const renderer = path.join(root, "src/groundstation/renderer");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");

function walk(directory, keep) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(full, keep);
    return keep(full) ? [full] : [];
  });
}

test("the renderer's brand component ships the vector marks with the product name", () => {
  const brand = read("src/groundstation/renderer/BrandMark.jsx");
  // The bitmap sources' glitch slices turned to noise at sidebar size, so the
  // renderer draws the logo as vectors (scripts/brand/build-vector-marks.cjs).
  for (const image of ["outarch-mark.svg", "outarch-wordmark-sm.svg", "outarch-wordmark.svg"]) {
    assert.match(brand, new RegExp(`from "\\./brand/${image.replace(".", "\\.")}"`));
    const file = path.join(renderer, "brand", image);
    assert.ok(fs.existsSync(file), `${image} is missing`);
    assert.ok(fs.readFileSync(file, "utf8").startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="'), `${image} is not an SVG`);
    assert.match(fs.readFileSync(file, "utf8"), /role="img" aria-label="OUTARCH"/);
  }
  assert.doesNotMatch(brand, /\.png"/, "the renderer's logo is never a bitmap");
  assert.ok(fs.existsSync(path.join(root, "scripts/brand/build-vector-marks.cjs")));
  // The favicon is still the built bitmap icon.
  assert.equal(fs.readFileSync(path.join(renderer, "brand", "outarch-icon.png")).subarray(1, 4).toString("latin1"), "PNG");
  assert.match(brand, /export const PRODUCT_NAME = "OUTARCH";/);
  // The wordmark is the name, so it is always announced; the icon is decoration.
  assert.match(brand, /export function BrandWordmark[\s\S]{0,300}alt=\{PRODUCT_NAME\}/);
  assert.match(brand, /export function BrandIcon[\s\S]{0,300}aria-hidden=\{label \? undefined : "true"\}/);
  assert.match(brand, /typeof __OUTARCH_VERSION__ === "string"/);
  assert.match(read("vite.groundstation.config.mjs"), /__OUTARCH_VERSION__: JSON\.stringify\(packageVersion\)/);
});

test("the logo replaces every MC mark: sidebar, first workspace, About and the boot screen", () => {
  const app = read("src/groundstation/renderer/App.jsx");
  assert.match(app, /import \{ BrandIcon, BrandWordmark, PRODUCT_NAME, PRODUCT_VERSION \} from "\.\/BrandMark\.jsx";/);
  assert.match(app, /<button className="top-brand" onClick=\{\(\) => onNavigate\("groundstation"\)\} aria-label="Open Groundstation"><BrandIcon\/><\/button><div><strong><BrandWordmark\/><\/strong><small>Developer cockpit<\/small><\/div>/);
  assert.match(app, /<BrandIcon large className="groundstation-onboarding__brand"\/>/);
  assert.match(app, /<div className="about-brand"><BrandIcon large\/><div><BrandWordmark\/>/);
  assert.match(app, /<span>Application<\/span><strong>\{PRODUCT_NAME\}/);
  assert.match(app, /<div className="boot-screen" role="status"><BrandWordmark large className="boot-wordmark"\/>/);
  assert.match(app, /<div className="boot-screen boot-error" role="alert"><BrandWordmark large className="boot-wordmark"\/>/);
  assert.doesNotMatch(app, />MC</, "no text MC mark is left");

  const html = read("src/groundstation/renderer/index.html");
  assert.match(html, /<title>OUTARCH<\/title>/);
  assert.match(html, /<link rel="icon" type="image\/png" href="\.\/brand\/outarch-icon\.png" \/>/);

  const styles = read("src/groundstation/renderer/styles.css");
  assert.match(styles, /\.boot-screen \{[^}]*font-size: 13px; \}/, "the first frame's text is readable");
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\) \{ \.boot-progress i \{[^}]*animation: none; \} \}/);
  const surfaces = read("src/groundstation/renderer/redesign/surfaces.css");
  assert.match(surfaces, /#root#root \.shell \.top-brand \.brand-icon \{ width: 32px; height: 32px; \}/);
  // The tile is the icon's own; the button paints no face.
  assert.match(read("src/groundstation/renderer/redesign/cockpit.css"), /#root#root \.shell \.top-brand \{\n  color: inherit !important;\n  background: transparent !important;\n  border: 0 !important;/);
});

test("no surface a person reads still says Mission Control", () => {
  const sources = [
    ...walk(path.join(root, "src"), file => /\.(?:jsx?|cjs|css|html)$/.test(file)),
    path.join(root, "bin/termctl.js"),
    path.join(root, "integrations/vscode/extension.cjs"),
    path.join(root, "integrations/vscode/package.json"),
    path.join(root, "mobile/android/app/src/main/AndroidManifest.xml"),
    ...walk(path.join(root, "mobile/android/app/src/main/java"), file => file.endsWith(".java"))
  ];
  const offenders = sources.filter(file => /Mission Control|MISSION CONTROL|MC Companion/.test(fs.readFileSync(file, "utf8")));
  assert.deepEqual(offenders.map(file => path.relative(root, file)), []);
});

test("the identifiers saved data and other tools depend on are unchanged", () => {
  const app = read("src/groundstation/renderer/App.jsx");
  assert.match(app, /mission-control\.command-recents\.v1/);
  assert.match(read("src/groundstation/preload/index.cjs"), /const REQUEST_CHANNEL = "mission-control:request";/);
  const manifest = JSON.parse(read("integrations/vscode/package.json"));
  assert.equal(`${manifest.publisher}.${manifest.name}`, "mission-control.bridge");
  assert.equal(manifest.displayName, "OUTARCH Bridge");
  assert.equal(manifest.icon, "media/outarch.png");
  assert.ok(fs.existsSync(path.join(root, "integrations/vscode", manifest.icon)));
  assert.match(read("src/service/mcpGateway.cjs"), /mission-control:\/\/context\/current/);
  assert.match(read("mobile/android/app/build.gradle.kts"), /dev\.missioncontrol\.companion/);
});

test("the Android app launches with the OUTARCH icon at every density", () => {
  const manifest = read("mobile/android/app/src/main/AndroidManifest.xml");
  assert.match(manifest, /android:label="OUTARCH" android:icon="@mipmap\/ic_launcher" android:roundIcon="@mipmap\/ic_launcher_round"/);
  for (const [density, size] of [["mdpi", 48], ["hdpi", 72], ["xhdpi", 96], ["xxhdpi", 144], ["xxxhdpi", 192]]) {
    for (const name of ["ic_launcher.png", "ic_launcher_round.png"]) {
      const png = fs.readFileSync(path.join(root, "mobile/android/app/src/main/res", `mipmap-${density}`, name));
      assert.equal(png.readUInt32BE(16), size, `${density}/${name} width`);
      assert.equal(png.readUInt32BE(20), size, `${density}/${name} height`);
    }
  }
});

test("the phone companion installs with the OUTARCH icon and serves it as an image", async t => {
  const { getMobileManifestJson, getMobileServiceWorkerJs, getMobileWebCompanionHtml } = require("../src/service/mobileWebCompanion.cjs");
  const manifest = JSON.parse(getMobileManifestJson());
  assert.equal(manifest.short_name, "OUTARCH");
  assert.deepEqual([...new Set(manifest.icons.map(icon => icon.src))], ["/mobile/icon-192.png", "/mobile/icon-512.png"]);
  assert.ok(manifest.icons.every(icon => icon.type === "image/png"));
  assert.deepEqual([...new Set(manifest.icons.map(icon => icon.purpose))].sort(), ["any", "maskable"]);
  const html = getMobileWebCompanionHtml();
  assert.match(html, /<link rel="apple-touch-icon" href="\/mobile\/apple-touch-icon\.png">/);
  assert.match(html, /<img class="brand-mark" src="\/mobile\/icon-192\.png" alt="" width="38" height="38">/);
  assert.match(html, /<strong id="headerTitle">OUTARCH<\/strong>/);
  // The number changes whenever the page does, so phones fetch the new one; the test pins the shape.
  assert.match(getMobileServiceWorkerJs(), /const CACHE_NAME = "outarch-companion-v\d+";/);

  const { MobileCompanionStore } = require("../src/service/mobileCompanionStore.cjs");
  const { MobileCompanionGateway } = require("../src/service/mobileCompanion.cjs");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "outarch-mobile-brand-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const safeStorage = { isEncryptionAvailable: () => true, getSelectedStorageBackend: () => "dpapi", encryptString: value => Buffer.from(`p:${value}`), decryptString: value => value.toString().slice(2) };
  const store = new MobileCompanionStore(path.join(directory, "mobile.json"), { safeStorage });
  store.configure({ enabled: true });
  let handle = null;
  const http = {
    createServer(handler) {
      handle = handler;
      return { once() {}, listen(port, host, ready) { this.listening = true; ready(); }, address: () => ({ port: 37422 }), close: done => done() };
    }
  };
  const gateway = new MobileCompanionGateway({ store, http, missionContext: { snapshot: () => ({}) }, getEngineApi: () => ({ getWorkspace: () => ({ persistent: true, path: "/p", name: "P" }) }) });
  await gateway.start();
  t.after(() => gateway.stop());
  const get = url => new Promise(resolve => {
    const response = { headers: {}, setHeader() {}, writeHead(status, headers) { this.status = status; this.headers = headers; }, end(body) { this.body = body; resolve(this); } };
    handle({ method: "GET", url, headers: {}, socket: {} }, response);
  });
  for (const [url, size] of [["/mobile/icon-192.png", 192], ["/mobile/icon-512.png", 512], ["/mobile/apple-touch-icon.png", 180]]) {
    const response = await get(url);
    assert.equal(response.status, 200, url);
    assert.equal(response.headers["Content-Type"], "image/png");
    assert.equal(response.headers["X-Content-Type-Options"], "nosniff");
    assert.equal(response.body.readUInt32BE(16), size, `${url} is ${size}px`);
  }
});

test("the MCP gateway's page wears the OUTARCH icon and the app's palette", () => {
  const source = read("src/service/mcpGateway.cjs");
  assert.match(source, /fs\.readFileSync\(BRAND_ASSETS\.iconPng128\)/);
  assert.match(source, /<img class="logo" src="\$\{brandIconUrl\(\)\}" alt="">/);
  assert.match(source, /--bg: #000000;/);
  assert.doesNotMatch(source, /--accent: #4ade80;/);
});
