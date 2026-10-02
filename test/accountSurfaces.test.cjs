"use strict";

// 2026-09-19 — accounts, plans, auto-update and agent permission notices.
// Locks the wiring that holds them together: OUTARCH opens nothing before the
// operator is signed in, no token reaches a renderer, a locked feature wears
// the crown and explains itself, and an agent's permission question becomes
// one notice with an "Open terminal" button that is taken back when answered.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { NotificationCenter, fromSemanticEvent } = require("../src/service/notificationCenter.cjs");

const root = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");
const renderer = rel => read(`src/groundstation/renderer/${rel}`);

test("the main process confirms the account before it opens a project", () => {
  const main = read("src/groundstation/main/index.cjs");
  const restore = main.indexOf("await accountService.restore();");
  const gate = main.indexOf("await accountService.whenAuthorized();");
  const open = main.indexOf("await engineHost.open(");
  assert.ok(restore > 0 && gate > restore && open > gate, "sign-in comes before the engine opens (and before any autoStart terminal)");
  assert.match(main, /registerDeepLinkProtocol\(\);/);
  assert.match(main, /app\.setAsDefaultProtocolClient\("outarch", process\.execPath, \[path\.resolve\(__filename\)\]\)/);
  assert.match(main, /filter\(argument => !isDeepLink\(argument, "outarch"\)\)/, "a sign-in link is not a Groundstation option");
  assert.match(main, /spawnGuard: \(\{ running \}\) => accountService\.entitlements\(\)\.checkRunTerminal\(running\)/);
  assert.match(main, /planGate: \{ entitlements: \(\) => accountService\.entitlements\(\) \}/);
  assert.match(main, /missionFetch: managedAiFetch/);
  assert.match(main, /accessLevel: \(\) => accountService\.entitlements\(\)\.mcpLevel\(\)/);
  assert.match(main, /isAllowed: \(\) => accountService\.entitlements\(\)\.limits\.mobileCompanion === true/);
  assert.match(main, /onTerminalInput: workerId => workspaceIntelligence\?\.noteInput\(workerId\)/);
  assert.match(main, /withdrawKind\(workerId, "agent\.awaitingApproval"\)/);
});

