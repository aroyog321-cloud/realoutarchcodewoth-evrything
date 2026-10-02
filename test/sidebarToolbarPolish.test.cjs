"use strict";

// The sidebar and Workspace toolbar polish pass (2026-09-18): the logo drawn as
// vectors, a one-letter project avatar, AI entry points that read as AI, a
// Focus button that draws the eye, and horizontal rows that scroll without a
// scrollbar. Every claim below was measured in the offscreen harness first.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const renderer = path.resolve(__dirname, "../src/groundstation/renderer");
const read = rel => fs.readFileSync(path.join(renderer, rel), "utf8").replace(/\r\n/g, "\n");

test("the project avatar is one letter and the switch affordance is an icon", () => {
  const app = read("App.jsx");
  // Two capitals ("FI", "AC") in the tile read as a code, not as the project.
  assert.match(app, /const projectMark = \(Array\.from\(String\(workspace\?\.name \|\| ""\)\.trim\(\)\)\[0\] \|\| "P"\)\.toUpperCase\(\);/);
  assert.doesNotMatch(app, /\.slice\(0, 2\)\.toUpperCase\(\)/);
  // The old text glyph rendered as a lowercase "v".
  // A plan that keeps one project shows the crown there instead.
  assert.match(app, /<i aria-hidden="true">\{projectLocked \? <CrownIcon size=\{13\}\/> : <Icon name="selector" size=\{14\}\/>\}<\/i><\/button>/);
  assert.doesNotMatch(app, /"Choose project"\}<\/strong><\/div><i aria-hidden="true">⌄/);
  const base = read("redesign/base.css");
  assert.match(base, /grid-template-columns: 26px minmax\(0, 1fr\) auto !important;/);
  assert.match(base, /\.top-project > \.top-project__mark \{[\s\S]{0,160}?width: 26px;\s*\n\s*height: 26px;/);
});

test("AI entry points wear the sparkle and a blue-to-violet edge, drawn from tokens", () => {
  const app = read("App.jsx");
  assert.match(app, /import \{ AiGlyph \} from "\.\/AiGlyph\.jsx";/);
  assert.match(app, /aria-label="Open Mission AI"><span><AiGlyph size=\{14\}\/><\/span><strong>Mission AI<\/strong><\/button>/);
  assert.match(app, /Alt C"><AiGlyph size=\{14\}\/> <span className="workspace-action-label">Assistant<\/span><\/button>/);
  // The robot icon: the old drawing was a shackle over a box — a padlock.
  assert.doesNotMatch(app, /M8 9V7a4 4 0 0 1 8 0v2/);
  assert.match(app, /  agents: <><path d="M12 4\.5V8"\/>/);

  const glyph = read("AiGlyph.jsx");
  assert.match(glyph, /aria-hidden="true" focusable="false"/);
  assert.match(glyph, /stopColor: "var\(--mc-ai-glyph-from, var\(--mc-ai-strong\)\)"/);
  assert.match(glyph, /stopColor: "var\(--mc-ai-glyph-to, var\(--mc-ai-violet\)\)"/);
  assert.match(glyph, /React\.useId\(\)/, "two glyphs on one page must not share a gradient id");

  const tokens = read("redesign/tokens-bridge.css");
  assert.equal((tokens.match(/--mc-ai-violet: /g) || []).length, 1);
  assert.match(tokens, /--mc-ai-iris: linear-gradient\(115deg, var\(--mc-ai-strong\), var\(--mc-ai-violet\)\);/);

  const surfaces = read("redesign/surfaces.css");
  // The face is a pseudo-element, so the older forced faces are never fought.
  assert.match(surfaces, /\.app-sidebar__footer \.top-ai::before,\n#root#root#root \.shell \.workspace-toolbar-v2 \.workspace-actions \.workspace-assistant-toggle::before \{/);
  assert.match(surfaces, /\.app-sidebar__footer \.top-ai > strong \{ color: var\(--mc-text\);/);
});

test("the Focus button's light runs only while focus mode is off and never under reduced motion", () => {
  const surfaces = read("redesign/surfaces.css");
  assert.match(surfaces, /@property --mc-focus-sweep \{\n  syntax: "<angle>";\n  inherits: false;\n  initial-value: 0deg;\n\}/);
  assert.match(surfaces, /@keyframes mc-focus-sweep \{ to \{ --mc-focus-sweep: 360deg; \} \}/);
  assert.match(surfaces, /\.workspace-focus-mode:not\(\.is-current\)::before \{[\s\S]{0,700}?animation: mc-focus-sweep 3\.8s linear infinite;/);
  assert.match(surfaces, /@media \(prefers-reduced-motion: reduce\) \{\n[^\n]*focus-mode:not\(\.is-current\)::before,\n[^\n]*::after,\n[^\n]*svg \{ animation: none; \}/);
  // The in-app Motion setting reaches elements, not pseudo-elements, so the
  // edge light is stopped by name.
  assert.match(surfaces, /\.shell\.motion-reduced \.workspace-toolbar-v2 \.workspace-actions \.workspace-focus-mode::before,/);
  // Its label is still the one the focus-mode tests read.
  assert.match(read("App.jsx"), /<span className="workspace-action-label">\{focusMode \? "Exit focus" : "Focus"\}<\/span>/);
});

test("the off-canvas roster and the folder rail scroll without a scrollbar", () => {
  const app = read("App.jsx");
  assert.match(app, /<EdgeScroll className="workspace-background__roster"><ul data-edge-scroller>/);
  assert.match(app, /<\/ul><\/EdgeScroll>\s*<\/section>\}/);
  assert.match(app, /<EdgeScroll className="worker-folders__rail"><div className="worker-folder-list" data-edge-scroller>/);

  const edge = read("EdgeScroll.jsx");
  // Pointer-only paging: out of the tab order and the accessibility tree,
  // because keyboard focus already scrolls a chip into view.
  assert.equal((edge.match(/tabIndex=\{-1\} aria-hidden="true"/g) || []).length, 2);
  // The wheel handler has to be able to prevent the page scroll, and only
  // does while the row can still move.
  assert.match(edge, /addEventListener\("wheel", onWheel, \{ passive: false \}\)/);
  assert.match(edge, /if \(next === scroller\.scrollLeft\) return;\n      event\.preventDefault\(\);/);
  assert.match(edge, /behavior: prefersReducedMotion\(\) \? "auto" : "smooth"/);
  assert.match(edge, /mutation\.disconnect\(\);/);

  const surfaces = read("redesign/surfaces.css");
  assert.match(surfaces, /\.workspace-background ul \{[\s\S]{0,200}?scrollbar-width: none;/);
  assert.match(surfaces, /#root#root#root \.shell \.worker-folder-list \{ scrollbar-width: none; \}/);
  assert.doesNotMatch(surfaces, /\.worker-folder-list \{ scrollbar-width: thin; \}/);
  // `.shell button` sets a 32px floor that stretched the round chevron.
  assert.match(surfaces, /\.shell \.edge-scroll > \.edge-scroll__nudge \{[\s\S]{0,200}?height: 22px;\n  min-height: 0;/);
});

test("below 760px the command deck is a wrapping row, not a column of tall items", () => {
  // styles.css makes the deck a column at that width; the forced flex layer
  // never restated the row, so the title's 220px basis became its height.
  assert.match(read("redesign/cockpit.css"), /#root#root \.shell \.view-workspace \.workspace-command-deck \{\n  display: flex !important;\n  flex-direction: row;\n  flex-wrap: wrap;/);
});
