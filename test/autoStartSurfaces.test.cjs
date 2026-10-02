"use strict";

// The launch-policy surfaces: the start-with-workspace dialog, the terminal
// pane's menu entry, the inspector toggles, and the Add terminal path.

const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const renderer = path.resolve(__dirname, "../src/groundstation/renderer");
const read = file => fs.readFileSync(path.join(renderer, file), "utf8").replace(/\r\n/g, "\n");

function cssFiles() {
  return [
    ...fs.readdirSync(renderer).filter(file => file.endsWith(".css")),
    ...fs.readdirSync(path.join(renderer, "redesign")).filter(file => file.endsWith(".css")).map(file => `redesign/${file}`)
  ];
}

test("every token the start-with-workspace styles use is declared, so the dialog paints a surface", () => {
  const premium = read("premiumDesign.css");
  const start = premium.indexOf("START WITH WORKSPACE");
  assert.ok(start > 0, "the start-with-workspace section exists");
  const section = premium.slice(start);
  const used = [...new Set([...section.matchAll(/var\((--[\w-]+)/g)].map(match => match[1]))];
  const declared = new Set();
  for (const file of cssFiles()) {
    for (const match of read(file).matchAll(/(?:^|[;{\s])(--[\w-]+)\s*:/g)) declared.add(match[1]);
  }
  const missing = used.filter(token => !declared.has(token));
  // An undeclared token is not an error in CSS: the property silently falls
  // back, which is how this dialog shipped with a transparent card.
  assert.deepEqual(missing, [], `undeclared tokens: ${missing.join(", ")}`);
  assert.match(section, /\.dialog-card\.autostart-manager-dialog\s*\{[^}]*background:\s*var\(--glass-surface-strong\)/);
  assert.match(section, /\.pm-toggle input:focus-visible ~ \.pm-toggle-track/, "a hidden checkbox needs a visible focus ring");
});

test("each row of the dialog is one native checkbox inside its label", () => {
  const source = read("AutoStartManager.jsx");
  assert.match(source, /<label\s+key=\{session\.id\}\s+className=\{`autostart-worker-row/);
  assert.match(source, /type="checkbox"/);
  assert.doesNotMatch(source, /role="button"/, "a row must not be a button wrapped around a second control");
  assert.doesNotMatch(source, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, "the dialog speaks in words, like the rest of the app");
  // Bulk changes touch only the rows on screen.
  assert.match(source, /const targets = visible\.filter/);
});

test("the pane menu states the launch policy as a checkbox item", () => {
  const pane = read("TerminalPane.jsx");
  assert.match(pane, /<DropdownMenu\.CheckboxItem className="terminal-action-item" checked=\{Boolean\(session\.autoStart\)\}/);
  assert.match(pane, /requestAction\("setAutoStart", \{ enabled: checked === true \}\)/);
});

test("the inspectors send the state the person chose and use no emoji", () => {
  const app = read("App.jsx");
  assert.doesNotMatch(app, /[\u{1F300}-\u{1FAFF}\u{26A1}]/u);
  assert.match(app, /onAction\("setAutoStart", session\.id, \{ enabled: event\.target\.checked \}\)/);
  assert.match(app, /onAction\("setAutoStart", focused\.id, \{ enabled: event\.target\.checked \}\)/);
});

test("Add terminal starts what it creates while the saved policy stays manual", () => {
  const dialog = read("WorkerDialog.jsx");
  assert.match(dialog, /await onSave\(value, \{ start: !editing && !seed \}\)/);
  const app = read("App.jsx");
  assert.match(app, /options\.start === true && value\.autoStart !== true/);
  assert.match(app, /sessionId: value\.id, action: \{ type: "start" \}/);
});

test("the dialog is reachable from Settings as well as the command palette", () => {
  const app = read("App.jsx");
  assert.match(app, /onConfigureAutoStart=\{\(\) => setAutoStartManagerOpen\(true\)\}/);
  assert.match(app, /choose which terminals start with the workspace/);
  assert.match(app, /id: "autostart-manager", label: "Choose which terminals start with the workspace"/);
});