test("the preload exposes the account and the updater, and neither carries a token", () => {
  const preload = read("src/groundstation/preload/index.cjs");
  assert.match(preload, /const ACCOUNT_CHANNEL = "mission-control:account";/);
  assert.match(preload, /const UPDATE_CHANNEL = "mission-control:update";/);
  assert.match(preload, /account,\n  updates,/);
  assert.doesNotMatch(preload, /accessToken|refreshToken|refresh_token|access_token/);
  const service = read("src/service/accountService.cjs");
  const status = service.slice(service.indexOf("  status() {"), service.indexOf("  #isOffline()"));
  assert.doesNotMatch(status, /accessToken|refreshToken|#session/, "status() never includes the session");
});

test("no built-in AI key ships in the app", () => {
  const builtin = read("src/service/missionAiBuiltinKeys.cjs");
  for (const name of ["MISSION_AI_PRIMARY_KEY", "MISSION_AI_FALLBACK_KEY", "MISSION_AI_NVIDIA_PRIMARY_KEY", "MISSION_AI_NVIDIA_FALLBACK_KEY"]) {
    assert.match(builtin, new RegExp(`const ${name} = "";`));
  }
  assert.doesNotMatch(read("src/service/cloudConfig.cjs"), /service_role|sb_secret_/, "only the publishable key is in the app");
});

test("the renderer shows the sign-in screen until the account and the workspace are ready", () => {
  const app = renderer("App.jsx");
  assert.match(app, /return <AccountProvider><ToastProvider><AccountBoundary><GroundstationApp\/><\/AccountBoundary><\/ToastProvider><\/AccountProvider>;/);
  const gate = renderer("AccountGate.jsx");
  assert.match(gate, /if \(!status\.authorized\)/);
  assert.match(gate, /if \(!status\.engineReady\)/);
  assert.match(gate, /Sign in with your browser/);
  assert.match(gate, /Create an account/);
  assert.match(gate, /className="account-gate__drag"/, "the window can still be moved from the sign-in screen");
  assert.match(renderer("main.jsx"), /import "\.\/redesign\/account\.css";\n[\s\S]*import "\.\/redesign\/surfaces\.css";/);
});

test("a feature outside the plan wears the crown and opens the upgrade dialog", () => {
  const app = renderer("App.jsx");
  assert.match(app, /<UpgradeHost\/>/);
  assert.match(app, /isFeatureLocked\(account, "mcp"\)[\s\S]{0,40}<PlanLockPanel feature="mcp"/);
  assert.match(app, /isFeatureLocked\(account, "mobileCompanion"\)[\s\S]{0,40}<PlanLockPanel feature="mobileCompanion"/);
  assert.match(app, /isFeatureLocked\(account, "vscodeBridge"\)[\s\S]{0,40}<PlanLockPanel feature="vscodeBridge"/);
  assert.match(app, /\["account", "Account & plan"\]/);
  assert.match(app, /<SidebarAccountButton onOpen=\{onAccount\}\/>/);
  assert.match(renderer("missionApi.js"), /if \(error\.code === "PLAN_REQUIRED"\) \{[\s\S]{0,120}requestUpgrade\(/, "any refusal opens the upgrade dialog");
  assert.match(renderer("PlanLock.jsx"), /export function CrownIcon/);
  assert.match(renderer("StatusBar.jsx"), /<PlanTapeChip\/>/);
  assert.match(renderer("MissionAIScreen.jsx"), /<MissionAiAllowance\/>/);
  assert.match(renderer("RecipesView.jsx"), /<RecipePlanNote count=\{recipes\.length\}\/>/);
  assert.match(renderer("AssistantKeys.jsx"), /atKeyLimit\s*\n?\s*\? <PlanNote feature="byokKeys"/);
});

test("the upgrade dialog sits above its backdrop", () => {
  const css = renderer("redesign/account.css");
  assert.match(css, /\.plan-dialog-backdrop \{[^}]*z-index: 140;/);
  assert.match(css, /\.plan-dialog \{[^}]*z-index: 150;/);
});

test("About reports the updater and offers the update with a confirmation", () => {
  const settings = renderer("AccountSettings.jsx");
  assert.match(settings, /export function UpdatesPanel/);
  assert.match(settings, /title: `Restart to update to \$\{version\}\?`/);
  assert.match(settings, /Every update is signed by OUTARCH and verified before it installs\./);
});

test("an agent's permission question is one notice whose button opens that terminal", () => {
  const notice = fromSemanticEvent({ type: "agent.awaitingApproval", workerId: "claude", workerName: "Claude", data: { promptId: "p1", question: "Do you want to proceed?", agent: "claude" } });
  assert.equal(notice.kind, "agent.awaitingApproval");
  assert.equal(notice.title, "Claude is asking for your permission");
  assert.equal(notice.body, "Do you want to proceed?");
  assert.deepEqual(notice.actions.map(action => action.id), ["focus-worker"]);
  assert.equal(notice.actions[0].label, "Open terminal");

  const shown = [];
  const closed = [];
  class FakeNotification {
    constructor(options) { this.options = options; shown.push(this); }
    static isSupported() { return true; }
    on() {}
    show() {}
    close() { closed.push(this); }
  }
  const center = new NotificationCenter({ Notification: FakeNotification, platform: "win32", isAppFocused: () => false, mergeWindowMs: 0, getPreferences: () => ({ minimumSeverity: "info", desktopNotifications: true, sound: true, quietHours: { enabled: false } }) });
  const heard = [];
  center.on("notification", item => heard.push(item));
  center.publish(notice);
  assert.equal(shown.length, 1, "in the background it is a Windows notification");
  assert.match(shown[0].options.toastXml, /Open terminal/);
  // The app rings it the moment it arrives; the Windows toast is silent so it
  // does not ring a second time, late (operatorFixes0924).
  assert.match(shown[0].options.toastXml, /<audio silent="true"\/>/);
  assert.equal(heard[0].delivery.sound, "attention", "with sound");
  assert.equal(heard[0].delivery.soundBy, "app");
  assert.equal(heard[0].delivery.windows, true);

  // Answered: the toast is taken back, and the agent's next question notifies again.
  assert.equal(center.withdrawKind("claude", "agent.awaitingApproval"), 1);
  assert.equal(closed.length, 1);
  center.publish(fromSemanticEvent({ type: "agent.awaitingApproval", workerId: "claude", workerName: "Claude", data: { promptId: "p2", question: "Do you want to make this edit?" } }));
  assert.equal(shown.length, 2);
  center.dispose();
});

test("in the app the permission notice stays until answered and rings", () => {
  const app = renderer("App.jsx");
  assert.match(app, /notice\.kind === "agent\.awaitingApproval" \? 0 : TOAST_DURATION\[notice\.tone\]/);
  assert.match(app, /message\?\.type !== "agent:prompt-cleared"/);
  assert.match(app, /sound: delivery\.soundBy === "app" \? delivery\.sound : null/);
});
