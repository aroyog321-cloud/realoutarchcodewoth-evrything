"use strict";

// OUTARCH ships through the Microsoft Store as an MSIX package. Inside the
// package the Store owns updates, the package owns the app's identity and the
// outarch:// link, and the manifest must carry exactly what Partner Center
// reserved. These tests lock those rules.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { resolveDistribution, storeLaunchDirectory, STORE_DISTRIBUTION } = require("../src/groundstation/main/distribution.cjs");
const { UpdateService, UPDATE_MANAGERS } = require("../src/service/updateService.cjs");
const {
  PLACEHOLDER_IDENTITY_NAME,
  PLACEHOLDER_PUBLISHER,
  TEST_PUBLISHER,
  buildAppxManifest,
  msixVersion,
  validateStoreConfig
} = require("../scripts/msix/manifest.cjs");

const root = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");
const storeConfig = JSON.parse(read("packaging/msix/store.config.json"));
const reserved = { ...storeConfig, identityName: "12345OUTARCH.OUTARCH", publisher: "CN=1A2B3C4D-0000-4000-8000-123456789ABC" };

test("a Store package is recognised by its package.json, by Windows, or by the development override", () => {
  assert.equal(resolveDistribution({ packageJson: { outarchDistribution: STORE_DISTRIBUTION }, windowsStore: undefined, env: {} }).store, true);
  assert.equal(resolveDistribution({ packageJson: {}, windowsStore: true, env: {} }).store, true);
  assert.equal(resolveDistribution({ packageJson: {}, windowsStore: undefined, env: { OUTARCH_DISTRIBUTION: "microsoft-store" } }).store, true);
  const folder = resolveDistribution({ packageJson: { version: "2.19.0" }, windowsStore: undefined, env: {} });
  assert.equal(folder.store, false);
  assert.equal(folder.kind, "folder");
  // The checkout's own package.json never claims to be the Store build.
  assert.equal(JSON.parse(read("package.json")).outarchDistribution, undefined);
});

test("a Store launch from System32 or the install folder starts in the home folder; a real folder is kept", () => {
  const env = { SystemRoot: "C:\\WINDOWS" };
  const home = "C:\\Users\\dev";
  const executable = "C:\\Program Files\\WindowsApps\\OUTARCH_2.19.0.0_x64__abc\\OUTARCH.exe";
  assert.equal(storeLaunchDirectory({ cwd: "C:\\Windows\\System32", home, executable, env }), home);
  assert.equal(storeLaunchDirectory({ cwd: "C:\\Program Files\\WindowsApps\\OUTARCH_2.19.0.0_x64__abc", home, executable, env }), home);
  assert.equal(storeLaunchDirectory({ cwd: "D:\\work\\installed\\x64", home, executable: "D:\\work\\installed\\x64\\OUTARCH.exe", env }), home);
  assert.equal(storeLaunchDirectory({ cwd: "D:\\projects\\api", home, executable, env }), null);
  assert.equal(storeLaunchDirectory({ cwd: "C:\\Windows-projects", home, executable, env }), null, "a sibling folder with a similar name is not System32");
});

