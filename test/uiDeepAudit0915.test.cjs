"use strict";

/* 2026-09-15 deep audit. Every defect here was measured in the rendered
   renderer before it was changed (scripts/visual/probe-eval.cjs): the
   Groundstation inspector that could not be closed, the route opening scrolled
   past its attention queue, the header squeezed over its content at 1280px,
   recipe rows with a 1px name column at 1024px, a chosen 2x2 canvas stacked at
   1024px, badges cut mid-word, and 7-9px text. These lock the causes. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { buildProjectMemory } = require("../src/engine/projectMemory.cjs");

const renderer = path.resolve(__dirname, "../src/groundstation/renderer");
const read = file => fs.readFileSync(path.join(renderer, file), "utf8").replace(/\r\n/g, "\n");

test("closing the Groundstation inspector is not undone by the selection seed", () => {
  const app = read("App.jsx");
  // The seed filled any empty selection, including one the operator had just
  // cleared, so the close button and Escape re-opened the inspector at once.
  assert.match(app, /const selectWorker = React\.useCallback\(id => \{ selectionClearedRef\.current = !id; setSelectedWorker\(id\); \}, \[\]\);/);
  assert.match(app, /if \(!selectedWorker && sessions\[0\] && !selectionClearedRef\.current\) setSelectedWorker\(sessions\[0\]\.id\);/);
  assert.match(app, /view === "groundstation"\) return <LiveGroundstationView [^\n]*onSelect=\{selectWorker\}/);
  // A project switch still seeds the new project's first worker.
  assert.match(app, /selectionClearedRef\.current = false;\n\s*setSelectedWorker\(null\);/);
});

test("Groundstation opens at the top instead of scrolling to the seeded worker", () => {
  const app = read("App.jsx");
  const view = app.slice(app.indexOf("function LiveGroundstationView("));
  assert.match(view, /if \(!arrivedSelectionRef\.current\) \{\s*arrivedSelectionRef\.current = true;\s*if \(!focusSelectedRowRef\.current\) return;\s*\}\s*const row = document\.querySelector/);
});

test("the Groundstation header keeps its height when it wraps", () => {
  const surfaces = read("redesign/surfaces.css");
  assert.match(surfaces, /\.experience\.view-groundstation \.mc-gs-statusbar \{ flex: 0 0 auto; \}/);
  assert.match(surfaces, /@container groundstation \(max-width: 1160px\) \{[\s\S]{0,400}?\.mc-gs-statusbar-actions \{ grid-column: 1 \/ -1;/);
});

test("the inspector scrolls instead of crushing its facts table", () => {
  assert.ok(read("redesign/screens.css").includes("#root#root .shell .mc-gs-inspector > * { flex-shrink: 0; }"));
});

test("recipe rows reflow by the width of the library, not the window", () => {
  const cockpit = read("redesign/cockpit.css");
  assert.match(cockpit, /\.recipes-library \{ container: recipes-library \/ inline-size; \}/);
  assert.match(cockpit, /@container recipes-library \(max-width: 920px\) \{[\s\S]{0,500}?\.recipe-row > footer \{ grid-area: 2 \/ 1 \/ auto \/ -1;/);
  assert.match(cockpit, /@container recipes-library \(max-width: 520px\) \{[\s\S]{0,400}?\.recipe-run-history \{ order: 1; \}/);
});

test("worker badges are dropped whole rather than cut mid-word", () => {
  const screens = read("redesign/screens.css");
  assert.match(screens, /\.mc-gs-name-line \{ flex-wrap: wrap; align-content: flex-start; row-gap: 8px; max-height: 20px; overflow: hidden; \}/);
  assert.match(screens, /\.mc-gs-name-line \.mc-gs-evidence \{ flex: 0 0 auto; \}/);
  assert.doesNotMatch(screens, /\.mc-gs-name-line \.mc-gs-evidence \{ flex: 0 1 auto;/);
});

test("a chosen 2x2 canvas is not stacked by a viewport rule", () => {
  const workspace = read("redesign/workspace.css");
  assert.doesNotMatch(workspace, /@media \(max-width: 1100px\) \{\s*\.shell \.view-workspace \.terminal-grid/);
  assert.match(workspace, /@container workspace-stage \(max-width: 860px\) \{\s*\.shell \.view-workspace \.terminal-grid\.layout-grid-3x2/);
});

test("labels and copy read as words", () => {
  const app = read("App.jsx");
  assert.match(app, /role === "terminal" \? "Shell terminals"/);
  // The palette groups are headed, so rows no longer repeat their group name.
  assert.match(app, /<strong>\{item\.label\}<\/strong>\{recentIds\.includes\(item\.id\) && <small>Recent<\/small>\}/);
  assert.match(read("redesign/cockpit.css"), /\.command-palette \[cmdk-group-heading\] \{/);
  // The narrow status tape sheds whole entries instead of ellipsising all of them.
  assert.match(read("redesign/base.css"), /@media \(max-width: 1060px\) \{\s*#root#root \.shell \.status-bar-pill--protocol \{ display: none; \}/);
});

test("no measured text stays below a readable size", () => {
  const styles = read("styles.css");
  assert.match(styles, /\.dialog-footer > span \{[^}]*font-size: 12px;/);
  assert.match(styles, /\.terminal-warning \{[^}]*font-size: 11\.5px;/);
  assert.match(styles, /\.decision-room-heading > span \{[^}]*font-size: 11px; \}/);
  const memory = read("projectMemory.css");
  assert.match(memory, /\.memory-resume button > b \{[^}]*font-size: 10px;/);
  const surfaces = read("redesign/surfaces.css");
  assert.match(surfaces, /\.history-view :is\(\.recovery-chains button, \.memory-state-split article\) strong \{ font-size: 12px; \}/);
  assert.match(surfaces, /\.history-view \.timeline-kind \{ font-size: 10px; \}/);
});

test("Project Memory counts failed tests in singular and plural", () => {
  const event = (sequence, type, extra) => ({ sequence, timestamp: 1_700_000_000_000 + sequence, correlationId: "api:run:1", id: "api", name: "API", type, ...extra });
  const statementFor = evidence => {
    const memory = buildProjectMemory([
      event(1, "session:evidence", { category: "tests", evidence: { status: "failed", ...evidence } }),
      event(2, "session:status", { status: "failed" })
    ], [{ id: "api", name: "API", correlationId: "api:run:1", isAlive: false, status: "failed" }], { afterSequence: 0, latestSequence: 2 });
    return JSON.stringify(memory);
  };
  assert.match(statementFor({ failed: 1 }), /1 test failed/);
  assert.doesNotMatch(statementFor({ failed: 1 }), /1 tests failed/);
  assert.match(statementFor({ failed: 3 }), /3 tests failed/);
});
