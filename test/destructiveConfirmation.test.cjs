"use strict";

// T004 — Destructive-confirmation reconciliation, pinned.
//
// MISSION_CONTROL_DESTRUCTIVE_CONFIRMATION_RECONCILIATION.md is the prose
// finding. This now locks the repaired state: destructive renderer flows open
// the shared accessible ConfirmationDialog, then Protocol v1 issues a short-lived,
// exact-payload-bound token which is consumed once by the protected operation.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");

test("every destructive renderer flow opens a confirmation ceremony", () => {
  const app = read("src/groundstation/renderer/App.jsx");
  const agents = read("src/groundstation/renderer/AgentWorkspace.jsx");
  const automation = read("src/groundstation/renderer/AutomationWorkflows.jsx");

  // Recipe delete — pre-existing ConfirmationDialog.
  assert.match(app, /setConfirmation\(\{\s*title: `Delete \$\{recipe\.name\}\?`/);

  // Mission complete / cancel — ceremony added this batch, routed from App.
  assert.match(app, /<AgentWorkspace [^>]*onConfirm=\{setConfirmation\}/);
  assert.match(agents, /function AgentWorkspace\(\{[^}]*onConfirm[^}]*\}\)/);
  assert.match(agents, /const transitionMission = state => \{/);
  assert.match(agents, /confirmLabel: "Mark complete"/);
  assert.match(agents, /confirmLabel: "Cancel mission"/);
  assert.match(agents, /if \(!onConfirm\) return;\s*onConfirm\(\{ \.\.\.ceremony, run: apply \}\);/);

  // Automation remove — ceremony added this batch, routed from App.
  // Automation left the Integrations surface on 2026-09-12, so there is no
  // renderer flow to confirm any more. The component keeps its ceremony and the
  // Protocol keeps its confirmation gate, which is what actually protects the
  // operation — a workflow can still be deleted through the engine.
  assert.doesNotMatch(app, /<AutomationSettings/);
  assert.match(automation, /export function AutomationSettings\(\{ workspace, sessions, onConfirm \}\)/);
  assert.match(automation, /confirmLabel: "Remove workflow"/);
});

test("recipe deletion is protected by the same issued-token service", () => {
  const protocol = read("src/protocol/index.cjs");
  const app = read("src/groundstation/renderer/App.jsx");
  const block = protocol.slice(protocol.indexOf('case "recipe.delete":'), protocol.indexOf('case "recipe.run":'));
  assert.ok(block.length > 0, "recipe.delete case not found");
  assert.match(block, /requireConfirmation\("recipe\.delete", params\)/);
  assert.match(block, /engineApi\.deleteRecipe\(recipeId\)/);
  assert.match(app, /confirmedRequest\("recipe\.delete", \{ recipeId: recipe\.id \}\)/);
});

test("predictable renderer confirmation strings are gone and protected methods consume issued tokens", () => {
  const protocol = read("src/protocol/index.cjs");
  const rendererFiles = ["App.jsx", "AgentWorkspace.jsx", "AutomationWorkflows.jsx", "McpGateway.jsx", "MissionAI.jsx", "MobileCompanion.jsx", "useDecisions.js"]
    .map(file => read(`src/groundstation/renderer/${file}`)).join("\n");

  assert.doesNotMatch(protocol, /const expected = [`"]confirm:/);
  assert.doesNotMatch(rendererFiles, /["'`]confirm:/);
  assert.match(protocol, /crypto\.randomBytes\(32\)|randomBytes\(32\)/);
  assert.match(protocol, /CONFIRMATION_TTL_MS/);
  assert.match(protocol, /pendingConfirmations\.delete\(token\)/);
  assert.match(protocol, /record\.binding !== confirmationBinding\(method, params\)/);
  assert.match(protocol, /requireConfirmation\("automation\.delete", params\)/);
  assert.match(protocol, /requireConfirmation\("mission\.transition", params\)/);
});
