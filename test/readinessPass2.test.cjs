"use strict";

// Second readiness pass: every dialog, menu and panel was opened and measured.
// These lock what that found — copy that failed on an unfocused window, a
// sidebar that stayed tabbable in focus mode, dialogs painted with the retired
// palette, ink on bright fills, and config files for other tools that could be
// blanked or rewritten for nothing.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");
const renderer = rel => read(path.join("src/groundstation/renderer", rel));

async function loadClipboard(globals) {
  const saved = {};
  for (const key of ["window", "navigator", "document"]) {
    saved[key] = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value: globals[key], configurable: true, writable: true });
  }
  try {
    const url = `${pathToFileURL(path.join(root, "src/groundstation/renderer/clipboard.js")).href}?t=${Date.now()}${Math.random()}`;
    return await import(url);
  } finally {
    // The module reads the globals at call time, so the caller restores them.
    globals.restore = () => {
      for (const [key, descriptor] of Object.entries(saved)) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    };
  }
}

function fakeDocument(copyResult) {
  const removed = [];
  return {
    removed,
    body: { appendChild() {} },
    createElement: () => ({ style: {}, setAttribute() {}, select() {}, remove() { removed.push(true); } }),
    execCommand: () => { if (copyResult instanceof Error) throw copyResult; return copyResult; }
  };
}

test("copying prefers the app's own clipboard and falls back cleanly", async () => {
  const calls = [];
  const globals = {
    window: { missionControl: { copyText: async text => { calls.push(["bridge", text]); } } },
    navigator: { clipboard: { writeText: async text => { calls.push(["page", text]); } } },
    document: fakeDocument(true)
  };
  const { copyText } = await loadClipboard(globals);
  try {
    assert.equal(await copyText("one"), true);
    assert.deepEqual(calls, [["bridge", "one"]]);

    // An unfocused page throws; the bridge failing too leaves the hidden field.
    globals.window.missionControl.copyText = async () => { throw new Error("no bridge"); };
    globals.navigator.clipboard.writeText = async () => { throw new DOMException("Document is not focused."); };
    assert.equal(await copyText("two"), true);
    assert.equal(globals.document.removed.length, 1, "the hidden field is always removed");

    globals.document.execCommand = () => false;
    await assert.rejects(copyText("three"), error => error.message === "Could not copy to the clipboard. Click inside the window and try again.");
  } finally {
    globals.restore();
  }
});

