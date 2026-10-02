"use strict";

// The assistant's own workbench. Mission AI and the operator's own models used
// to read the code and run checks by typing into a terminal the operator was
// using, so every command, its output and its errors landed in their
// workspace. These tests hold the replacement to its promises: the file tools
// stay inside the project and away from secrets, a command runs in a hidden
// process that no terminal shows, its output reaches the chat instead, and
// nothing the assistant does for itself is ever written to a worker.

const test = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { AssistantWorkbench, commandLaunch, isSecretFile } = require("../src/service/assistantWorkbench.cjs");
const { AiAssistant, TOOLS, systemPrompt } = require("../src/service/aiAssistant.cjs");
const { BuiltinMissionAiCredentials } = require("../src/service/missionAiBuiltinKeys.cjs");

const root = path.resolve(__dirname, "..");
const PRIMARY = "AIzaPRIMARYkey000000000000000000000";
const FALLBACK = "AIzaFALLBACKkey00000000000000000000";

function project() {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "mc-bench-")));
  const write = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  write("src/app.js", "const port = 3000;\nconst password = \"hunter2\";\n// findme: the app starts here\nstart(port);\n");
  write("src/util/format.js", "export const findme = value => String(value);\n");
  write("node_modules/pkg/index.js", "module.exports = 'findme in a dependency';\n");
  write(".env", "SECRET_VALUE=findme-in-env\n");
  write(".env.example", "SECRET_VALUE=\n");
  write("keys/server.pem", "not really a key\n");
  write("notes.md", "# Notes\n-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA\nabc123\n-----END RSA PRIVATE KEY-----\nafter the key\n");
  write("logo.png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]));
  return dir;
}

function bench(dir, options = {}) {
  return new AssistantWorkbench({ getRoot: () => dir, minTimeoutSeconds: 0.05, ...options });
}

const run = (workbench, name, args, context) => workbench.execute({ name, arguments: args }, context);

async function waitFor(check, timeoutMs = 10_000, label = "condition") {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = check();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  throw new Error(`timed out waiting for ${label}`);
}

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === "EPERM"; }
}

// A node process that records its pid and then stays up until it is killed.
// Written without "$" or "!" so both PowerShell and bash pass it through untouched.
const lingering = "node -e \"require('fs').writeFileSync('pid.txt', String(process.pid)); console.log('started'); setInterval(() => {}, 1000)\"";

// ------------------------------------------------------------------ files

test("the file tools list, read and search the project without leaving it", async () => {
  const dir = project();
  const workbench = bench(dir);

  const listed = await run(workbench, "list_files", {});
  const entries = listed.result.entries;
  assert.ok(entries.includes("src/"));
  assert.ok(entries.some(entry => entry.startsWith("src/app.js  ")), "files carry their size");
  assert.ok(entries.includes("src/util/"), "two levels by default");
  assert.ok(entries.some(entry => entry.startsWith("node_modules/  (")), "dependency folders are named");
  assert.ok(!entries.some(entry => entry.startsWith("node_modules/pkg")), "but not opened");
  assert.ok(entries.some(entry => entry.startsWith(".env  ") && entry.endsWith("(holds secrets; not readable)")));
  const shallow = await run(workbench, "list_files", { depth: 1 });
  assert.ok(!shallow.result.entries.includes("src/util/"));
  const deps = await run(workbench, "list_files", { folder: "node_modules" });
  assert.ok(deps.result.entries.includes("node_modules/pkg/"), "a skipped folder opens when asked for by name");

  const read = await run(workbench, "read_file", { path: "src/app.js" });
  assert.equal(read.label, "Read src/app.js");
  assert.equal(read.result.totalLines, 4);
  assert.match(read.result.content, /^1 \| const port = 3000;$/m);
  assert.match(read.result.content, /^2 \| const password = \[REDACTED\]/m, "values that look like secrets are masked");
  assert.doesNotMatch(read.result.content, /hunter2/);
  assert.equal(read.result.more, undefined);

  const range = await run(workbench, "read_file", { path: "src/app.js", start_line: 3, end_line: 3 });
  assert.equal(range.result.lines, "3-3");
  assert.match(range.result.content, /^3 \| \/\/ findme/);
  const partial = await run(workbench, "read_file", { path: "src/app.js", end_line: 2 });
  assert.match(partial.result.more, /start_line 3/);

  // A private key inside an ordinary file is masked line for line, so the
  // numbers after it stay true.
  const notes = await run(workbench, "read_file", { path: "notes.md" });
  assert.doesNotMatch(notes.result.content, /MIIEow|abc123/);
  assert.match(notes.result.content, /^6 \| after the key$/m);

  const found = await run(workbench, "search_files", { query: "findme" });
  assert.deepEqual(found.result.matches, [
    "src/app.js:3: // findme: the app starts here",
    "src/util/format.js:1: export const findme = value => String(value);"
  ], "dependencies and secret files are not searched");
  const scoped = await run(workbench, "search_files", { query: "findme", file_pattern: "format.*" });
  assert.equal(scoped.result.matches.length, 1);
  const regex = await run(workbench, "search_files", { query: "const \\w+ = 3000", regex: true });
  assert.deepEqual(regex.result.matches, ["src/app.js:1: const port = 3000;"]);
  const none = await run(workbench, "search_files", { query: "nothing-like-this" });
  assert.deepEqual(none.result.matches, ["(no matches)"]);
  await assert.rejects(run(workbench, "search_files", { query: "(", regex: true }), /not a valid regular expression/);
});

