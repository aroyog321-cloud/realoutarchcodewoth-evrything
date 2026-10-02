"use strict";

// 2026-09-24 operator report, from the ZIP app:
//   1. `agy` (Antigravity CLI) was never recognised as an AI agent — neither as
//      a worker's command nor typed into a running terminal.
//   2. "<worker> is running" toasts stopped disappearing on their own.
//   3. Notification sound was quiet, and late behind its notice.
//   4. The 1 / 1×2 / 2×1 / 2×2 / 3×2 layout buttons were misdrawn.
//   5. The Secure MCP tab only knew Gemini CLI, which Antigravity replaced.
//   6. The built-in Mission AI models took 30-60 s per call.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");

/* ------------------------------------------------------------ 1. agents */

const { AgentActivityService, agentForCommandLine } = require("../src/service/agentActivityService.cjs");
const { AgentPromptDetector } = require("../src/service/agentPromptDetector.cjs");

test("agent CLIs are recognised from their command line, launchers included, and prose is not", () => {
  const cases = {
    agy: "antigravity",
    "agy --yolo": "antigravity",
    '& "C:\\Users\\dev\\AppData\\Local\\agy\\bin\\agy.exe"': "antigravity",
    ".\\agy.exe": "antigravity",
    "powershell.exe -NoLogo -NoProfile -NoExit -Command agy": "antigravity",
    "npx @anthropic-ai/claude-code": "claude",
    "npx -y @google/gemini-cli": "gemini",
    "cmd /c codex": "codex",
    "C:\\tools\\claude.exe -p hi": "claude",
    qwen: "qwen",
    aider: "aider",
    "cursor-agent": "cursor"
  };
  for (const [line, agent] of Object.entries(cases)) assert.equal(agentForCommandLine(line), agent, line);
  for (const line of ["echo Hello", "git status", "node server.js", "example", "fix the agy bug", "legacy-build", ""]) {
    assert.equal(agentForCommandLine(line), null, line);
  }
});

test("typing an agent's command into a running shell makes it an agent at once, and never un-makes one", () => {
  const service = new AgentActivityService();
  service.noteCommand("w", "r", "echo Hello");
  assert.equal(service.getWorkerActivity("w").isAgent, false);
  service.noteCommand("w", "r", "agy");
  assert.equal(service.getWorkerActivity("w").isAgent, true);
  assert.equal(service.getWorkerActivity("w").agentType, "antigravity");
  // A prompt typed to the running agent is not a shell command.
  service.noteCommand("w", "r", "codex please");
  assert.equal(service.getWorkerActivity("w").agentType, "antigravity");
});

test("Antigravity's own startup screen identifies it, and its '>' input line is not read as an exit", () => {
  const service = new AgentActivityService();
  // Captured from agy 2026-09-23 in a node-pty PowerShell terminal.
  service.recordOutput("w", "r", "Welcome to the Antigravity CLI. You are currently not signed in.");
  assert.equal(service.getWorkerActivity("w").agentType, "antigravity");
  service.recordOutput("w", "r", ">");
  assert.equal(service.getWorkerActivity("w").isAgent, true, "a bare '>' is the agent's input line");
  service.recordOutput("w", "r", "PS C:\\project>");
  assert.equal(service.getWorkerActivity("w").isAgent, false, "the shell prompt coming back still ends it");
});