test("every copy in the renderer goes through the helper, and the main process owns the clipboard", () => {
  for (const file of ["App.jsx", "ContextSnapshotButton.jsx", "McpGateway.jsx", "MobileCompanion.jsx", "TerminalPane.jsx"]) {
    const source = renderer(file);
    assert.doesNotMatch(source, /navigator\.clipboard/, `${file} still calls the page clipboard directly`);
    assert.match(source, /import \{ copyText \} from "\.\/clipboard\.js";/, `${file} imports the helper`);
  }
  const preload = read("src/groundstation/preload/index.cjs");
  assert.match(preload, /function copyText\(text\) \{\n  return ipcRenderer\.invoke\("mission-control:copy-text", String\(text \?\? ""\)\);/);
  assert.match(preload, /request,\n  copyText,\n  openExternal,/);
  const main = read("src/groundstation/main/index.cjs");
  assert.match(main, /ipcMain\.handle\("mission-control:copy-text", async \(event, text\) => \{\n    assertTrustedAppFrame\(event\);\n    if \(typeof text !== "string"\) throw[^\n]*\n    if \(text\.length > MAX_COPY_CHARACTERS\) throw[^\n]*\n    clipboard\.writeText\(text\);/);
  assert.match(main, /function assertTrustedAppFrame\(event\) \{[\s\S]{0,300}owner === mainWindow \|\| detachedTerminalWindows\.has\(owner\)/);
  assert.match(read("scripts/visual/preload.cjs"), /copyText: \(\) => Promise\.resolve\(true\)/);
});

test("every button shows keyboard focus with an outline no component clears", () => {
  const base = renderer("redesign/base.css");
  assert.match(base, /\.shell :is\(input, select, textarea, \[tabindex="0"\], \[role="separator"\]\):focus-visible \{\n  outline: none !important;\n  box-shadow: var\(--mc-focus-ring\);/);
  assert.match(base, /\.shell :is\(button, a, \[role="button"\], \[role="tab"\], \[role="switch"\]\):focus-visible \{\n  outline: 2px solid var\(--mc-accent-strong\) !important;\n  outline-offset: 2px;\n\}/);
  // Fields that show focus on their frame keep doing so.
  assert.match(renderer("redesign/surfaces.css"), /^\.shell \.ai-composer textarea:focus-visible \{ outline: none; box-shadow: none; border-radius: 0; \}$/m);
});

test("focus mode takes the sidebar out of the tab order, not just out of sight", () => {
  const surfaces = renderer("redesign/surfaces.css");
  assert.match(surfaces, /:root\[data-workspace-focus="on"\] #root#root#root \.shell > \.app-sidebar \{ visibility: hidden; \}/);
});

test("dialogs outside the shell read the current palette", () => {
  const premium = renderer("premiumDesign.css");
  const rootBlock = premium.slice(premium.indexOf(":root {"), premium.indexOf("}", premium.indexOf(":root {")));
  assert.match(rootBlock, /--theme-text-default: var\(--mc-text-soft\);/);
  assert.match(rootBlock, /--theme-text-muted: var\(--mc-text-muted\);/);
  assert.match(rootBlock, /--theme-text-dim: var\(--mc-text-dim\);/);
  assert.match(rootBlock, /--theme-accent-ink: var\(--mc-accent-ink\);/);
  const graph = renderer("missionGraph.css");
  const dialog = graph.slice(graph.indexOf(".mission-graph-dialog {"), graph.indexOf("}", graph.indexOf(".mission-graph-dialog {")));
  for (const [name, token] of [["--gs-text", "--mc-text"], ["--gs-muted", "--mc-text-muted"], ["--gs-dim", "--mc-text-dim"], ["--gs-accent", "--mc-accent-strong"]]) {
    assert.match(dialog, new RegExp(`${name}: var\\(${token}\\);`));
  }
});

test("text on a bright status fill is dark, and small labels in dialogs meet the floor", () => {
  const vscode = renderer("vscodeBridge.css");
  assert.match(vscode, /\.vscode-setup-steps \.is-ready b \{ color: var\(--mc-void\); background: var\(--mc-ok\);/);
  assert.match(vscode, /\.vscode-setup-steps \.is-active b \{ color: var\(--mc-void\); background: var\(--mc-warning\);/);
  const screens = renderer("redesign/screens.css");
  assert.match(screens, /\.recipe-discard-guard \.btn-danger \{[^}]*color: var\(--mc-void\) !important;[^}]*background: var\(--mc-danger\) !important;/);
  assert.match(screens, /\.recipe-builder__intro > div > span \{\n  color: var\(--mc-accent-strong\);\n  font-size: 10px;/);
  const surfaces = renderer("redesign/surfaces.css");
  assert.match(surfaces, /\.terminal-action-menu \.terminal-action-label \{[^}]*font-size: 10px;/);
  assert.match(surfaces, /\.worker-dialog \.worker-dialog-ai > span \{\n  color: var\(--mc-ai-strong\);\n  font: 750 10px\/1 var\(--mc-font-mono\);/);
  assert.match(surfaces, /\.shell \.settings-note \.settings-inline-link \{[^}]*color: var\(--mc-accent-strong\);/);
  const styles = renderer("styles.css");
  assert.match(styles, /\.worker-form-heading > span \{ color: var\(--mc-text-dim\); font-size: 11px;/);
  assert.match(styles, /\.palette-search kbd, \.palette-results kbd \{[^}]*font: 10px /);
  assert.match(styles, /\.dialog-tabs button\.is-current \{ color: var\(--mc-accent-strong\);/);
  assert.match(renderer("MissionGraph.jsx"), /fontSize: "10px",\n\s*fontWeight: "680",\n\s*color: isFailed \? "var\(--mc-danger\)" : isAttention \? "var\(--mc-warning\)" : isLive \? "var\(--mc-accent-strong\)"/);
});

test("Needs You never calls a queue it could not load clear", () => {
  assert.match(renderer("useDecisions.js"), /complete: status === "error" \? false : query\.complete,/);
  const app = renderer("App.jsx");
  assert.match(app, /: !decisionsComplete\n\s*\? <EmptyState title="The queue could not be confirmed"/);
  assert.match(app, /totalWaiting \? "Review impact before acting" : decisionsComplete \? "Nothing requires intervention" : "Waiting for every source to answer"/);
  // The completeness notice had no styles and stacked with a full-width Retry.
  const surfaces = renderer("redesign/surfaces.css");
  assert.match(surfaces, /#root#root \.shell \.decision-source-strip \{ display: flex; flex-direction: row;/);
  assert.match(surfaces, /#root#root \.shell \.decision-source-strip > button \{ flex: 0 0 auto; width: auto;/);
  // Buttons that rendered with the browser's own outset face.
  assert.match(app, /<button type="button" className="btn-secondary" onClick=\{onRecipes\}>Create a recipe<\/button>/);
  assert.match(app, /<button type="button" className="btn-secondary" onClick=\{onManage\}>Create a recipe<\/button>/);
});

test("the pane rename form, the graph's primary buttons and the model menu work without a mouse", () => {
  const surfaces = renderer("redesign/surfaces.css");
  assert.match(surfaces, /#root#root \.shell \.terminal-pane__header \.terminal-rename \{ position: absolute; inset: 0; z-index: 4; display: flex;/);
  assert.match(surfaces, /#root#root \.shell \.terminal-rename button\[type="submit"\] \{ color: var\(--mc-text-ink\); background: var\(--mc-accent\);/);
  assert.match(surfaces, /\.terminal-pane__header:has\(> \.terminal-rename\) > :not\(\.terminal-rename\) \{ visibility: hidden; \}/);
  // A button no component styles gets a quiet solid edge instead of the browser's raised one.
  assert.match(renderer("redesign/base.css"), /^button \{ background-color: transparent; border: 1px solid var\(--mc-border\); \}$/m);
  assert.match(surfaces, /\.ai-model-menu__section-badge\.is-muted \{ background: transparent; \}/);
  // The remapped accent is the text blue; a filled button needs the solid one.
  assert.match(renderer("missionGraph.css"), /\.mission-graph-empty button \{ color: var\(--mc-text-ink\); background: var\(--mc-accent\);/);
  // With six models or fewer there is no search field; the list itself takes focus.
  assert.match(renderer("aiCatalog.jsx"), /\(menu\.querySelector\("\[cmdk-input\]"\) \|\| menu\.querySelector\("\[cmdk-root\]"\)\)\?\.focus\(\);/);
});

test("another tool's config file is never blanked, rewritten for nothing, or half-written", () => {
  const { SecureMcpGateway } = require("../src/service/mcpGateway.cjs");
  const files = new Map();
  const writes = [];
  const renames = [];
  const makeFs = ({ renameFails = false } = {}) => ({
    existsSync: p => files.has(p),
    readFileSync: p => files.get(p),
    writeFileSync: (p, content) => { writes.push(p); files.set(p, content); },
    renameSync: (from, to) => { if (renameFails) throw Object.assign(new Error("busy"), { code: "EPERM" }); renames.push([from, to]); files.set(to, files.get(from)); files.delete(from); },
    rmSync: p => files.delete(p),
    mkdirSync: () => {}
  });
  const store = { status: () => ({ enabled: true, port: 0, scopes: [], available: true, configured: true }), token: () => "T".repeat(43), appendAudit: () => {}, listAudit: () => [] };
  const gateway = new SecureMcpGateway({ store, missionContext: { snapshot: () => ({}) }, projectSupervision: { snapshot: () => ({}) }, getEngineApi: () => ({}) });
  gateway.os = { homedir: () => "/home/op" };
  gateway.fs = makeFs();

  const installed = gateway.installClient({ target: "claude-code" });
  assert.equal(renames.length, 1, "the new content replaces the file in one step");
  assert.ok(renames[0][0].endsWith(".tmp") && renames[0][1] === installed.filePath);
  assert.ok(files.get(installed.filePath).endsWith("}\n"));

  // A file with none of our entry is left exactly as it is.
  files.set(installed.filePath, "{\"theme\":\"dark\"}");
  writes.length = 0;
  const nothing = gateway.removeClient({ target: "claude-code" });
  assert.equal(nothing.removed, false);
  assert.deepEqual(writes, []);
  assert.equal(files.get(installed.filePath), "{\"theme\":\"dark\"}");

  // Codex too.
  const codexPath = gateway.installClient({ target: "codex" }).filePath;
  files.set(codexPath, "model = \"gpt-5\"\n");
  writes.length = 0;
  assert.equal(gateway.removeClient({ target: "codex" }).removed, false);
  assert.deepEqual(writes, []);

  // Something that is not a JSON object is refused rather than replaced with {}.
  files.set(installed.filePath, "[1, 2, 3]");
  writes.length = 0;
  assert.throws(() => gateway.installClient({ target: "claude-code" }), /not a JSON object, so OUTARCH left it unchanged/);
  assert.deepEqual(writes, []);
  assert.equal(files.get(installed.filePath), "[1, 2, 3]");
  files.set(installed.filePath, "{\"mcpServers\": [\"x\"]}");
  assert.throws(() => gateway.installClient({ target: "claude-code" }), /unexpected "mcpServers" value/);

  // A replace the tool refuses (file held open) falls back to writing in place.
  files.set(installed.filePath, "{}");
  gateway.fs = makeFs({ renameFails: true });
  const fallback = gateway.installClient({ target: "claude-code" });
  assert.ok(JSON.parse(files.get(fallback.filePath)).mcpServers.outarch);
  assert.equal([...files.keys()].some(key => key.endsWith(".tmp")), false, "no temporary file is left behind");
  gateway.dispose();

  assert.doesNotMatch(renderer("McpGateway.jsx"), /The mission-control configuration/);
});
