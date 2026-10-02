"use strict";

// 2026-09-19 - the permissioned plugin platform was removed from OUTARCH at the
// owner's request. Nothing may bring back its service, its protocol methods,
// its renderer surfaces or its decision source.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { METHODS } = require("../src/protocol/index.cjs");
const { buildDecisionQuery, CONFIRMED_SOURCES } = require("../src/protocol/decisionBroker.cjs");

const root = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");

test("no plugin service, renderer surface or stylesheet ships", () => {
  for (const rel of [
    "src/service/pluginPlatform.cjs",
    "src/service/pluginPlatformStore.cjs",
    "src/groundstation/renderer/PluginPlatform.jsx",
    "src/groundstation/renderer/PluginContributionSlot.jsx",
    "src/groundstation/renderer/pluginPlatform.css",
    "plugins/examples"
  ]) assert.equal(fs.existsSync(path.join(root, rel)), false, `${rel} must stay removed`);
  assert.doesNotMatch(read("src/groundstation/renderer/main.jsx"), /pluginPlatform\.css/);
  assert.doesNotMatch(read("package.json"), /plugins\/examples/);
});

test("the protocol, the main process and the decision queue carry no plugin source", async () => {
  assert.equal(METHODS.some(method => method.startsWith("plugin.")), false);
  assert.equal(CONFIRMED_SOURCES.has("plugin"), false);
  const query = await buildDecisionQuery({ engineApi: { listAttention: () => ({ records: [] }), listMissionApprovals: () => [], listAutomations: () => ({ approvals: [] }) }, missionSupervisor: { listApprovals: () => [] }, mcpGateway: { listApprovals: () => [] }, mobileCompanion: { listApprovals: () => [] } });
  assert.equal(query.complete, true, "no missing plugin source may mark the queue incomplete");
  assert.deepEqual(query.sources.map(source => source.id), ["session", "missionSupervisor", "mission", "mcp", "automation", "mobile"]);
  const main = read("src/groundstation/main/index.cjs");
  assert.doesNotMatch(main, /PluginPlatform|pluginPlatform/);
  assert.doesNotMatch(read("src/groundstation/main/ipcHost.cjs"), /pluginPlatform/);
  assert.doesNotMatch(read("src/engine/index.cjs"), /id: "plugins"/);
});

test("Integrations and Needs You no longer offer plugins", () => {
  const hub = read("src/groundstation/renderer/IntegrationsView.jsx");
  assert.doesNotMatch(hub, /id: "extensions"|plugin\.status/);
  assert.doesNotMatch(read("src/groundstation/renderer/IntegrationDiagnostics.jsx"), /plugin\.status/);
  assert.doesNotMatch(read("src/groundstation/renderer/IntegrationAuditLog.jsx"), /plugin\.audit\.list/);
  assert.doesNotMatch(read("src/groundstation/renderer/DecisionList.jsx"), /plugin:/);
  assert.doesNotMatch(read("src/groundstation/renderer/DecisionSourceStrip.jsx"), /plugin:/);
});
