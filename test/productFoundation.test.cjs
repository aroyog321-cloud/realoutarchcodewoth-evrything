const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { performance } = require("node:perf_hooks");
const { EngineAPI } = require("../src/engine/index.cjs");
const { makeFakePtyFactory } = require("./fakePty.cjs");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("Groundstation exposes baseline screen-reader and keyboard navigation semantics", () => {
  const app = read("src/groundstation/renderer/App.jsx");
  const toasts = read("src/groundstation/renderer/ToastSystem.jsx");
  const html = read("src/groundstation/renderer/index.html");
  const css = read("src/groundstation/renderer/styles.css");

  assert.match(html, /<html lang="en">/);
  assert.match(app, /className="skip-link" href="#main-content"/);
  assert.match(app, /id="main-content" tabIndex="-1"/);
  assert.match(app, /aria-current=\{view === id \? "page"/);
  assert.match(app, /<nav className="top-navigation" aria-label="OUTARCH navigation">/);
  assert.match(app, /<aside className="app-sidebar" aria-label="Application sidebar">/);
  // A toast is not a dialog: it traps no focus and labels nothing, so claiming
  // alertdialog told assistive tech to expect one, and made every surface that
  // steps aside for a real dialog step aside for a notification. Measured on
  // 2026-09-12: one persistent toast disabled Alt F and Alt B and blanked the
  // whole in-app browser for as long as it was on screen.
  assert.match(toasts, /role=\{hasAction \|\| t\.type === "danger" \? "alert" : "status"\}/);
  assert.doesNotMatch(toasts, /"alertdialog"/);
  assert.match(toasts, /aria-live=\{t\.type === "danger" \? "assertive" : "polite"\}/);
  // T133/T142 — an action-bearing toast never auto-dismisses, and neither does
  // a failure: one the operator never saw is one they cannot act on. Escape
  // still closes a focused toast, so persistence is not a trap.
  assert.match(toasts, /const persistent = hasAction \|\| type === "danger";/);
  assert.match(toasts, /options\.duration \?\? \(persistent \? 0 : 4500\)/);
  assert.match(toasts, /event\.key === "Escape".*onDismiss\(t\.id\)/);
  assert.match(app, /aria-hidden="true" focusable="false"/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(forced-colors: active\)/);
});

test("Groundstation CSS preserves long translated text and narrow layouts", () => {
  const css = read("src/groundstation/renderer/styles.css");
  const main = read("src/groundstation/renderer/main.jsx");

  assert.match(main, /document\.documentElement\.lang = navigator\.language/);
  assert.match(css, /Long-text and localization resilience/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /word-break: break-word/);
  assert.match(css, /html:lang\(de\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
});

test("large-workspace renderer protections remain enabled", () => {
  const css = read("src/groundstation/renderer/styles.css");
  const state = read("src/groundstation/renderer/useMissionState.js");
  const terminal = read("src/groundstation/renderer/TerminalPane.jsx");

  assert.match(css, /content-visibility: auto/);
  assert.match(css, /contain: layout paint/);
  assert.match(state, /if \(refreshTimer\.current\) return/);
  assert.match(terminal, /cursorBlink: active/);
  assert.match(terminal, /requestAnimationFrame\(fitAndResize\)/);
  assert.match(terminal, /requestAction\("remove"\)/);
  assert.match(terminal, /<DropdownMenu\.Portal>/);
});

test("100-worker engine snapshot and structured evidence remain bounded", t => {
  const factory = makeFakePtyFactory();
  const api = new EngineAPI({ ptyFactory: factory, maxActivityEvents: 200 });
  t.after(() => api.dispose());
  const sessions = Array.from({ length: 100 }, (_, index) => ({ id: `profile-${index}`, name: `Profile worker ${index}`, command: "x", cwd: "." }));
  const started = performance.now();
  api.loadProject({ sessions });
  for (const pty of factory.instances) pty.emitData("24 passed, 0 failed\n");
  const state = api.getState();
  const durationMs = performance.now() - started;

  assert.equal(state.sessions.length, 100);
  assert.equal(state.sessions.every(session => session.evidence.tests.passed === 24), true);
  assert.equal(state.activity.events.length <= 50, true);
  assert.equal(durationMs < 5000, true, `100-worker profile took ${durationMs.toFixed(2)}ms`);
});

test("renderer production config splits terminal, desktop UI, operations, and integrations", () => {
  const config = read("vite.groundstation.config.mjs");
  for (const chunk of ["workspace-terminal", "vendor-desktop-ui", "feature-integrations", "feature-operations"]) assert.match(config, new RegExp(chunk));
  assert.match(config, /manualChunks\(id\)/);
});

test("polish: theme-aware color-scheme, local-only font CSP, keyboard-activatable timeline, reduced-motion (T128/T135/T160/T161)", () => {
  const html = read("src/groundstation/renderer/index.html");
  const prefs = read("src/groundstation/renderer/useInterfacePreferences.js");
  const app = read("src/groundstation/renderer/App.jsx");
  const reveal = read("src/groundstation/renderer/aiMarkdown.jsx");
  const thread = read("src/groundstation/renderer/AssistantChat.jsx");
  const motion = read("src/groundstation/renderer/useReducedMotion.js");

  // T161 — no external font origins remain (fonts are @fontsource-variable, bundled).
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.doesNotMatch(html, /rel="preconnect"/);

  // T160 — document color-scheme follows the active theme.
  assert.match(prefs, /document\.documentElement\.style\.colorScheme = scheme;/);
  assert.match(prefs, /preferences\.theme === "solar" \? "light" : "dark"/);

  // T128 — history timeline items activate with Space as well as Enter and expose a role.
  assert.match(app, /role="button" aria-pressed=\{selected\?\.sequence === event\.sequence\}/);
  assert.match(app, /keyEvent\.key === "Enter" \|\| keyEvent\.key === " "/);

  // T135 — the Mission AI reveal honours reduced motion (OS or in-app), not just CSS.
  assert.match(motion, /prefers-reduced-motion: reduce/);
  assert.match(motion, /\.shell\.motion-reduced/);
  assert.match(reveal, /const shouldAnimate = animate && !reducedMotion;/);
  // T134 — a revealed answer is marked busy while it is still arriving.
  assert.match(reveal, /aria-busy=\{streaming \|\| undefined\}/);
  // The conversation is a log. Replies land whole rather than being revealed
  // character by character, so what the log announces is a finished message.
  assert.match(thread, /className=\{`ai-thread \$\{compact \? "is-compact" : ""\}`\}\s*\n\s*role="log"/);
  assert.doesNotMatch(thread, /StreamingReveal/);
  // Working is announced as a status, separately from the answer itself.
  assert.match(thread, /className="ai-msg__thinking" role="status"/);
});

test("modal dialogs contain focus and return it on close (T127/T132)", () => {
  const app = read("src/groundstation/renderer/App.jsx");
  const dialog = read("src/groundstation/renderer/WorkerDialog.jsx");

  // T127 — WorkerDialog: focus escaping the dialog is pulled back, and close
  // returns focus to the invoking control or #main-content.
  assert.match(dialog, /document\.addEventListener\("focusin", onFocusIn\)/);
  assert.match(dialog, /if \(dialogRef\.current && !dialogRef\.current\.contains\(event\.target\)\)/);
  assert.match(dialog, /previousFocus && document\.contains\(previousFocus\) \? previousFocus : document\.getElementById\("main-content"\)/);
  assert.match(dialog, /<section ref=\{dialogRef\} tabIndex=\{-1\}/);

  // T132 — Quick Look: Escape closes it, Tab is contained, focus returns.
  assert.match(app, /function WorkerQuickLook\(\{ session, activity, onAction, onOpenTerminal, onClose \}\)/);
  assert.match(app, /if \(event\.key === "Escape"\) \{ event\.stopPropagation\(\); onClose\?\.\(\); return; \}/);
  assert.match(app, /<WorkerQuickLook session=[\s\S]{0,120}onClose=\{\(\) => setQuickLookId\(null\)\}/);
});

test("notification availability is read from the engine, never asserted by the renderer (T032/T033)", () => {
  const app = read("src/groundstation/renderer/App.jsx");
  const main = read("src/groundstation/main/index.cjs");
  const protocol = read("src/protocol/index.cjs");

  // T033 — delivery exists now, and it lives in the main process, which is the
  // only place that owns the OS notification surface and the window to focus.
  assert.match(main, /const \{ NotificationService \} = require\("\.\.\/\.\.\/service\/notificationService\.cjs"\);/);
  assert.match(main, /notifications = new NotificationService\(\{/);
  assert.match(main, /notifications\.start\(\);/);
  assert.match(main, /notifications\?\.stop\(\);/, "the notifier must be torn down on shutdown");
  // The renderer still never raises one itself; it can only read state and ask.
  assert.doesNotMatch(app, /new Notification\(/, "the renderer must not raise OS notifications directly");

  // The old hardcoded availability constant is gone. Whether this device can
  // notify is an engine fact, so a platform that cannot still says so honestly.
  assert.doesNotMatch(app, /NOTIFICATION_DELIVERY_AVAILABLE/);
  assert.match(app, /missionApi\(\)\.request\("notification\.status"\)/);
  assert.match(app, /const disabled = delivery\.loading \|\| !delivery\.available;/);
  // Unknown is not the same as unavailable — the first read has its own copy.
  assert.match(app, /Checking whether this device can show desktop notifications/);
  assert.match(app, /This device cannot show desktop notifications/);

  // Every control still carries the disabled flag; a disabled save is a no-op.
  assert.match(app, /const save = async next => \{\s*if \(disabled\) return;/);
  assert.match(app, /role="radio" aria-checked=\{policy\.minimumSeverity === value\} disabled=\{disabled\}/);
  assert.match(app, /<input type="checkbox" disabled=\{disabled\} checked=\{policy\.desktopNotifications\}/);
  assert.match(app, /<input type="time" disabled=\{disabled\} aria-label="Quiet hours start time"/);

  // T037 — the diagnostic and its persistent result.
  assert.match(app, /missionApi\(\)\.request\("notification\.test"\)/);
  assert.match(app, /className="notification-diagnostic"/);
  assert.match(app, /notification-test-result/);
  assert.doesNotMatch(app, /toast\.(?:success|info|danger)\(.{0,40}test notification/i, "the test result must persist, not vanish in a toast");

  // T036 — a click deep-links instead of just focusing whatever was open.
  assert.match(app, /message\?\.type !== "notification:activate"/);
  assert.match(app, /if \(message\.sessionId\) setSelectedWorker\(message\.sessionId\);/);
  assert.match(protocol, /type: "notification:activate"/);

  // Both methods are on the public allowlist and behind the capability contract.
  assert.match(protocol, /"notification\.status",/);
  assert.match(protocol, /"notification\.test",/);
  assert.match(protocol, /\{ id: "notifications", service: notifications,/);
});

test("final shutdown keeps IPC available until every renderer is gone", () => {
  const main = read("src/groundstation/main/index.cjs");
  const shutdown = main.slice(main.indexOf("async function shutdownAndClose"), main.indexOf("async function start"));

  assert.match(shutdown, /window\.destroy\(\);/);
  assert.doesNotMatch(shutdown, /ipcHost\?\.dispose\(\)/);
  assert.doesNotMatch(main, /app\.on\("will-quit"[\s\S]{0,120}ipcHost\?\.dispose\(\)/);
});

test("Electron window and auxiliary IPC retain the production trust boundary", () => {
  const main = read("src/groundstation/main/index.cjs");

  assert.match(main, /contextIsolation: true/);
  assert.match(main, /nodeIntegration: false/);
  assert.match(main, /sandbox: true/);
  assert.match(main, /setWindowOpenHandler\(\(\) => \(\{ action: "deny" \}\)\)/);
  assert.match(main, /will-attach-webview", event => event\.preventDefault\(\)/);
  assert.match(main, /function assertTrustedMainFrame\(event\)/);
  assert.match(main, /event\?\.sender !== mainWindow\.webContents/);
  assert.match(main, /event\.senderFrame !== event\.sender\.mainFrame/);
  assert.match(main, /Only http, https, and mailto URLs are allowed/);
});

// T107 / T151 — one accessible tab implementation, and no surface that claims
// to be a tab widget without being one.
test("tab widgets implement the full ARIA tabs contract from one primitive", () => {
  const tabSet = read("src/groundstation/renderer/TabSet.jsx");
  const agents = read("src/groundstation/renderer/AgentWorkspace.jsx");
  const dialog = read("src/groundstation/renderer/WorkerDialog.jsx");

  // Roving tabindex: exactly one tab is in the tab order.
  assert.match(tabSet, /tabIndex=\{selected \? 0 : -1\}/);
  // Arrow keys move in both orientations, Home and End jump to the ends.
  assert.match(tabSet, /ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1/);
  assert.match(tabSet, /event\.key === "Home"/);
  assert.match(tabSet, /event\.key === "End"/);
  assert.match(tabSet, /\(index \+ keys\[event\.key\] \+ items\.length\) % items\.length/);
  // Focus follows selection so Tab leaves the tablist for the panel.
  assert.match(tabSet, /\.focus\(\);/);
  // Tabs and panels reference each other in both directions.
  assert.match(tabSet, /aria-controls=\{panelId\(group, tab\.value\)\}/);
  assert.match(tabSet, /"aria-labelledby": tabId\(group, value\)/);
  assert.match(tabSet, /role: "tabpanel"/);

  // Both real tab surfaces consume the primitive and label their panels.
  for (const [name, source] of [["AgentWorkspace", agents], ["WorkerDialog", dialog]]) {
    assert.match(source, /import TabSet, \{ tabPanelProps \} from "\.\/TabSet\.jsx";/, `${name} must use the shared primitive`);
    assert.match(source, /<TabSet\b/, `${name} must render the shared tablist`);
    assert.match(source, /tabPanelProps\(/, `${name} must give its panels the tabpanel contract`);
  }
  // Every one of the five Agents panels is a real tabpanel.
  for (const panel of ["summary", "plan", "history", "evidence", "approvals"]) {
    assert.ok(agents.includes(`tabPanelProps("agent-detail", "${panel}")`), `the ${panel} panel must carry the tabpanel contract`);
  }
});

test("no renderer surface claims tab semantics without tabpanels", () => {
  const rendererDir = path.join(root, "src", "groundstation", "renderer");
  for (const name of fs.readdirSync(rendererDir).filter(file => file.endsWith(".jsx"))) {
    if (name === "TabSet.jsx") continue;
    const source = fs.readFileSync(path.join(rendererDir, name), "utf8");
    assert.doesNotMatch(
      source,
      /role="tab(list)?"/,
      `${name} hand-builds a tab widget; use TabSet so the tabpanel, aria-controls and roving tabindex come with it`
    );
  }
  // The Mission AI mode switch is gone: asking a question and asking for work
  // are the same conversation, routed by the coordinator, so there is no widget
  // left to give tab or toggle semantics to.
  for (const name of ["MissionAI.jsx", "MissionAIScreen.jsx", "WorkspaceAssistant.jsx"]) {
    const source = fs.readFileSync(path.join(rendererDir, name), "utf8");
    assert.doesNotMatch(source, /aria-label="Mission AI mode"/, `${name} must not reintroduce a mode switch`);
  }
  for (const name of ["MissionAIScreen.jsx", "WorkspaceAssistant.jsx"]) {
    const source = fs.readFileSync(path.join(rendererDir, name), "utf8");
    assert.match(source, /useConversation\(/, `${name} sends through the one assistant conversation`);
  }
});