test("the file tools refuse secrets, binaries, Git internals and anything outside the project", async () => {
  const dir = project();
  const workbench = bench(dir);
  await assert.rejects(run(workbench, "read_file", { path: ".env" }), /holds secrets/);
  await assert.rejects(run(workbench, "read_file", { path: "keys/server.pem" }), /holds secrets/);
  assert.match((await run(workbench, "read_file", { path: ".env.example" })).result.content, /SECRET_VALUE=/);
  await assert.rejects(run(workbench, "read_file", { path: "logo.png" }), /binary/);
  await assert.rejects(run(workbench, "read_file", { path: "src" }), /is a folder/);
  await assert.rejects(run(workbench, "read_file", { path: "missing.txt" }), /Nothing called "missing.txt"/);
  await assert.rejects(run(workbench, "read_file", { path: "../outside.txt" }), /inside the project/);
  await assert.rejects(run(workbench, "read_file", { path: path.join(os.tmpdir(), "elsewhere.txt") }), /inside the project/);
  await assert.rejects(run(workbench, "list_files", { folder: ".." }), /inside the project/);
  await assert.rejects(run(workbench, "run_command", { command: "echo hi", folder: "../" }), /inside the project/);
  fs.mkdirSync(path.join(dir, ".git"));
  fs.writeFileSync(path.join(dir, ".git", "config"), "[remote]\n");
  await assert.rejects(run(workbench, "read_file", { path: ".git/config" }), /Git's own files/);

  // A link that leads out of the project is not followed.
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "mc-bench-outside-"));
  fs.writeFileSync(path.join(outside, "secret.txt"), "outside\n");
  let linked = false;
  try { fs.symlinkSync(outside, path.join(dir, "escape"), "junction"); linked = true; } catch { /* links need rights this machine may not grant */ }
  if (linked) await assert.rejects(run(workbench, "read_file", { path: "escape/secret.txt" }), /inside the project/);

  const closed = new AssistantWorkbench({ getRoot: () => null });
  await assert.rejects(run(closed, "list_files", {}), /Open a project folder first/);
  await assert.rejects(run(closed, "run_command", { command: "echo hi" }), /Open a project folder first/);

  assert.equal(isSecretFile(".env.local"), true);
  assert.equal(isSecretFile(".env.sample"), false);
  assert.equal(isSecretFile("id_ed25519"), true);
  assert.equal(isSecretFile("id_ed25519.pub"), false);
  assert.equal(isSecretFile("keyboard.js"), false);
});

// ------------------------------------------------------------------ commands

