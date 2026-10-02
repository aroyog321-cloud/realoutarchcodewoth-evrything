"use strict";

// Pasting into a terminal. xterm turns Ctrl V into ^V and cancels the key, so
// nothing was pasted into any program but PowerShell. The pane now lets the
// paste chords reach the browser (xterm's paste handling takes it from there)
// and sends long input in pieces the protocol accepts.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");
const load = () => import(pathToFileURL(path.join(root, "src/groundstation/renderer/terminalInput.js")).href);
const key = (fields) => ({ type: "keydown", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...fields });

test("Ctrl V, Ctrl Shift V and Shift Insert are paste; nothing else is", async () => {
  const { isPasteChord } = await load();
  assert.equal(isPasteChord(key({ key: "v", ctrlKey: true })), true);
  assert.equal(isPasteChord(key({ key: "V", ctrlKey: true, shiftKey: true })), true);
  assert.equal(isPasteChord(key({ key: "v", metaKey: true })), true);
  assert.equal(isPasteChord(key({ key: "Insert", shiftKey: true })), true);
  assert.equal(isPasteChord(key({ key: "v" })), false, "typing v types v");
  assert.equal(isPasteChord(key({ key: "c", ctrlKey: true })), false, "Ctrl C stays the interrupt");
  assert.equal(isPasteChord(key({ key: "v", ctrlKey: true, altKey: true })), false, "AltGr combinations are left alone");
  assert.equal(isPasteChord(key({ key: "Insert", shiftKey: true, ctrlKey: true })), false);
  assert.equal(isPasteChord({ ...key({ key: "v", ctrlKey: true }), type: "keyup" }), false);
});

test("Alt V reaches the program (Claude Code's image paste); other Alt chords stay the workspace's", async () => {
  const { isShellAltChord } = await load();
  assert.equal(isShellAltChord(key({ key: "v", altKey: true })), true);
  for (const letter of ["g", "w", "r", "n", "a", "i", "h", "l", "f", "c", "b", "1", "ArrowLeft"]) {
    assert.equal(isShellAltChord(key({ key: letter, altKey: true })), false, `Alt ${letter} stays a workspace shortcut`);
  }
  assert.equal(isShellAltChord(key({ key: "v", altKey: true, ctrlKey: true })), false);
});

test("long input is split under the protocol limit, in order, never inside a character", async () => {
  const { chunkTerminalInput, TERMINAL_INPUT_CHUNK_BYTES } = await load();
  const { MAX_TERMINAL_INPUT_BYTES } = require("../src/protocol/index.cjs");
  assert.ok(TERMINAL_INPUT_CHUNK_BYTES < MAX_TERMINAL_INPUT_BYTES);
  assert.deepEqual(chunkTerminalInput(""), []);
  assert.deepEqual(chunkTerminalInput("a"), ["a"]);
  assert.deepEqual(chunkTerminalInput("\x1b[200~ls\r\x1b[201~"), ["\x1b[200~ls\r\x1b[201~"]);
  const text = `${"x".repeat(40000)}é${"€".repeat(9000)}😀${"y".repeat(30000)}`;
  const pieces = chunkTerminalInput(text, 16 * 1024);
  assert.equal(pieces.join(""), text, "nothing lost or reordered");
  assert.ok(pieces.length > 1);
  for (const piece of pieces) {
    assert.ok(Buffer.byteLength(piece) <= 16 * 1024);
    assert.equal(Buffer.from(piece, "utf8").toString("utf8"), piece, "no piece ends inside a character");
  }
});

test("the terminal pane lets paste through and sends input in pieces", () => {
  const pane = fs.readFileSync(path.join(root, "src/groundstation/renderer/TerminalPane.jsx"), "utf8").replace(/\r\n/g, "\n");
  assert.match(pane, /import \{ chunkTerminalInput, isPasteChord, isShellAltChord \} from "\.\/terminalInput\.js";/);
  const paste = pane.indexOf("if (isPasteChord(event)) return false;");
  const altV = pane.indexOf("if (isShellAltChord(event)) return true;");
  const altHeld = pane.indexOf("if (event.altKey && !accelerator) return false;");
  assert.ok(paste > 0 && altV > paste && altHeld > altV, "paste and Alt V are decided before Alt is held for the workspace");
  assert.match(pane, /for \(const piece of chunkTerminalInput\(data\)\) \{\n\s+void missionApi\(\)\.request\("terminal\.write", \{ streamId: currentStream, data: piece \}\)/);
});
