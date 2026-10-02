"use strict";

// T005 — Failed-load reconciliation, pinned.
//
// MISSION_CONTROL_FAILED_LOAD_RECONCILIATION.md is the full finding. This locks
// the resource-state contract used by Automation, Agents, MCP, and Mobile:
// a failed request keeps last-known-good data and cannot render as a successful
// empty result or a fabricated zero count.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");

test("Automation distinguishes a failed automation.list from an empty list", () => {
  const src = read("src/groundstation/renderer/AutomationWorkflows.jsx");
  assert.match(src, /const \[loadError, setLoadError\] = React\.useState\(null\)/);
  // The failed branch keeps the last data (no setData in catch), renders its own
  // row, and permits an empty-state claim only after a verified successful read.
  assert.match(src, /setResourceState\(\{ loading: false, updatedAt: Date\.now\(\) \}\)/);
  assert.match(src, /setLoadError\(error instanceof Error \? error : new Error\(String\(error\)\)\)/);
  assert.match(src, /\{loadError && <div className="automation-load-error" role="status">/);
  assert.match(src, /loaded && !loadError \? <p>No workflows saved/);
  assert.match(src, /const controlsAvailable = loaded && !loadError/);
});

test("Mission AI and VS Code do not turn an unknown or stale status into a healthy claim", () => {
  const app = read("src/groundstation/renderer/App.jsx");
  const missionAi = read("src/groundstation/renderer/MissionAI.jsx");

  // Mission AI became a status panel on 2026-09-12. An unread status is still
  // neither "ready" nor "needs a model": it says it does not know.
  assert.match(missionAi, /!status \? \(error \? "Status unavailable" : "Checking…"\)/);
  assert.match(missionAi, /"Unknown - status could not be read"/);
  assert.match(missionAi, /Mission AI status could not be read\./);

  assert.match(app, /!statusKnown && resourceState\.loading \? "Checking status"/);
  assert.match(app, /!statusKnown && resourceState\.error \? "Status unavailable"/);
  assert.match(app, /resourceState\.error \? "Stale status"/);
  assert.match(app, /Connection state is unknown, so OUTARCH will not claim the bridge is ready or disconnected/);
  assert.match(app, /const controlsAvailable = statusKnown && !resourceState\.error/);
  assert.match(app, /statusKnown \? `\$\{diagnostics\.errors \|\| 0\} errors/);
});

test("Agents keeps the last mission list when mission.list fails", () => {
  const src = read("src/groundstation/renderer/AgentWorkspace.jsx");
  assert.match(src, /const \[missionsError, setMissionsError\] = React\.useState\(false\)/);
  assert.match(src, /setMissions\(Array\.isArray\(value\) \? value : \[\]\); setMissionsError\(false\)/);
  assert.match(src, /catch \{ setMissionsError\(true\); \}/);
  assert.doesNotMatch(src, /catch \{ setMissions\(\[\]\); \}/); // the old clobber is gone
  assert.match(src, /\{missionsError && <div className="agent-missions-stale" role="status">/);
});

test("the degraded-data banner is one shared grammar", () => {
  const css = read("src/groundstation/renderer/redesign/surfaces.css");
  assert.match(css, /\.history-memory-error,\s*\n#root#root \.shell \.automation-load-error,\s*\n#root#root \.shell \.agent-missions-stale,\s*\n#root#root \.shell \.integration-resource-notice \{/);
  assert.match(css, /\.integration-resource-empty \{/);
});

test("integration resources preserve last-known-good data and expose degraded state", () => {
  const mcp = read("src/groundstation/renderer/McpGateway.jsx");
  const mobile = read("src/groundstation/renderer/MobileCompanion.jsx");
  const agents = read("src/groundstation/renderer/AgentWorkspace.jsx");

  for (const source of [mcp, mobile]) {
    assert.match(source, /Promise\.allSettled\(/);
    assert.match(source, /className="integration-resource-notice" role="status"/);
    assert.match(source, /className="integration-resource-empty"/);
  }
  assert.match(mcp, /statusKnown \? String\(value \?\? 0\) : "—"/);
  assert.match(mcp, /auditUpdatedAt: auditResult\.status === "fulfilled" \? now : current\.auditUpdatedAt/);
  assert.doesNotMatch(mcp, /catch \{ setAudit\(\[\]\); \}/);
  assert.match(mobile, /devicesUpdatedAt: devicesResult\.status === "fulfilled" \? now : current\.devicesUpdatedAt/);
  assert.doesNotMatch(mobile, /mobile\.device\.list"\)\.then\(setDevices\)\.catch\(\(\) => \{\}\)/);
  // Agent approvals only flow through the unified decision broker.
  assert.doesNotMatch(agents, /setApprovals\(\[\]\); onPendingChange/);
});

test("integration overview and merged audit use service truth without hiding partial failure", () => {
  const overview = read("src/groundstation/renderer/IntegrationsView.jsx");
  const audit = read("src/groundstation/renderer/IntegrationAuditLog.jsx");

  assert.match(overview, /id === "mcp"[^\n]+value\?\.running/);
  assert.match(overview, /id === "companion"[^\n]+value\?\.running/);
  assert.doesNotMatch(overview, /value\?\.pluginCount/);
  assert.doesNotMatch(overview, /value\?\.installedCount/);
  assert.match(overview, /value: current\[id\]\?\.value, error: result\.error/);

  assert.match(audit, /const \[sourceRecords, setSourceRecords\]/);
  assert.match(audit, /if \(result\.status === "fulfilled"\) next\[sources\[index\]\[0\]\]/);
  assert.match(audit, /Audit history is incomplete\./);
  assert.match(audit, /No audit records are available from the sources that responded\./);
});