test("a command runs hidden, in the project folder, and reports its exit code and output", async () => {
  const dir = project();
  const launches = [];
  const spawn = (file, args, options) => {
    launches.push({ file, args, options });
    return childProcess.spawn(file, args, options);
  };
  const workbench = bench(dir, { spawn });

  const ok = await run(workbench, "run_command", { command: "node -e \"console.log(process.cwd())\"", folder: "src" });
  assert.equal(ok.result.exitCode, 0);
  assert.equal(path.resolve(ok.result.output.trim()).toLowerCase(), path.join(dir, "src").toLowerCase());
  assert.equal(ok.result.folder, "src");
  assert.equal(ok.activity.state, "done");
  assert.equal(ok.activity.detail, null);
  assert.equal(ok.label, "Ran node -e \"console.log(process.cwd())\"");

  const failed = await run(workbench, "run_command", { command: "node -e \"console.log('to stdout'); console.error('to stderr'); process.exit(3)\"" });
  assert.equal(failed.result.exitCode, 3);
  assert.match(failed.result.output, /to stdout/);
  assert.match(failed.result.output, /to stderr/, "errors reach the chat too, not a terminal");
  assert.equal(failed.activity.state, "failed");
  assert.equal(failed.activity.detail, "Exited with code 3");
  assert.equal(failed.activity.command, "node -e \"console.log('to stdout'); console.error('to stderr'); process.exit(3)\"");
  assert.match(failed.activity.output, /to stderr/);

  const quiet = await run(workbench, "run_command", { command: "node -e 0" });
  assert.equal(quiet.result.output, "(no output)");

  // No console window, no keyboard, and on POSIX a process group of its own
  // so the whole command can be ended.
  const shell = launches[0];
  assert.equal(shell.options.windowsHide, true);
  assert.equal(shell.options.stdio[0], "ignore");
  assert.equal(shell.options.detached, process.platform !== "win32");
  assert.equal(shell.options.cwd, path.join(dir, "src"));
  assert.equal(shell.options.env.NO_COLOR, "1");
  assert.equal(shell.options.env.GIT_TERMINAL_PROMPT, "0");
});

test("a command is stopped at its time limit, and Stop ends one that is running", async () => {
  const dir = project();
  const workbench = bench(dir);

  const limited = await run(workbench, "run_command", { command: lingering, timeout_seconds: 4 });
  assert.equal(limited.result.exitCode, null);
  assert.match(limited.result.note, /still running after 4 seconds/);
  assert.match(limited.result.note, /add a worker/);
  assert.equal(limited.activity.state, "failed");
  assert.equal(limited.activity.detail, "Stopped at the 4 s time limit");
  const firstPid = Number(fs.readFileSync(path.join(dir, "pid.txt"), "utf8"));
  await waitFor(() => !alive(firstPid), 5000, "the timed-out process to end");
  fs.rmSync(path.join(dir, "pid.txt"));

  const controller = new AbortController();
  const updates = [];
  const running = run(workbench, "run_command", { command: lingering }, { signal: controller.signal, onOutput: text => updates.push(text) });
  const pidFile = path.join(dir, "pid.txt");
  await waitFor(() => fs.existsSync(pidFile) && fs.readFileSync(pidFile, "utf8"), 15_000, "the command to start");
  await waitFor(() => updates.some(text => text.includes("started")), 5000, "live output");
  controller.abort();
  await assert.rejects(running, error => error.name === "AbortError" && /Stopped before it finished/.test(error.message));
  const secondPid = Number(fs.readFileSync(pidFile, "utf8"));
  await waitFor(() => !alive(secondPid), 5000, "the stopped process to end");

  // Closing the app ends whatever is still running.
  fs.rmSync(pidFile);
  const orphan = run(workbench, "run_command", { command: lingering });
  await waitFor(() => fs.existsSync(pidFile) && fs.readFileSync(pidFile, "utf8"), 15_000, "the command to start");
  workbench.dispose();
  await assert.rejects(orphan, /Stopped before it finished/);
  const thirdPid = Number(fs.readFileSync(pidFile, "utf8"));
  await waitFor(() => !alive(thirdPid), 5000, "the disposed process to end");
});

