"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");

test("AI Reporting: ReportAiDialog exists and implements Microsoft Policy 11.16 requirements", () => {
  const code = read("src/groundstation/renderer/ReportAiDialog.jsx");
  assert.match(code, /ReportAiDialog/);
  assert.match(code, /REPORT_REASONS/);
  assert.match(code, /inappropriate/);
  assert.match(code, /unsafe/);
  assert.match(code, /incorrect/);
  assert.match(code, /outarch54@gmail\.com/);
  assert.match(code, /Dialog\.Root/);
  assert.match(code, /FlagIcon/);
});

test("AI Reporting: AssistantChat includes report button and ReportAiDialog", () => {
  const code = read("src/groundstation/renderer/AssistantChat.jsx");
  assert.match(code, /import ReportAiDialog, { FlagIcon } from "\.\/ReportAiDialog\.jsx"/);
  assert.match(code, /ai-msg__report-btn/);
  assert.match(code, /ReportAiDialog/);
  assert.match(code, /onReport/);
});

test("AI Reporting: surfaces.css defines styles for report button and dialog", () => {
  const css = read("src/groundstation/renderer/redesign/surfaces.css");
  assert.match(css, /\.shell \.ai-msg__report-btn/);
  assert.match(css, /\.ai-report-dialog/);
  assert.match(css, /\.ai-report-dialog__title/);
});