test("the main process hands identity, the link and updates to the package when it is the Store build", () => {
  const main = read("src/groundstation/main/index.cjs");
  assert.match(main, /const DISTRIBUTION = resolveDistribution\(\{ packageJson: require\("\.\.\/\.\.\/\.\.\/package\.json"\) \}\);/);
  assert.match(main, /if \(!DISTRIBUTION\.store\) \{\n  if \(process\.platform === "win32"\) app\.setAppUserModelId\(APP_USER_MODEL_ID\);\n\}/);
  assert.match(main, /function registerDeepLinkProtocol\(\) \{[\s\S]{0,200}if \(DISTRIBUTION\.store\) return;/);
  assert.match(main, /managedBy: DISTRIBUTION\.store \? STORE_DISTRIBUTION : null/);
  assert.match(main, /!DISTRIBUTION\.store\) void registerWindowsAppIdentity\(/);
  // The working folder is settled before the launch options are read.
  assert.ok(main.indexOf("process.chdir(launchDirectory)") < main.indexOf("options = parseGroundstationArgs(argv);"));
});

test("a Store-managed updater never checks, downloads or installs, and says who updates it", async () => {
  let queried = false;
  const service = new UpdateService({
    rest: { select: async () => { queried = true; return []; } },
    currentVersion: "2.19.0",
    publicKey: "unused",
    managedBy: "microsoft-store",
    fetch: async () => { throw new Error("no network"); }
  });
  service.start();
  const status = await service.check();
  assert.equal(queried, false);
  assert.equal(status.state, "managed");
  assert.equal(status.managedBy, "microsoft-store");
  assert.equal(status.canInstall, false);
  assert.equal(status.available, null);
  assert.equal(status.installBlockedReason, UPDATE_MANAGERS["microsoft-store"]);
  await assert.rejects(service.download(), /Microsoft Store/);
  await assert.rejects(service.install({ quit: () => assert.fail("must not quit") }), /Microsoft Store/);
  service.dispose();
  // An unknown manager is ignored: the folder build keeps its own updater.
  const folder = new UpdateService({ rest: { select: async () => [] }, currentVersion: "2.19.0", publicKey: "unused", managedBy: "somebody" });
  assert.equal(folder.managedBy, null);
  assert.notEqual(folder.status().state, "managed");
});

test("the Updates panel shows the Store line instead of update buttons", () => {
  const panel = read("src/groundstation/renderer/AccountSettings.jsx");
  assert.match(panel, /const managed = state === "managed";/);
  assert.match(panel, /\{managed \? null : <div className="update-panel__actions">/);
});

test("MSIX versions are the package version plus a zero revision", () => {
  assert.equal(msixVersion("2.19.0"), "2.19.0.0");
  assert.equal(msixVersion("3.0.12-beta.1"), "3.0.12.0");
  assert.throws(() => msixVersion("2.19"), /major\.minor\.patch/);
  assert.throws(() => msixVersion("0.9.0"), /major version/);
  assert.throws(() => msixVersion("1.70000.0"), /65535/);
});

test("a Store build refuses the placeholder and test identities; a test build accepts them", () => {
  const placeholderConfig = { ...storeConfig, identityName: PLACEHOLDER_IDENTITY_NAME, publisher: PLACEHOLDER_PUBLISHER };
  const strict = validateStoreConfig(placeholderConfig, { strict: true });
  assert.ok(strict.some(problem => /identityName is still the placeholder/.test(problem)));
  assert.ok(strict.some(problem => /publisher is still the placeholder/.test(problem)));
  assert.deepEqual(validateStoreConfig({ ...placeholderConfig, publisher: TEST_PUBLISHER }, { strict: false }), []);
  assert.ok(validateStoreConfig({ ...reserved, publisher: TEST_PUBLISHER }, { strict: true }).some(problem => /local test publisher/.test(problem)));
  assert.deepEqual(validateStoreConfig(reserved, { strict: true }), []);
  assert.deepEqual(validateStoreConfig(storeConfig, { strict: true }), []);
  assert.ok(validateStoreConfig({ ...reserved, publisher: "O=Someone" }).some(problem => /CN=/.test(problem)));
  assert.ok(validateStoreConfig({ ...reserved, identityName: "has space" }).some(problem => /identityName/.test(problem)));
});

test("the manifest declares a full-trust desktop app with its identity, logos, link and unvirtualized writes", () => {
  const manifest = buildAppxManifest({ config: reserved, version: "2.19.0", architecture: "x64" });
  assert.match(manifest, /<Identity\s+Name="12345OUTARCH\.OUTARCH"\s+Publisher="CN=1A2B3C4D-0000-4000-8000-123456789ABC"\s+Version="2\.19\.0\.0"\s+ProcessorArchitecture="x64" \/>/);
  assert.match(manifest, /<Application Id="OUTARCH" Executable="OUTARCH\.exe" EntryPoint="Windows\.FullTrustApplication">/);
  assert.match(manifest, /<rescap:Capability Name="runFullTrust" \/>/);
  assert.match(manifest, /<rescap:Capability Name="unvirtualizedResources" \/>/);
  assert.match(manifest, /<desktop6:FileSystemWriteVirtualization>disabled<\/desktop6:FileSystemWriteVirtualization>/);
  assert.match(manifest, /<desktop6:RegistryWriteVirtualization>disabled<\/desktop6:RegistryWriteVirtualization>/);
  assert.match(manifest, /<uap3:Protocol Name="outarch" Parameters="&quot;%1&quot;">/);
  assert.match(manifest, /<TargetDeviceFamily Name="Windows\.Desktop" MinVersion="10\.0\.19041\.0" MaxVersionTested="10\.0\.26100\.0" \/>/);
  // Every logo the manifest names has committed images.
  const assets = fs.readdirSync(path.join(root, "packaging/msix/Assets"));
  for (const [, logo] of manifest.matchAll(/Assets\\([A-Za-z0-9]+)\.png/g)) {
    assert.ok(assets.some(file => file.startsWith(`${logo}.scale-`)), `${logo} has no scaled images`);
  }
  for (const size of [16, 24, 32, 48, 256]) {
    assert.ok(assets.includes(`Square44x44Logo.targetsize-${size}_altform-unplated.png`), `taskbar icon ${size} is missing`);
  }
  assert.throws(() => buildAppxManifest({ config: reserved, version: "2.19.0", architecture: "ia32" }), /unsupported/);
  // Text from the config is escaped.
  assert.match(buildAppxManifest({ config: { ...reserved, description: "a < b & \"c\"" }, version: "2.19.0", architecture: "arm64" }), /a &lt; b &amp; &quot;c&quot;/);
});

test("packaging scripts, ignores and the submission guide are in place", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts["package:store"], "node scripts/msix/build-msix.mjs --mode store");
  assert.equal(pkg.scripts["package:msix:test"], "node scripts/msix/build-msix.mjs --mode test");
  assert.ok(pkg.scripts["package:msix:install-test"]);
  assert.ok(pkg.scripts["package:msix:verify"]);
  assert.ok(pkg.devDependencies["@electron/packager"]);
  assert.match(read(".gitignore"), /^out\/$/m);
  const build = read("scripts/msix/build-msix.mjs");
  // node-pty forks a helper with ELECTRON_RUN_AS_NODE and starts a worker by
  // path: RunAsNode stays on and nothing is packed into an asar archive.
  assert.match(build, /\[FuseV1Options\.RunAsNode\]: true/);
  assert.match(build, /asar: false/);
  assert.match(build, /outarchDistribution: "microsoft-store"/);
  const guide = read("MICROSOFT_STORE.md");
  for (const topic of ["Partner Center", "unvirtualizedResources", "runFullTrust", "package:store", "microsoft_store_id"]) {
    assert.ok(guide.includes(topic), `MICROSOFT_STORE.md covers ${topic}`);
  }
});
