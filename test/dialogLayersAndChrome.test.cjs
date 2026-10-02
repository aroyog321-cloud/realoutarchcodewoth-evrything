"use strict";

/* 2026-09-15 report: the command palette "did nothing", the VS Code Bridge
   folder pushed the workspace toolbar below its deck, the native window
   controls sat in a darker box than the strip behind them, and the resize
   corner drew a box at every junction. Each was measured in the renderer
   before it was fixed (scripts/visual/probe-see-this-0915.cjs,
   probe-dialog-layers.cjs); these lock the causes, not the symptoms. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test } = require("node:test");

const renderer = path.resolve(__dirname, "../src/groundstation/renderer");
const read = file => fs.readFileSync(path.join(renderer, file), "utf8").replace(/\r\n/g, "\n");

test("every dialog paints above its own backdrop", () => {
  const surfaces = read("redesign/surfaces.css");
  // The backdrops are raised to 140 in the authoritative layer…
  assert.match(surfaces, /\.agent-picker-backdrop\) \{[\s\S]{0,400}?z-index: 140;/);
  // …so the palette (60 from an older layer) and the mission editor (121) sat
  // under theirs: blurred, and the first click landed on the backdrop.
  assert.match(surfaces, /\.command-palette:not\(\.worker-dialog\),\n\.mission-editor \{ z-index: 141; \}/);
  // The palette's entrance animation holds its last transform frame, so it is
  // centred with auto margins; the add-terminal dialog shares the class and
  // positions itself.
  assert.match(surfaces, /\.command-palette:not\(\.worker-dialog\) \{\s*right: 0;\s*left: 0;\s*margin-inline: auto;\s*transform: none;\s*\}/);
});

test("keyboard help is a real dialog, and describes the resize the canvas has", () => {
  const surfaces = read("redesign/surfaces.css");
  assert.match(surfaces, /\.help-dialog \{\s*position: fixed;\s*z-index: 141;\s*inset: 0;/);
  assert.match(surfaces, /\.help-dialog \.help-groups \{[^}]*overflow: auto;/);
  const help = read("HelpOverlay.jsx");
  assert.doesNotMatch(help, /Drag a split|on a split|Double-click split/, "the canvas no longer has shared splits");
  assert.match(help, /\["Drag an edge", "Resize that terminal; its neighbours give way"\]/);
});

test("the VS Code Bridge deck takes the canvas's slot in the stage", () => {
  const workspace = read("redesign/workspace.css");
  assert.match(workspace, /\.workspace-stage > \.workspace-toolbar-v2 \{ order: 1;/);
  assert.match(workspace, /\.workspace-stage > \.vscode-workspace-deck \{\s*order: 3;\s*flex: 1 1 0;\s*min-height: 0;\s*overflow: auto;\s*\}/);
  assert.match(read("App.jsx"), /activeFolder\?\.isVSCode \? \(\s*<VSCodeWorkspaceDeck/);
});

test("a resize corner draws no box; the edges keep their bar", () => {
  const workspace = read("redesign/workspace.css");
  assert.match(workspace, /\.tile-resize-grip\.is-corner::before \{ content: none; \}/);
  assert.doesNotMatch(workspace, /\.tile-resize-grip\.is-corner::before \{\s*width: 9px;/);
  assert.match(workspace, /\.tile-resize-grip\.is-e::before,\n[^\n]*\.is-w::before \{ width: 4px;/);
});

test("the native window controls take the colour the status tape paints", async () => {
  const url = pathToFileURL(path.join(renderer, "windowChrome.js")).href;
  const { paintedBackground } = await import(`${url}?t=${Date.now()}`);
  const previous = globalThis.window;
  globalThis.window = { getComputedStyle: node => ({ backgroundColor: node.bg }) };
  try {
    const node = (bg, parentElement = null) => ({ nodeType: 1, bg, parentElement });
    // The tape: its surface at 94% over a black shell.
    const shell = node("rgb(0, 0, 0)");
    assert.equal(paintedBackground(node("color(srgb 0.0901961 0.0901961 0.0901961 / 0.94)", node("rgba(0, 0, 0, 0)", shell))), "#161616");
    // An opaque background is its own colour; nothing behind it shows.
    assert.equal(paintedBackground(node("rgb(23, 23, 23)", node("rgb(255, 0, 0)"))), "#171717");
    // Half-transparent white over black.
    assert.equal(paintedBackground(node("rgba(255, 255, 255, 0.5)", shell)), "#808080");
  } finally {
    if (previous === undefined) delete globalThis.window; else globalThis.window = previous;
  }

  const app = read("App.jsx");
  assert.match(app, /import \{ syncWindowChrome \} from "\.\/windowChrome\.js";/);
  assert.match(app, /window\.requestAnimationFrame\(\(\) => syncWindowChrome\(\)\)/);
  // The focus strip paints the same colour as the tape, so one overlay colour fits both.
  assert.match(read("redesign/surfaces.css"), /\.main-area::before \{[^}]*background: color-mix\(in srgb, var\(--mc-surface\) 94%, transparent\);/);

  const main = fs.readFileSync(path.resolve(__dirname, "../src/groundstation/main/index.cjs"), "utf8");
  assert.match(main, /const WINDOW_CHROME_COLOR = \/\^#\[0-9a-f\]\{6\}\$\/i;/);
  assert.match(main, /if \(typeof color !== "string" \|\| !WINDOW_CHROME_COLOR\.test\(color\)\) throw/);
  assert.match(main, /mainWindow\.setTitleBarOverlay\(\{ \.\.\.MAIN_TITLE_BAR_OVERLAY, color, height:/);
  // A replaced renderer must not inherit a focus-mode strip.
  assert.match(main, /function createWindow\(options = \{\}\) \{[\s\S]{0,400}?windowChrome = \{ \.\.\.windowChrome, mode: "standard" \};/);
  assert.match(fs.readFileSync(path.resolve(__dirname, "../src/groundstation/preload/index.cjs"), "utf8"), /setWindowChrome,/);
});
