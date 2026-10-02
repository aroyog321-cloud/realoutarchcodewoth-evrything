"use strict";

/* 2026-09-15, from the operator's annotated screenshot of the Workspace:
   the terminal find bar looked broken (it had no stylesheet rule at all, so it
   rendered browser-default bordered buttons, and it took a row above the
   output that refitted the terminal), and the pane header carried an
   "offline" / "Live" chip and a resource sparkline the operator asked to
   remove, with pop-out promoted from the ⋯ menu to a header control. Each was
   measured in the renderer before and after (scripts/visual/probe-eval.cjs). */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const renderer = path.resolve(__dirname, "../src/groundstation/renderer");
const read = file => fs.readFileSync(path.join(renderer, file), "utf8").replace(/\r\n/g, "\n");

test("the pane header no longer carries the connection chip or the sparkline", () => {
  const pane = read("TerminalPane.jsx");
  assert.ok(!pane.includes("terminal-pane__telemetry"));
  assert.ok(!pane.includes("WorkerMetricStrip"));
  // The connection state still drives the activity line and its warnings.
  assert.ok(pane.includes("const activityLabel = activity(session, connection);"));
});

test("pop out is a header control beside maximise, offered once", () => {
  const pane = read("TerminalPane.jsx");
  const popout = pane.indexOf('className="icon-button terminal-pane__popout"');
  const more = pane.indexOf('className="icon-button terminal-more"');
  const maximise = pane.indexOf('title={expanded ? "Return to grid" : "Focus terminal"}');
  assert.ok(popout > more && popout < maximise, "it sits after the menu and before maximise");
  assert.ok(pane.includes("onClick={() => void detachToWindow()}"));
  assert.ok(pane.includes("canPopOut = true,"));
  assert.ok(pane.includes("{canPopOut && <button"));
  // A pane already in its own window does not offer to pop out again.
  assert.ok(read("DetachedTerminalWindow.jsx").includes("canPopOut={false}"));
});

test("find in output is a floating field that never refits the terminal", () => {
  const pane = read("TerminalPane.jsx");
  assert.ok(pane.includes('role="search"'));
  assert.ok(pane.includes("style={{ top: findTop }}"));
  assert.ok(pane.includes('if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeFind(); }'));
  assert.ok(pane.includes('else if (event.key === "Enter" && event.shiftKey) { event.preventDefault(); find(-1); }'));
  // Closing hands the keyboard back to the terminal it searched.
  assert.ok(pane.includes("terminalRef.current?.clearSelection();\n    terminalRef.current?.focus();"));
  assert.ok(!pane.includes('aria-label="Previous match">↑</button>'), "the bare arrow-glyph buttons are gone");

  const surfaces = read("redesign/surfaces.css");
  assert.ok(surfaces.includes("#root#root .terminal-pane { position: relative; }"));
  assert.ok(surfaces.includes("#root#root .terminal-pane .terminal-find {\n  position: absolute;"));
  assert.ok(surfaces.includes("#root#root .terminal-pane .terminal-find input:focus-visible { outline: none; box-shadow: none; }"));
  assert.ok(surfaces.includes("#root#root .terminal-pane .terminal-find__status:empty { display: none; }"));
});