test("on Windows the command reaches PowerShell intact, whatever quotes it holds", () => {
  const command = "Write-Output 'it''s' \"$env:PATH\" `n; git log --format=\"%h %s\"";
  const launch = commandLaunch(command, "win32");
  assert.equal(launch.file, "powershell.exe");
  assert.deepEqual(launch.args.slice(0, 4), ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command"]);
  const encoded = launch.args[4].match(/FromBase64String\('([A-Za-z0-9+/=]+)'\)/)[1];
  assert.equal(Buffer.from(encoded, "base64").toString("utf8").split("\n")[0], command);
  assert.doesNotMatch(launch.args[4], /git log/, "only base64 travels on the command line");
  assert.match(launch.args[4], /\| Out-Default; if \(\$__mcOk\) \{ exit 0 \}/, "the exit waits for the output to be written");
  const posix = commandLaunch("echo hi", "linux");
  assert.deepEqual(posix.args, ["-l", "-c", "echo hi"]);
});

// ------------------------------------------------------------------ the assistant

function fakeEngine(dir, { persistent = true } = {}) {
  const calls = [];
  return {
    calls,
    getWorkspace: () => ({ name: "acme", directory: dir, persistent }),
    list: () => [{ id: "web", name: "Web dev server", status: "running", isAlive: true, command: "npm", args: ["run", "dev"], cwd: ".", lastLine: "ready" }],
    getSnapshot: id => (id === "web" ? { id, name: "Web dev server", status: "running", isAlive: true, lines: ["ready"] } : null),
    listAttention: () => [],
    listRecipes: () => [],
    start: id => { calls.push(["start", id]); return { ok: true }; },
    restart: id => { calls.push(["restart", id]); return { ok: true }; },
    kill: id => { calls.push(["kill", id]); return { ok: true }; },
    write: (id, data) => { calls.push(["write", id, data]); return { ok: true }; },
    create: definition => { calls.push(["create", definition]); return { ok: true }; }
  };
}

function scriptedGemini(script) {
  const requests = [];
  const fetch = async (url, init) => {
    const body = init.body ? JSON.parse(init.body) : null;
    requests.push({ url, body });
    const respond = (status, value) => ({ ok: status < 400, status, headers: { get: () => null }, text: async () => JSON.stringify(value) });
    if (url.includes("/models?")) return respond(200, { models: [{ name: "models/gemini-2.5-flash", displayName: "Gemini 2.5 Flash", supportedGenerationMethods: ["generateContent"] }] });
    const next = script.shift();
    return next ? respond(200, next) : respond(500, { error: { message: "script exhausted" } });
  };
  return { fetch, requests, chats: () => requests.filter(request => request.body?.contents) };
}

const say = text => ({ candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } });
const callTool = (name, args) => ({ candidates: [{ content: { parts: [{ functionCall: { name, args } }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } });

function assistant(dir, script, engineOptions) {
  const engine = fakeEngine(dir, engineOptions);
  const gemini = scriptedGemini(script);
  const ai = new AiAssistant({
    builtin: new BuiltinMissionAiCredentials({ keys: { primary: PRIMARY, fallback: FALLBACK } }),
    getEngineApi: () => engine,
    fetch: gemini.fetch,
    settleMs: 0
  });
  return { ai, engine, gemini };
}

test("reviewing the code needs no approval and never touches the operator's terminals", async () => {
  const dir = project();
  const { ai, engine, gemini } = assistant(dir, [
    callTool("list_files", {}),
    callTool("read_file", { path: "src/app.js" }),
    callTool("search_files", { query: "findme" }),
    say("Move the port into configuration.")
  ]);
  await ai.refreshMissionModels();
  const result = await ai.send({ conversationId: "review", text: "what should I change in this codebase?" });
  const reply = result.messages.at(-1);
  assert.equal(result.pending, null, "nothing waited for approval");
  assert.equal(reply.text, "Move the port into configuration.");
  assert.deepEqual(reply.activity.map(item => [item.state, item.label]), [
    ["done", "Looked through the project's files"],
    ["done", "Read src/app.js"],
    ["done", "Searched the code for \"findme\""]
  ]);
  assert.deepEqual(engine.calls, [], "no worker was written to, started or created");
  const sent = JSON.stringify(gemini.chats().at(-1).body.contents);
  assert.match(sent, /const port = 3000/);
  assert.doesNotMatch(sent, /hunter2/);
});

test("a command waits for approval, runs in the private terminal, and its output is shown in the chat", async () => {
  const dir = project();
  const command = "node -e \"let n = 0; const t = setInterval(() => { n += 1; console.log('line ' + n); if (n === 12) clearInterval(t); }, 120)\"";
  const { ai, engine, gemini } = assistant(dir, [
    callTool("run_command", { command }),
    say("The script printed twelve lines.")
  ]);
  await ai.refreshMissionModels();
  const published = [];
  ai.on("conversation", payload => published.push(JSON.parse(JSON.stringify(payload.conversation))));

  const paused = await ai.send({ conversationId: "workspace:acme", surface: "workspace", text: "run the script" });
  assert.deepEqual(paused.pending.actions.map(action => [action.tool, action.title, action.detail, action.code, action.risk]), [
    ["run_command", "Run in a private terminal", command, true, "high"]
  ]);
  assert.equal(engine.calls.length, 0);

  const done = await ai.resolve({ conversationId: "workspace:acme", decision: "approve" });
  const step = done.messages.at(-1).activity[0];
  assert.equal(step.state, "done");
  assert.equal(step.label, `Ran ${command.length > 72 ? `${command.slice(0, 71)}…` : command}`);
  assert.equal(step.command, command);
  assert.equal(step.exitCode, 0);
  assert.match(step.output, /line 1\n[\s\S]*line 12$/);
  assert.equal(done.messages.at(-1).text, "The script printed twelve lines.");
  assert.deepEqual(engine.calls, [], "the operator's terminals were never typed into");

  // While it ran, the chat was shown what it printed so far.
  const live = published.map(conversation => conversation.messages.at(-1)?.activity?.[0]).filter(item => item?.state === "running");
  assert.ok(live.some(item => item.label.startsWith("Running node -e")), "the step says what is running");
  assert.ok(live.some(item => /line \d/.test(item.output || "")), "output arrives before the command ends");

  const answered = JSON.stringify(gemini.chats().at(-1).body.contents.at(-1));
  assert.match(answered, /"exitCode":0/);
  assert.match(answered, /line 12/);
});

test("Stop ends an approved command and the turn with it", async () => {
  const dir = project();
  const { ai, gemini } = assistant(dir, [callTool("run_command", { command: lingering, timeout_seconds: 120 })]);
  await ai.refreshMissionModels();
  await ai.send({ conversationId: "stop-me", text: "keep something running" });
  const resolving = ai.resolve({ conversationId: "stop-me", decision: "approve" });
  const pidFile = path.join(dir, "pid.txt");
  await waitFor(() => fs.existsSync(pidFile) && fs.readFileSync(pidFile, "utf8"), 15_000, "the command to start");
  ai.cancel("stop-me");
  const stopped = await resolving;
  const reply = stopped.messages.at(-1);
  assert.equal(reply.error, "Stopped.");
  assert.equal(reply.activity[0].state, "failed");
  assert.equal(reply.activity[0].detail, "Stopped before it finished");
  assert.equal(stopped.busy, false);
  assert.equal(gemini.chats().length, 1, "the model was not asked to go on");
  await waitFor(() => !alive(Number(fs.readFileSync(pidFile, "utf8"))), 5000, "the stopped process to end");

  // The next message starts cleanly: the stopped turn is gone from what the
  // model is sent, so no tool result arrives without its answer.
  await ai.send({ conversationId: "stop-me", text: "hello" });
  const next = gemini.chats().at(-1).body.contents;
  assert.deepEqual(next.map(content => [content.role, content.parts[0].text]), [["user", "hello"]]);
});

test("the model is told to keep its own work out of the operator's terminals", async () => {
  const prompt = systemPrompt({ surface: "workspace", snapshot: "Project: acme", focused: "Web dev server", autoApprove: false, platform: "win32" });
  assert.match(prompt, /Your own workbench/);
  assert.match(prompt, /Never use the operator's terminals for your own work/);
  assert.match(prompt, /private terminal \(PowerShell, in the project folder\)/);
  assert.match(prompt, /Never run or type destructive commands/);
  assert.match(systemPrompt({ surface: "missionAi", snapshot: "", autoApprove: false, platform: "linux" }), /private terminal \(bash,/);
  // A model that cannot use tools is not told about tools it cannot call, and the phone cannot act at all.
  assert.doesNotMatch(systemPrompt({ surface: "missionAi", snapshot: "", autoApprove: false, toolsAvailable: false }), /Your own workbench/);
  assert.doesNotMatch(systemPrompt({ surface: "mobile", snapshot: "", readOnly: true }), /Your own workbench|run_command/);

  const byName = Object.fromEntries(TOOLS.map(tool => [tool.name, tool]));
  assert.equal(byName.run_command.kind, "action", "a command is approved before it runs");
  for (const name of ["list_files", "read_file", "search_files"]) assert.equal(byName[name].kind, "read");
  assert.match(byName.type_in_terminal.description, /only when they ask/);
  assert.match(byName.type_in_terminal.description, /For commands of your own, use run_command/);
  assert.match(byName.create_worker.description, /For a one-off command of your own, use run_command/);

  // The phone never gets a terminal of any kind, and gets the project's files
  // only when it may read terminal output.
  const dir = project();
  const { ai, gemini } = assistant(dir, [say("fine"), say("fine")]);
  await ai.refreshMissionModels();
  await ai.ask({ text: "status?" });
  await ai.ask({ text: "status?", allowTerminal: true });
  const [without, withTerminal] = gemini.chats().map(request => request.body.tools[0].functionDeclarations.map(tool => tool.name));
  assert.equal(without.some(name => ["list_files", "read_file", "search_files", "run_command"].includes(name)), false);
  assert.deepEqual(["list_files", "read_file", "search_files"].filter(name => withTerminal.includes(name)), ["list_files", "read_file", "search_files"]);
  assert.equal(withTerminal.includes("run_command"), false);
});

test("with no project open, the assistant says so instead of reading the app's own folder", async () => {
  const dir = project();
  const { ai } = assistant(dir, [callTool("read_file", { path: "src/app.js" }), say("Open a project first.")], { persistent: false });
  await ai.refreshMissionModels();
  const result = await ai.send({ conversationId: "no-project", text: "read app.js" });
  const step = result.messages.at(-1).activity[0];
  assert.equal(step.state, "failed");
  assert.match(step.detail, /Open a project folder first/);
});

// ------------------------------------------------------------------ surfaces

test("the chat shows a command's output under its step, and the app ends commands as it closes", () => {
  const read = rel => fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");
  const chat = read("src/groundstation/renderer/AssistantChat.jsx");
  assert.match(chat, /function CommandOutput\(\{ item \}\)/);
  assert.match(chat, /\{item\.command && \["running", "done", "failed"\]\.includes\(item\.state\) && <CommandOutput item=\{item\}\/>\}/);
  assert.match(chat, /<details className=\{`ai-run is-\$\{item\.state\}`\} open=\{running \|\| item\.state === "failed"\}>/);
  assert.match(chat, /className="ai-run__output"/);
  // The approval card and the activity trail are unchanged.
  assert.match(chat, /action\.code \? <code>\{action\.detail\}<\/code>/);
  assert.match(chat, /aria-label="What the assistant did"/);

  const surfaces = read("src/groundstation/renderer/redesign/surfaces.css");
  assert.match(surfaces, /^\.shell \.ai-run \{/m);
  assert.match(surfaces, /^\.shell \.ai-run__output \{[^}]*max-height: 220px;/m);
  assert.match(surfaces, /^\.shell \.ai-thread\.is-compact \.ai-run__output \{/m);
  const block = surfaces.slice(surfaces.indexOf(".shell .ai-run {"), surfaces.indexOf(".shell .ai-thread.is-compact .ai-run__output"));
  assert.doesNotMatch(block, /#[0-9a-f]{3,8}\b|rgba?\(|important/i, "tokens only");

  const main = read("src/groundstation/main/index.cjs");
  assert.equal((main.match(/aiAssistant\?\.dispose\(\);/g) || []).length, 2, "both shutdown paths end the assistant's commands");
});
