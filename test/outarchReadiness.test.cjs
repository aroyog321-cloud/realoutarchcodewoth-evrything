"use strict";

// The production-readiness pass that shipped with the OUTARCH rename: measured
// legibility defects, the Groundstation drawer that opened itself over the
// attention queue, and a launcher that reinstalled and rebuilt on every start.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");
const renderer = rel => read(path.join("src/groundstation/renderer", rel));

test("History's run chapters read at the type floor and keep the whole name", () => {
  const surfaces = renderer("redesign/surfaces.css");
  const block = surfaces.slice(surfaces.indexOf("#root#root .shell .history-view .history-chapters {"), surfaces.indexOf("#root#root .shell .history-view .history-snapshot small"));
  assert.ok(block.length > 200, "the chapters block exists");
  // The block had been restated with forced weight on every declaration.
  assert.doesNotMatch(block, /!important/);
  const text = block.replace(/^.*button > b \{[^\n]*\n/m, "");
  assert.doesNotMatch(text, /font-size: (?:[0-9]|10(?:\.\d)?|11)px/, "no chapter text below 11.5px except the uppercase badge");
  assert.match(block, /history-chapters > div > button \{\n  display: grid;\n  grid-template-columns: 8px minmax\(0, 1fr\);/);
  assert.match(block, /history-chapters button > b \{ grid-column: 2; justify-self: start; font-size: 10px; \}/);
  // The only forced accents left are the originals in premiumDesign.css, now with the intended values.
  assert.match(renderer("premiumDesign.css"), /\.history-chapters button\.has-risk \{ background: color-mix\(in srgb,var\(--mc-danger\) 7%,transparent\) !important;/);
});

test("the Needs You count, pane role tags and blue labels meet text contrast", () => {
  const base = renderer("redesign/base.css");
  const badge = base.slice(base.indexOf("#root#root .shell .top-navigation button b {"), base.indexOf("#root#root .shell .app-sidebar__footer {"));
  assert.match(badge, /color: var\(--mc-text\) !important;/);
  assert.match(badge, /background: color-mix\(in srgb, var\(--mc-danger\) 72%, var\(--mc-void\)\) !important;/);
  assert.match(badge, /font-size: 10px !important;/);
  // The current-destination badge rule was always outranked by the one above, so it is gone.
  assert.doesNotMatch(base, /\.top-navigation button\.is-current b \{/);
  assert.match(base, /\.top-project small \{\n  color: var\(--mc-text-dim\);\n  font-size: 10px;/);
  assert.match(base, /\.app-sidebar__footer \.top-ai > span \{ color: var\(--mc-ai-strong\); font-size: 10px; \}/);
  assert.match(renderer("redesign/cockpit.css"), /\.terminal-role-tag \{\n  color: color-mix\(in srgb, var\(--terminal-role, var\(--mc-accent\)\) 58%, var\(--mc-text\)\) !important;/);
  const styles = renderer("styles.css");
  assert.match(styles, /\.view-workspace \.workspace-recipes,\.view-workspace \.workspace-inspector\.is-current \{ color: var\(--mc-accent-strong\) !important;/);
  assert.match(styles, /\.worker-folder-list \.worker-folder-add \{ color: var\(--mc-accent-strong\);/);
});

test("every label the sweep measured below 10px now meets the floor", () => {
  const cockpit = renderer("redesign/cockpit.css");
  assert.equal((cockpit.match(/font: 650 9\.5px\/1\.4 var\(--mc-font-mono\) !important;/g) || []).length, 0, "page and section kickers");
  assert.equal((cockpit.match(/font: 650 10\.5px\/1\.4 var\(--mc-font-mono\) !important;/g) || []).length, 2);
  assert.match(cockpit, /\) > \* > small \{\n  order: 0;\n  flex: 0 0 auto;\n  color: var\(--mc-text-dim\) !important;\n  font-size: 10px !important;/);
  assert.match(cockpit, /\.recipes-status-strip > div > span \{\n  flex: 0 0 auto;\n  color: var\(--mc-text-dim\);\n  font: 650 10px\/1\.4 var\(--mc-font-mono\);/);
  assert.match(cockpit, /\.recipe-row-title > span \{[^}]*font-size: 10px;/);
  assert.match(cockpit, /font: 650 10px\/1 var\(--mc-font-mono\);\n\}\n#root#root \.shell \.experience \.recipes-guide li > span/);
  const screens = renderer("redesign/screens.css");
  assert.match(screens, /\.mc-gs-counts span \{ font-size: 10px;/);
  assert.match(screens, /\.mc-gs-evidence \{[^}]*font-size: 10px;/);
  assert.match(screens, /\.mc-gs-inspector-events time \{ color: var\(--mc-text-dim\); font-size: 10px;/);
  assert.match(screens, /\.mc-gs-inspector-ai > span \{[^}]*color: var\(--mc-ai-strong\);[^}]*font: 700 10px var\(--mc-font-mono\);/);
  const surfaces = renderer("redesign/surfaces.css");
  assert.match(surfaces, /\.mai-md-code-lang \{[^}]*font-size: 10px;/);
  assert.match(surfaces, /#root#root \.decision-item__meta em \{\n  padding: 1px 5px;\n  font-size: 10px;/);
  assert.match(surfaces, /#root#root \.decision-item__facts dt \{\n  color: var\(--mc-text-dim\);\n  font-size: 10px;/);
  const styles = renderer("styles.css");
  assert.match(styles, /\.history-evidence-strip > header button \{[^}]*color: var\(--mc-accent-strong\);/);
  assert.match(styles, /\.history-evidence-strip > div > button span \{ color: var\(--mc-accent-strong\);/);
});

test("a narrow Groundstation opens on its queue, not on an inspector nobody asked for", () => {
  const app = renderer("App.jsx");
  assert.match(app, /const GS_INSPECTOR_RAIL_MIN = 1100;/);
  assert.match(app, /function useNarrowContainer\(ref, threshold\) \{[\s\S]{0,500}new ResizeObserver\(measure\)/);
  const start = app.indexOf("function LiveGroundstationView(");
  const view = app.slice(start, app.indexOf("\nfunction ", start + 10));
  assert.match(view, /selectedId: sharedSelectedId, onSelect: selectShared/);
  assert.match(view, /const drawerInspector = useNarrowContainer\(groundstationRef, GS_INSPECTOR_RAIL_MIN\);/);
  assert.match(view, /const onSelect = React\.useCallback\(id => \{ setInspectorChosen\(Boolean\(id\)\); selectShared\(id\); \}, \[selectShared\]\);/);
  assert.match(view, /const selectedId = drawerInspector && !inspectorChosen \? null : sharedSelectedId;/);
  assert.match(view, /<div ref=\{groundstationRef\} className=\{`mc-ref-groundstation/);
  // The JS threshold is the CSS one: at 1100px of canvas the inspector becomes a rail.
  assert.match(renderer("redesign/screens.css"), /@container groundstation \(min-width: 1100px\) \{[\s\S]{0,400}\.mc-gs-inspector \{\n    position: sticky;/);
});

test("the renderer is rebuilt only when its sources changed", t => {
  const { isBuildStale } = require("../scripts/ensure-renderer-build.cjs");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "outarch-build-check-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const source = path.join(directory, "src");
  fs.mkdirSync(path.join(source, "nested"), { recursive: true });
  const file = path.join(source, "nested", "App.jsx");
  const output = path.join(directory, "index.html");
  fs.writeFileSync(file, "a");
  const past = new Date(Date.now() - 60_000);
  fs.utimesSync(file, past, past);
  fs.utimesSync(path.join(source, "nested"), past, past);
  fs.utimesSync(source, past, past);
  assert.equal(isBuildStale({ output, inputs: [source] }), true, "no build yet");
  fs.writeFileSync(output, "<html>");
  assert.equal(isBuildStale({ output, inputs: [source] }), false);
  const later = new Date(Date.now() + 60_000);
  fs.utimesSync(file, later, later);
  assert.equal(isBuildStale({ output, inputs: [source] }), true, "an edited source");
  fs.utimesSync(file, past, past);
  fs.utimesSync(path.join(source, "nested"), later, later);
  assert.equal(isBuildStale({ output, inputs: [source] }), true, "a deleted or renamed file changes only its folder");
  assert.equal(isBuildStale({ output, inputs: [path.join(directory, "missing")] }), false, "a missing input is not a change");

  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts.groundstation, "node scripts/ensure-renderer-build.cjs && electron src/groundstation/main/index.cjs");
  assert.equal(pkg.scripts["groundstation:build"], "vite build --config vite.groundstation.config.mjs");
  assert.equal(pkg.bin.outarch, "./bin/termctl.js");
  assert.equal(pkg.bin.termctl, "./bin/termctl.js");
});

test("the Windows launcher is OUTARCH's, keeps the old name working and stops reinstalling", () => {
  const launcher = fs.readFileSync(path.join(root, "OPEN_OUTARCH_WINDOWS.cmd"), "utf8");
  assert.equal((launcher.match(/(?<!\r)\n/g) || []).length, 0, "cmd.exe needs CRLF line endings");
  assert.match(launcher, /title OUTARCH\r\n/);
  assert.match(launcher, /node\.exe -e "require\('node-pty'\)" >nul 2>nul\r\nif errorlevel 1 goto install_dependencies/);
  assert.doesNotMatch(launcher, /build\\Release\\pty\.node/, "prebuilt node-pty has no locally compiled binary to look for");
  assert.match(launcher, /call npm\.cmd run groundstation -- %\*/);
  for (const [legacy, current] of [["OPEN_MISSION_CONTROL_WINDOWS.cmd", "OPEN_OUTARCH_WINDOWS.cmd"], ["VERIFY_MISSION_CONTROL_WINDOWS.cmd", "VERIFY_OUTARCH_WINDOWS.cmd"]]) {
    assert.match(read(legacy), new RegExp(`call "%~dp0${current.replace(".", "\\.")}" %\\*`));
    const pkg = JSON.parse(read("package.json"));
    assert.ok(pkg.files.includes(legacy) && pkg.files.includes(current), `${legacy} and ${current} ship`);
  }
  assert.match(read(".gitattributes"), /^\*\.cmd text eol=crlf$/m);
});