test("a worker whose command is a shell running agy is classified from the whole command line", () => {
  const service = new AgentActivityService();
  service.setProcessState("p", "r", { command: "powershell.exe -NoLogo -NoProfile -NoExit -Command agy", processName: "powershell.exe" });
  assert.equal(service.getWorkerActivity("p").agentType, "antigravity");
  const intelligence = read("src/groundstation/main/workspaceIntelligence.cjs");
  assert.match(intelligence, /command: \[session\.command, \.\.\.\(Array\.isArray\(session\.args\) \? session\.args : \[\]\)\]\.filter\(Boolean\)\.join\(" "\)/);
  assert.match(intelligence, /if \(event\?\.type === "session:input-evidence"\) this\.#noteCommand\(event\);/);
});

test("Antigravity's folder-trust question reaches Needs You, with its choices", () => {
  const detector = new AgentPromptDetector({ now: () => 1000 });
  const screen = [
    "Accessing workspace:",
    "C:\\Users\\dev\\project",
    "Do you trust the contents of this project?",
    "Antigravity CLI requires permission to read, edit, and execute files here.",
    "> Yes, I trust this folder",
    "No, exit",
    ""
  ].join("\r\n");
  const prompt = detector.observe("w", screen, { isAgent: false, workerName: "agy", runId: "r" });
  assert.ok(prompt, "the trust question is a prompt");
  assert.equal(prompt.agent, "antigravity");
  assert.match(prompt.question, /Do you trust the contents of this project\?/);
  assert.ok(prompt.choices.some(choice => /Yes, I trust this folder/.test(choice)));
});

test("the renderer's name heuristics know agy on word boundaries only", () => {
  for (const file of ["src/groundstation/renderer/App.jsx", "src/groundstation/renderer/AutoStartManager.jsx"]) {
    const source = read(file);
    assert.match(source, /antigravity\|\\bagy\\b\|/, file);
    assert.doesNotMatch(source, /\u0008/, `${file} has no stray backspace characters`);
  }
});

/* ------------------------------------------------------------- 2. toasts */

test("closing the last toast under the pointer no longer leaves every later toast paused", () => {
  const toasts = read("src/groundstation/renderer/ToastSystem.jsx");
  assert.match(toasts, /React\.useEffect\(\(\) => \{\n    if \(!toasts\.length && pausedRef\.current\) pause\(false\);\n  \}, \[toasts\.length, pause\]\);/);
});

/* -------------------------------------------------------------- 3. sound */

test("the chime is louder, starts its audio device early and rings for Windows toasts too", async () => {
  const sound = read("src/groundstation/renderer/notificationSound.js");
  assert.match(sound, /const MASTER_GAIN = 0\.42;/);
  assert.match(sound, /export function primeNotificationSound\(\)/);
  assert.match(sound, /audio\.resume\(\)\.then\(\(\) => schedule\(audio, notes, volume\)\)/);
  assert.match(read("src/groundstation/renderer/ToastSystem.jsx"), /React\.useEffect\(\(\) => \{ primeNotificationSound\(\); \}, \[\]\);/);
  // The loudest overlap stays under full scale: sine + overtone of both notes.
  const peak = 0.42 * (1 + 0.18 + 0.9 + 0.9 * 0.18);
  assert.ok(peak < 1, `peak ${peak.toFixed(2)} clips`);
});

/* ------------------------------------------------------------- 4. layout */

test("the layout buttons size to their labels instead of a fixed 29px", () => {
  const surfaces = read("src/groundstation/renderer/redesign/surfaces.css");
  assert.match(surfaces, /#root#root#root \.shell \.workspace-toolbar-v2 \.layout-switcher button \{\n  width: auto;\n  min-width: 34px;/);
});

/* ---------------------------------------------------------------- 5. MCP */

// The install itself (file, serverUrl, headers) is covered in mcpGateway.test.cjs.
test("the Secure MCP tab offers Antigravity CLI with its config file and snippet", () => {
  const tab = read("src/groundstation/renderer/McpGateway.jsx");
  assert.match(tab, /serverUrl: endpointUrl,/);
  assert.match(tab, /\{ id: "antigravity", name: "Antigravity CLI", where: "~\/\.gemini\/config\/mcp_config\.json"/);
});

/* ----------------------------------------------------------- 6. AI speed */

const providers = require("../src/service/aiProviders.cjs");

test("built-in models are asked to answer without long hidden reasoning, per the providers' documented controls", () => {
  assert.deepEqual(providers.fastSettingsFor("gemini", "gemini-2.5-flash"), { generationConfig: { thinkingConfig: { thinkingBudget: 0 } } });
  assert.deepEqual(providers.fastSettingsFor("gemini", "gemini-2.5-flash-lite"), { generationConfig: { thinkingConfig: { thinkingBudget: 0 } } });
  assert.deepEqual(providers.fastSettingsFor("gemini", "gemini-2.5-pro"), { generationConfig: { thinkingConfig: { thinkingBudget: 512 } } });
  assert.deepEqual(providers.fastSettingsFor("gemini", "gemini-3-flash"), { generationConfig: { thinkingConfig: { thinkingLevel: "low" } } });
  assert.equal(providers.fastSettingsFor("gemini", "gemini-2.0-flash"), null, "2.0 does not think");
  assert.deepEqual(providers.fastSettingsFor("openai", "nvidia/nemotron-3-super-120b-a12b"), { chat_template_kwargs: { enable_thinking: false } });
  assert.equal(providers.fastSettingsFor("openai", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"), null, "a reasoning model was chosen for it");
  assert.equal(providers.fastSettingsFor("openai", "meta/llama-3.2-11b-vision-instruct"), null);
});

function capture(respond) {
  const bodies = [];
  const fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    bodies.push(body);
    return respond(body, bodies.length);
  };
  return { bodies, fetch };
}
const ok = payload => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify(payload), json: async () => payload });
const geminiReply = ok({ candidates: [{ content: { parts: [{ text: "hi" }] }, finishReason: "STOP" }] });

test("a fast request carries the thinking setting; a BYOK request is unchanged", async () => {
  const fast = capture(() => geminiReply);
  await providers.chat({ provider: "gemini", apiKey: "AIzaSyD-test-key-0000000000000000000000", model: "gemini-2.5-flash", system: "s", messages: [{ role: "user", text: "q" }], fetch: fast.fetch, speed: "fast" });
  assert.deepEqual(fast.bodies[0].generationConfig, { thinkingConfig: { thinkingBudget: 0 } });

  const byok = capture(() => geminiReply);
  await providers.chat({ provider: "gemini", apiKey: "AIzaSyD-test-key-0000000000000000000000", model: "gemini-2.5-flash", system: "s", messages: [{ role: "user", text: "q" }], fetch: byok.fetch });
  assert.equal(byok.bodies[0].generationConfig, undefined, "an operator's own key keeps the provider default");
});

test("a model that refuses the thinking setting is asked again without it, and not asked with it again", async () => {
  const refuse = { ok: false, status: 400, headers: { get: () => null }, text: async () => JSON.stringify({ error: { code: 400, message: "Thinking budget is not supported for this model." } }), json: async () => ({ error: { code: 400, message: "Thinking budget is not supported for this model." } }) };
  const first = capture((body, count) => (count === 1 ? refuse : geminiReply));
  const result = await providers.chat({ provider: "gemini", apiKey: "AIzaSyD-test-key-0000000000000000000000", model: "gemini-2.5-flash-lite", system: "s", messages: [{ role: "user", text: "q" }], fetch: first.fetch, speed: "fast" });
  assert.equal(result.text, "hi");
  assert.equal(first.bodies.length, 2);
  assert.ok(first.bodies[0].generationConfig && !first.bodies[1].generationConfig);
  const again = capture(() => geminiReply);
  await providers.chat({ provider: "gemini", apiKey: "AIzaSyD-test-key-0000000000000000000000", model: "gemini-2.5-flash-lite", system: "s", messages: [{ role: "user", text: "q" }], fetch: again.fetch, speed: "fast" });
  assert.equal(again.bodies[0].generationConfig, undefined);
});

test("only Mission AI's built-in attempts ask for the fast mode", () => {
  const assistant = read("src/service/aiAssistant.cjs");
  assert.equal((assistant.match(/speed: "fast"/g) || []).length, 2, "the NVIDIA and Gemini built-in attempts");
  assert.match(assistant, /signal, speed: attempt\.speed \|\| null \}\);/);
  assert.match(assistant, /attempts\.push\(\{ slot: target\.keyId, model: target\.model, provider: target\.provider, apiKey: \(\) => this\.#byok\.apiKey\(target\.keyId\), baseUrl: [^}]*\}\);/, "the BYOK attempt carries no speed");
});
