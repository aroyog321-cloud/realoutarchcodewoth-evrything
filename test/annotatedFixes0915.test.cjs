"use strict";

/* 2026-09-15, from the user's annotated screenshot of the running app:
   "this search bar looks too bad", worker commands "written like this"
   (powershell.exe -NoLogo -NoProfile -...), "why is this taking space" under
   the Groundstation register, the "Not running" pane text, and "redesign this"
   on the recipe builder's start strategy. Each was reproduced in the renderer
   with PowerShell-shaped workers (MC_FIXTURE_SHELLS=1) before it was changed. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const renderer = path.resolve(__dirname, "../src/groundstation/renderer");
const read = file => fs.readFileSync(path.join(renderer, file), "utf8").replace(/\r\n/g, "\n");

function loadLaunchLabel() {
  const source = read("launchLabel.js");
  const commonjs = source.replace(/^export function /gm, "function ");
  const context = { module: { exports: {} } };
  vm.createContext(context);
  vm.runInContext(`${commonjs}\nmodule.exports = { describeLaunch };`, context);
  return context.module.exports;
}
const { describeLaunch } = loadLaunchLabel();

test("a worker's command is described as what it runs, not as its shell wrapper", () => {
  const plain = describeLaunch("powershell.exe", ["-NoLogo", "-NoProfile", "-NoExit"]);
  assert.equal(plain.label, "PowerShell");
  assert.equal(plain.runs, "");
  assert.equal(plain.full, "powershell.exe -NoLogo -NoProfile -NoExit");

  const claude = describeLaunch("powershell.exe", ["-NoLogo", "-NoProfile", "-NoExit", "-Command", "claude"]);
  assert.equal(claude.label, "claude");
  assert.equal(claude.shell, "PowerShell");

  const withDashes = describeLaunch("powershell.exe", ["-NoLogo", "-NoProfile", "-NoExit", "-Command", "npm run dev -- --port 5173"]);
  assert.equal(withDashes.label, "npm run dev -- --port 5173");

  const fullPath = describeLaunch("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", ["-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "pnpm dev"]);
  assert.equal(fullPath.label, "pnpm dev");

  assert.equal(describeLaunch("bash", ["-i", "-c", "npm test; exec bash -i"]).label, "npm test");
  assert.equal(describeLaunch("zsh", ["-i"]).label, "Zsh");
  assert.equal(describeLaunch("cmd.exe", ["/k", "yarn start"]).label, "yarn start");

  // Anything that is not the form's wrapper is shown exactly as configured.
  assert.equal(describeLaunch("npm", ["run", "dev"]).label, "npm run dev");
  assert.equal(describeLaunch("powershell.exe", ["-File", "script.ps1"]).label, "powershell.exe -File script.ps1");
  assert.equal(describeLaunch("", []).label, "");
});

test("every place that named the wrapper now uses the description, with the exact command on hover", () => {
  const app = read("App.jsx");
  assert.ok(app.includes("const commandText = launch.label || \"Ready to configure\";"));
  assert.ok(app.includes("<code title={launch.full || undefined}>{commandText}</code>"));
  assert.ok(app.includes("Starting it opens an interactive ${launch.shell} in an engine-owned PTY."));
  const pane = read("TerminalPane.jsx");
  assert.ok(pane.includes("{launch.runs && <code title={launch.full}>{launch.runs}</code>}"));
  assert.ok(!pane.includes("nothing behind it yet"), "the old idle explanation must not come back");
  assert.ok(read("WorkspaceRecipes.jsx").includes("{describeLaunch(session.command, session.args).label}</small>"));
  assert.ok(read("AutoStartManager.jsx").includes("const command = describeLaunch(session.command, session.args).label;"));
});

test("the Groundstation search is one field with one focus ring", () => {
  const screens = read("redesign/screens.css");
  // The route focus rule rings every focused input; inside the field frame that
  // drew a second rounded box.
  assert.ok(screens.includes("#root#root .shell .mc-gs-search input:focus-visible { box-shadow: none; border-radius: 0; }"));
  assert.ok(screens.includes("box-sizing: border-box; height: 34px;"), "the field matches the 34px state chips beside it");
  assert.ok(read("App.jsx").includes("<kbd aria-hidden=\"true\">Ctrl F</kbd>"));
});

test("the Groundstation work column runs to the bottom edge", () => {
  const screens = read("redesign/screens.css");
  assert.ok(screens.includes("padding: 0 26px 0 !important;"));
  assert.ok(!screens.includes("padding: 0 26px 34px !important;"), "the frame's bottom pad sat outside the scroll column");
  assert.ok(read("redesign/surfaces.css").includes("#root#root .shell .experience.view-groundstation .mc-gs-inspector { margin-bottom: var(--mc-space-4); }"));
});

test("an idle pane never stacks its lines on each other", () => {
  const surfaces = read("redesign/surfaces.css");
  assert.ok(surfaces.includes(".shell .view-workspace .terminal-idle > * { flex-shrink: 0; }"));
  assert.ok(surfaces.includes("align-content: safe center;"));
  assert.ok(surfaces.includes(".shell .view-workspace .terminal-idle > .terminal-idle__mark { grid-column: 1; justify-self: end; margin-right: 8px; }"));
});

test("the recipe start strategy reads as one labelled choice", () => {
  const recipes = read("WorkspaceRecipes.jsx");
  assert.ok(recipes.includes("<div className=\"recipe-template-strip\" role=\"group\" aria-labelledby=\"recipe-template-label\"><span id=\"recipe-template-label\">How should it start?</span>"));
  assert.ok(recipes.includes("aria-pressed={templateId === template.id}"));
  assert.ok(!recipes.includes("HOW SHOULD IT START?"));
  const screens = read("redesign/screens.css");
  assert.ok(screens.includes("background: radial-gradient(circle, var(--mc-accent) 0 3px, transparent 3.5px);"), "the selected option has a filled radio mark");
  assert.ok(!screens.includes("border: 1.5px solid var(--mc-accent) !important;"), "the glow-and-bar selected state is gone");
  assert.ok(screens.includes(".recipes-dialog.recipes-dialog-v2 .recipe-builder > * {\n  flex-shrink: 0;\n}"));
});
