"use strict";

/* 2026-09-21 production pass. Each defect here was found by linting the
   renderer or by rendering it offscreen (scripts/visual), then confirmed in the
   source before it was changed: copy buttons that called themselves, "now ago"
   and "0m ago" in time labels, a History header whose ACTORS count could never
   pass 8 and whose RISKS count disagreed with the engine summary beside it, a
   state refresh that could settle on a stale snapshot, an empty pane offering an
   empty menu, and a text caret that sat under its label. These lock the causes. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const renderer = path.resolve(__dirname, "../src/groundstation/renderer");
const read = file => fs.readFileSync(path.join(renderer, file), "utf8").replace(/\r\n/g, "\n");

// Pulls a top-level function out of a renderer file and runs it on its own.
function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  let depth = 0;
  for (let index = source.indexOf("{", start); index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${name} is not closed`);
}

function load(source, names, context = {}) {
  const sandbox = vm.createContext({ Date, Number, Math, String, ...context });
  vm.runInContext(names.map(name => extractFunction(source, name)).join("\n"), sandbox);
  return sandbox;
}

test("a copy button calls the clipboard helper, not itself", () => {
  // The local handler shared the imported helper's name, so `await copyText(text)`
  // called the handler again until the stack overflowed, and every copy of the
  // MCP token, a client's setup and the phone pairing code reported failure.
  for (const file of fs.readdirSync(renderer).filter(name => /\.jsx?$/.test(name))) {
    const source = read(file);
    if (!/import \{ copyText \} from "\.\/clipboard\.js";/.test(source)) continue;
    assert.doesNotMatch(source, /\b(?:const|let|var|function)\s+copyText\b/, `${file} redeclares copyText over the import`);
  }
  assert.match(read("McpGateway.jsx"), /const copyWithFeedback = async \(text, label\) => \{\n[\s\S]{0,120}await copyText\(text\);/);
  assert.match(read("MobileCompanion.jsx"), /const copyWithFeedback = async \(text, key\) => \{\n[\s\S]{0,120}await copyText\(text\);/);
});

test("time labels say \"just now\" and never \"now ago\" or \"0m ago\"", () => {
  const app = read("App.jsx");
  assert.doesNotMatch(app, /timeAgo\([^)]*\)\}? ago/, "an age with \" ago\" glued on prints \"now ago\"");
  const now = 1_800_000_000_000;
  const clock = { Date: { now: () => now } };
  const { ago, timeAgo } = load(app, ["timeAgo", "ago"], clock);
  assert.equal(ago(now - 5_000), "just now");
  assert.equal(ago(now - 50_000), "1m ago", "45 to 59 seconds floored to 0m");
  assert.equal(ago(now - 125_000), "2m ago");
  assert.equal(ago(now - 3 * 3_600_000), "3h ago");
  assert.equal(ago(undefined), "—");
  assert.equal(timeAgo(now - 50_000), "1m");

  const { age } = load(read("StatusBar.jsx"), ["age"], clock);
  assert.equal(age(now - 10_000), "just now");
  assert.equal(age(now - 50_000), "1m ago", "the status tape read \"Last signal 0m ago\"");

  const agents = load(read("AgentWorkspace.jsx"), ["timeAgo"], clock);
  assert.equal(agents.timeAgo(now - 50_000), "1m ago");
});

test("History counts every actor and counts risks the way the engine does", () => {
  const app = read("App.jsx");
  // The header read the display list, which shows eight actors until expanded.
  assert.match(app, /<small>ACTORS<\/small><strong>\{allActors\.length\}<\/strong>/);
  assert.match(app, /const failures = ordered\.filter\(isRiskEvent\);/);
  const { isRiskEvent } = load(app, ["isRiskEvent"]);
  // What the engine's own summary (projectMemory isFailureEvent) calls a failure.
  assert.equal(isRiskEvent({ type: "session:evidence", evidence: { failed: 1 } }), true);
  assert.equal(isRiskEvent({ type: "session:evidence", evidence: { health: "failed" } }), true);
  assert.equal(isRiskEvent({ type: "session:exit", exitCode: 1 }), true);
  assert.equal(isRiskEvent({ type: "session:exit", exitCode: 1, intentional: true }), false);
  // What the header already counted: decision outcomes a person must know about.
  assert.equal(isRiskEvent({ type: "decision", status: "denied" }), true);
  assert.equal(isRiskEvent({ type: "session:status", status: "running" }), false);
  assert.equal(isRiskEvent({ type: "session:evidence", evidence: { passed: 12, failed: 0 } }), false);
});

test("a state refresh asked for mid-flight runs once more instead of joining a stale one", () => {
  const hook = read("useMissionState.js");
  // The debounced refresh returned the request already out, whose snapshot could
  // predate the event that asked for it, and nothing asked again.
  assert.match(hook, /if \(refreshPromise\.current\) \{\n\s*refreshAgain\.current = true;\n\s*return refreshPromise\.current;/);
  assert.match(hook, /if \(refreshAgain\.current && mounted\.current && !refreshPromise\.current\) \{\n\s*refreshAgain\.current = false;\n\s*void refresh\(\);/);
});

test("an empty pane offers only what it can do", () => {
  const app = read("App.jsx");
  assert.match(app, /const hasWorkers = sessions\.length > 0;/);
  assert.match(app, /\{hasWorkers && <DropdownMenu\.Root><DropdownMenu\.Trigger asChild><button className="empty-pane-trigger">Choose existing <Chevron\/><\/button>/);
  assert.match(app, /"No workers yet\. Create one from a command you already run\."/);
});

test("menu carets are drawn, not typed", () => {
  // The down-arrowhead character sits on Inter's baseline and read as a stray mark.
  const caret = String.fromCharCode(0x2304);
  for (const file of fs.readdirSync(renderer).filter(name => /\.jsx$/.test(name))) {
    assert.ok(!read(file).includes(caret), `${file} still types the caret`);
  }
  assert.match(read("Chevron.jsx"), /<path d="m6 9 6 6 6-6"\/>/);
});

test("Needs You keeps its lifecycle help in the heading it explains", () => {
  const app = read("App.jsx");
  assert.match(app, /<span>Evidence → action → engine verification<\/span><details className="attention-lifecycle-bar">/);
  const css = read("redesign/screens.css");
  assert.match(css, /\.needs-decision-room \.decision-room-heading > span \{ margin-left: auto; \}/);
});

test("a saved recipe reopens on the strategy it was built with", async () => {
  const { pathToFileURL } = require("node:url");
  const { applyRecipeTemplate, matchRecipeTemplate } = await import(`${pathToFileURL(path.join(renderer, "recipeBuilderModel.js")).href}?match=${Date.now()}`);
  const steps = ["db", "api", "web"].map(workerId => ({ workerId, dependsOn: [] }));
  for (const id of ["sequential", "parallel", "verify"]) {
    assert.equal(matchRecipeTemplate(applyRecipeTemplate(id, steps)), id);
  }
  // Dependencies set worker by worker match no template.
  assert.equal(matchRecipeTemplate([{ workerId: "db", dependsOn: ["api"] }, { workerId: "api", dependsOn: [] }, { workerId: "web", dependsOn: ["api"] }]), "custom");
  assert.equal(matchRecipeTemplate([]), "custom");

  const builder = read("WorkspaceRecipes.jsx");
  assert.match(builder, /templateId: matchRecipeTemplate\(steps\),/);
  // The arrows in an ordered stack moved the number beside a worker but not its
  // dependency, so a worker could read "1 · Starts after" the one below it.
  assert.match(builder, /return templateId === "custom" \? next : applyRecipeTemplate\(templateId, next\);/);
  assert.match(builder, /\{templateId === "custom" && <p>Custom order: each worker below shows what it starts after\.<\/p>\}/);
});

test("the first-run card is aligned to one edge", () => {
  assert.match(read("redesign/surfaces.css"), /\.shell \.mc-gs-onboarding \{\n  display: grid;\n  justify-items: start;\n[\s\S]{0,200}text-align: start;/);
});
