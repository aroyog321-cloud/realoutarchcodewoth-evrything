"use strict";

/* 2026-09-15, from the operator's annotated screenshot of a popped-out terminal:
   the title strip was tinted with the slot colour and carried a numbered badge;
   a second row repeated the grid pane header (pane shortcut, drag handle, Find,
   stop, menu, maximise) even though the window never wired its actions, so
   Stop and every worker entry in the menu did nothing; and the activity line
   rendered as unstyled white text. Recall also sat under the native window
   controls. Each was rendered with `probe-eval.cjs --query popout=1&...`. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const renderer = path.resolve(__dirname, "../src/groundstation/renderer");
const read = file => fs.readFileSync(path.join(renderer, file), "utf8").replace(/\r\n/g, "\n");

test("the pop-out strip is neutral: no slot tint, top rule or numbered badge", () => {
  const popout = read("DetachedTerminalWindow.jsx");
  assert.ok(!popout.includes("detached-badge"));
  assert.ok(!popout.includes("--slot-accent"));
  assert.ok(popout.includes('<span className="popout-state" data-status={status}>{statusLabel}</span>'));
  assert.ok(popout.includes('idle: "Idle",'));
  const surfaces = read("redesign/surfaces.css");
  assert.ok(!surfaces.includes("border-top: 2px solid var(--slot-accent, var(--mc-accent));\n}\n#root#root .popout-titlebar"));
  assert.ok(surfaces.includes("padding: 0 calc(var(--popout-controls-w) + 8px) 0 12px;"), "Recall keeps clear of the native controls");
  assert.ok(surfaces.includes("  background: var(--mc-surface);\n  border-bottom: 1px solid var(--mc-border);\n  /* The strip is the window's drag handle"));
  // The native controls are drawn in the strip's own surface colour.
  const main = fs.readFileSync(path.resolve(__dirname, "../src/groundstation/main/index.cjs"), "utf8");
  assert.ok(main.includes('titleBarOverlay: {\n      color: "#171717",'));
});

test("a popped-out pane draws only the terminal, and its controls work", () => {
  const pane = read("TerminalPane.jsx");
  assert.ok(pane.includes('const windowChrome = chrome === "window";'));
  assert.ok(pane.includes('{!windowChrome && <header className="terminal-pane__header" ref={headerRef}>'));
  assert.ok(pane.includes("{!windowChrome && <div className={`terminal-pane__activity"));
  assert.ok(pane.includes("React.useEffect(() => { if (findSignal) setFindOpen(true); }, [findSignal]);"));

  const popout = read("DetachedTerminalWindow.jsx");
  assert.ok(popout.includes('chrome="window"'));
  assert.ok(popout.includes("onAction={act}"));
  assert.ok(popout.includes('await missionApi().request("action.dispatch", { sessionId: workerId, action: { type } });'));
  // Stopping needs the confirmation only the main window has; it says so.
  assert.ok(popout.includes("Stop or remove this worker from the main OUTARCH window"));
  assert.ok(popout.includes('onClick={() => setFindSignal(value => value + 1)}'));

  // A stopped worker gets the styled idle panel in the window too.
  assert.ok(read("redesign/surfaces.css").includes("#root#root .popout-body .terminal-idle {"));
});

test("Ask Mission AI is offered only where something can answer it", () => {
  assert.ok(read("TerminalPane.jsx").includes("onAskAI={onAskAI ? prompt => onAskAI(prompt) : undefined}"));
  assert.ok(read("CrashLens.jsx").includes('{crash.actions.includes("ask-ai") && onAskAI && ('));
});

test("a selection can be copied without the pane menu", () => {
  const pane = read("TerminalPane.jsx");
  assert.ok(pane.includes('if (accelerator && event.shiftKey && !event.altKey && key === "c") {'));
  assert.ok(pane.includes("<span>Copy selection</span><kbd>Ctrl Shift C</kbd>"));
});
