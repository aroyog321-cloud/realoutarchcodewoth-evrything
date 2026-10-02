"use strict";

// Legal, privacy and data-transparency pass (2026-09-23).
//
// The policies are one data module shared by the desktop app and the website;
// every statement in them must match how OUTARCH behaves. These tests lock the
// wiring (first-launch agreement, Settings > Legal & privacy, website routes,
// phone Privacy & legal page) and the claims that were found to be false and
// corrected, so they cannot come back.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test } = require("node:test");
const zlib = require("node:zlib");

const root = path.join(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8").replace(/\r\n/g, "\n");
const POLICY_FILE = path.join(root, "src", "groundstation", "renderer", "legal", "outarchPolicies.js");
const loadPolicies = () => import(pathToFileURL(POLICY_FILE).href);

function policyText(policies) {
  return policies.POLICIES.map(policy => [policy.title, policy.summary, ...policy.sections.flatMap(section => [section.heading, ...section.blocks.flat()])].join("\n")).join("\n");
}

test("the website shows exactly the policy text the desktop app ships", () => {
  assert.equal(read("website", "src", "legal", "outarchPolicies.js"), read("src", "groundstation", "renderer", "legal", "outarchPolicies.js"), "run node scripts/sync-legal.cjs");
});

test("every policy is complete, uniquely routed and only uses the known placeholders", async () => {
  const policies = await loadPolicies();
  assert.match(policies.LEGAL_VERSION, /^\d{4}-\d{2}-\d{2}$/);
  const ids = policies.POLICIES.map(policy => policy.id);
  assert.deepEqual(ids, ["terms", "eula", "privacy", "ai-data", "ai-terms", "acceptable-use", "mobile", "cookies", "retention", "security", "subprocessors", "licenses"]);
  assert.equal(new Set(policies.POLICIES.map(policy => policy.path)).size, ids.length);
  for (const policy of policies.POLICIES) {
    assert.ok(policy.title && policy.summary && policy.sections.length, `${policy.id} is incomplete`);
    for (const section of policy.sections) assert.ok(section.heading && section.blocks.length, `${policy.id} has an empty section`);
  }
  for (const id of policies.AGREEMENT_POLICY_IDS) assert.ok(policies.policyById(id), `${id} is agreed to but missing`);
  const placeholders = new Set(policyText(policies).match(/\{[a-z]+\}/g));
  assert.deepEqual([...placeholders].sort(), ["{contact}", "{jurisdiction}", "{operator}"]);
  assert.equal(policies.fillPolicyText("{operator} / {contact}", { operator: "Acme", contact: "" }), "Acme / {contact}", "a missing value stays visible");
});

test("the policies make no compliance or absolute claims the code cannot back", async () => {
  const text = policyText(await loadPolicies());
  for (const claim of [/GDPR[- ]compliant/i, /DPDP[- ]compliant/i, /SOC ?2/i, /ISO ?27001/i, /\bcertified\b/i, /HIPAA/i, /never leaves your (device|computer)/i, /zero data/i, /100% (secure|private)/i, /bank[- ]grade/i, /military[- ]grade/i, /fully secure/i]) {
    assert.doesNotMatch(text, claim);
  }
  // Providers' training practices are not ours to promise either way.
  assert.doesNotMatch(text, /(do not|don't|never) train/i);
  assert.match(text, /including whether it keeps or trains on it\. We do not control this/);
  // No refund terms were added to the shared policies.
  assert.doesNotMatch(text, /refund/i);
});

test("the policies disclose what Mission AI, the VS Code bridge and the phone actually send", async () => {
  const text = policyText(await loadPolicies());
  // Mission AI's read tools run without approval and include terminal output and files.
  assert.match(text, /up to 120 recent lines/);
  assert.match(text, /Files that hold secrets \(such as \.env files, private keys and credential files\) are not read/);
  assert.match(text, /Always allow here/);
  // The VS Code extension does share terminal commands and output.
  assert.match(text, /commands run in VS Code terminals and what they print/);
  // Phone questions reach an AI provider through the desktop.
  assert.match(text, /Your computer sends the question to its AI provider/);
  // Conversations are not saved; ai_turns are deleted after two days.
  assert.match(text, /Mission AI conversations are kept in memory/);
  assert.match(text, /These records are deleted after two days/);
  // The facts behind these lines still hold in the code.
  assert.match(read("src", "service", "aiAssistant.cjs"), /name: "read_terminal_output",\n\s+kind: "read"/);
  assert.match(read("integrations", "vscode", "extension.cjs"), /execution\.read\(\)/);
  assert.match(read("supabase", "migrations", "20260919051512_outarch_entitlement_functions.sql"), /ai_turns t where t\.user_id = v_uid and t\.created_at < now\(\) - interval '2 days'/);
  assert.doesNotMatch(read("src", "service", "aiAssistant.cjs"), /writeFileSync\([^)]*messages/);
});

test("the cookie policy names exactly the browser storage the website uses, and the site loads no trackers", async () => {
  const text = policyText(await loadPolicies());
  const sessionKey = read("website", "src", "lib", "config.js").match(/SESSION_STORAGE_KEY = '([^']+)'/)[1];
  const currencyKey = read("website", "src", "lib", "currency.js").match(/const KEY = '([^']+)'/)[1];
  assert.match(text, new RegExp(`${sessionKey} \\(local storage\\)`));
  assert.match(text, new RegExp(`${currencyKey} \\(local storage\\)`));
  const html = read("website", "index.html");
  assert.doesNotMatch(html, /<script[^>]+src="https?:/i, "no third-party scripts in the page shell");
  const sources = fs.readdirSync(path.join(root, "website", "src"), { recursive: true }).filter(file => /\.(jsx?|html)$/.test(file)).map(file => read("website", "src", file)).join("\n");
  assert.doesNotMatch(sources, /googletagmanager|google-analytics|gtag\(|posthog|clarity\.ms|hotjar|fbq\(|document\.cookie/i);
});

test("the website routes and links every policy", async () => {
  const policies = await loadPolicies();
  const app = read("website", "src", "App.jsx");
  for (const policy of policies.POLICIES) {
    assert.ok(app.includes(`'${policy.path}': '${policy.title}'`), `${policy.path} is not routed with its title`);
  }
  assert.ok(app.includes("'/legal': 'Legal & privacy'"));
  const footer = read("website", "src", "components", "Footer.jsx");
  for (const to of ["/legal", "/terms", "/privacy", "/ai-data", "/cookies", "/security"]) assert.ok(footer.includes(`'${to}'`), `footer lacks ${to}`);
  const auth = read("website", "src", "pages", "AuthPage.jsx");
  assert.match(auth, /By creating an account you agree to the <a[^>]+href="\/terms"/);
  assert.match(auth, /href="\/privacy"/);
  assert.match(read("website", "src", "pages", "CheckoutPage.jsx"), /<Link to="\/privacy"/);
  assert.match(read("website", "src", "pages", "PricingPage.jsx"), /<Link to="\/terms"/);
  assert.match(read("website", "src", "sections", "Closing.jsx"), /By downloading and using OUTARCH you agree to the <Link to="\/terms"/);
  assert.match(read("website", "src", "sections", "Closing.jsx"), /<Link to="\/mobile-privacy"/);
  // A policy is taller than the screen, so its body must not sit behind an in-view reveal.
  assert.doesNotMatch(read("website", "src", "pages", "LegalPage.jsx"), /<Reveal[^>]*>\s*<div className="mt-6">/);
});

test("the navigation wordmark glitches all the time, and still respects reduced motion", () => {
  assert.match(read("website", "src", "components", "Nav.jsx"), /<Wordmark auto live /);
  assert.match(read("website", "src", "components", "Brand.jsx"), /live \? 'wordmark--live' : ''/);
  const css = read("website", "src", "index.css");
  assert.match(css, /\.wordmark--live \.wordmark__mint \{ animation: wm-live-mint [^;]*infinite; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{ animation-duration: \.001ms !important; animation-iteration-count: 1 !important;/);
});

test("the desktop app asks for agreement on first launch and records version and time in the main process", () => {
  const gate = read("src", "groundstation", "renderer", "AccountGate.jsx");
  const boundary = gate.slice(gate.indexOf("export function AccountBoundary("));
  assert.ok(boundary.indexOf("if (!legal.current) return <LegalAgreement") < boundary.indexOf("if (!status.authorized)"), "the agreement comes before sign-in");
  assert.match(gate, /I have read and agree to the Terms of service and the End user licence agreement/);
  assert.match(gate, /disabled=\{!agreed \|\| busy\}/, "agreeing takes a deliberate tick");
  const main = read("src", "groundstation", "main", "index.cjs");
  assert.match(main, /new LegalAcceptanceStore\(path\.join\(app\.getPath\("userData"\), "legal-acceptance\.json"\)/);
  assert.match(main, /ipcMain\.handle\("mission-control:legal", async \(event, request\) => \{\n\s+assertTrustedMainFrame\(event\);/);
  assert.match(read("src", "groundstation", "preload", "index.cjs"), /\n  legal,\n/);
});

test("the legal acceptance store keeps version, documents and time, and rejects anything else", () => {
  const { LegalAcceptanceStore } = require("../src/service/legalAcceptanceStore.cjs");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "outarch-legal-"));
  const file = path.join(dir, "legal-acceptance.json");
  const store = new LegalAcceptanceStore(file, { appVersion: "2.19.0", now: () => new Date("2026-09-23T10:00:00Z") });
  assert.deepEqual(store.status(), { acceptance: null });
  assert.throws(() => store.accept({ version: "latest", documents: ["terms"] }), /policy version/);
  assert.throws(() => store.accept({ version: "2026-09-23", documents: [] }), /name the documents/);
  assert.throws(() => store.accept({ version: "2026-09-23", documents: ["../etc"] }), /name the documents/);
  const { acceptance } = store.accept({ version: "2026-09-23", documents: ["terms", "eula"] });
  assert.deepEqual(acceptance, { version: "2026-09-23", acceptedAt: "2026-09-23T10:00:00.000Z", documents: ["terms", "eula"], appVersion: "2.19.0" });
  assert.deepEqual(new LegalAcceptanceStore(file).read(), acceptance, "it survives a restart");
  fs.writeFileSync(file, "{not json");
  assert.equal(store.read(), null, "a damaged record asks again rather than crashing");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("Settings has a Legal & privacy group, and Security no longer claims terminal output never reaches a model", () => {
  const app = read("src", "groundstation", "renderer", "App.jsx");
  assert.match(app, /\["legal", "Legal & privacy"\]/);
  assert.match(app, /group === "legal" && <LegalSettings\/>/);
  const legal = read("src", "groundstation", "renderer", "LegalDocuments.jsx");
  assert.match(legal, /POLICIES\.map\(policy => <li key=\{policy\.id\}>/);
  assert.match(legal, /Version agreed/);
  assert.match(legal, /Analytics and crash reports<\/span><strong>None are collected/);
  const security = app.slice(app.indexOf("function SecuritySettings("), app.indexOf("function ProjectDefaultSettings("));
  assert.doesNotMatch(security, /Never sent to a model/);
});

test("the phone companion has a Privacy & legal page and no longer says nothing goes through the cloud", () => {
  const page = read("src", "service", "mobileWebCompanion.html");
  assert.match(page, /function renderPrivacyTab\(\)/);
  assert.match(page, /onclick="switchTab\('privacy'\)"/);
  assert.match(page, /appState\.tab === "privacy" \? "settings"/);
  assert.doesNotMatch(page, /Nothing goes through the cloud/);
  assert.match(page, /Camera, microphone, location, contacts, photos and files, reading the clipboard, analytics, advertising, crash reporting and server push/);
  // The permissions it lists are the ones the Android client really declares.
  const manifest = read("mobile", "android", "app", "src", "main", "AndroidManifest.xml");
  const permissions = [...manifest.matchAll(/uses-permission android:name="android\.permission\.([A-Z_]+)"/g)].map(match => match[1]).sort();
  assert.deepEqual(permissions, ["INTERNET", "USE_BIOMETRIC"]);
  assert.match(manifest, /android:allowBackup="false"/);
});

test("the VS Code bridge package installs: forward-slash entries, OUTARCH name and icon, licence and changelog", () => {
  const { vsixManifest, zip, crc32 } = require("../scripts/package-vsix.cjs");
  const manifest = JSON.parse(read("integrations", "vscode", "package.json"));
  assert.equal(manifest.displayName, "OUTARCH Bridge");
  assert.equal(`${manifest.publisher}.${manifest.name}`, "mission-control.bridge", "the ID stays, so installed copies upgrade in place");
  assert.equal(manifest.capabilities.untrustedWorkspaces.supported, false);
  const xml = vsixManifest();
  assert.match(xml, /<DisplayName>OUTARCH Bridge<\/DisplayName>/);
  assert.match(xml, /<Icon>extension\/media\/outarch\.png<\/Icon>/);
  assert.match(xml, /Path="extension\/LICENSE\.md"/);
  assert.doesNotMatch(xml, /Mission Control/);
  // The zip writer stores names with forward slashes and valid CRCs.
  const data = Buffer.from("hello");
  const archive = zip([{ name: "extension/package.json", data }]);
  const nameLength = archive.readUInt16LE(26);
  assert.equal(archive.subarray(30, 30 + nameLength).toString(), "extension/package.json");
  assert.equal(archive.readUInt32LE(14), crc32(data));
  const compressedSize = archive.readUInt32LE(18);
  assert.equal(zlib.inflateRawSync(archive.subarray(30 + nameLength, 30 + nameLength + compressedSize)).toString(), "hello");
  for (const file of ["LICENSE.md", "CHANGELOG.md", manifest.icon]) assert.ok(fs.existsSync(path.join(root, "integrations", "vscode", file)), `${file} is missing`);
  // The release zip ships the freshly built extension instead of excluding every .vsix.
  assert.match(read("scripts", "release", "publish-release.cjs"), /const vsix = buildVsix\(\);/);
  assert.match(read("integrations", "vscode", "README.md"), /commands run in VS Code\s+terminals and what they print/);
});

test("secrets stay out of the repository", () => {
  const ignore = read(".gitignore");
  for (const rule of [".env", ".env.*", "!.env.example", "*.pem", "*.key", "credentials/", "secrets/", "supabase/.temp/"]) {
    assert.ok(ignore.split(/\r?\n/).includes(rule), `.gitignore lacks ${rule}`);
  }
  assert.doesNotMatch(read("src", "service", "missionAiBuiltinKeys.cjs"), /nvapi-[A-Za-z0-9_-]{30,}|AIza[0-9A-Za-z_-]{35}/);
  assert.ok(fs.existsSync(path.join(root, "SECURITY.md")));
  assert.ok(fs.existsSync(path.join(root, "THIRD_PARTY_LICENSES.md")));
  const pkg = JSON.parse(read("package.json"));
  assert.ok(pkg.files.includes("THIRD_PARTY_LICENSES.md"), "the licence list ships with the app");
});

test("the Android client compiles against the real APIs and keeps its credential out of backups", () => {
  const javaDir = path.join(root, "mobile", "android", "app", "src", "main", "java", "dev", "missioncontrol", "companion");
  const activity = fs.readFileSync(path.join(javaDir, "MainActivity.java"), "utf8");
  const transport = fs.readFileSync(path.join(javaDir, "CompanionTransport.java"), "utf8");
  assert.match(activity, /import android\.hardware\.biometrics\.BiometricPrompt;/);
  assert.doesNotMatch(transport, /JSONObject\.getNames/, "Android's org.json has no getNames");
  assert.match(transport, /if \(stream == null\) throw/);
  assert.match(read("mobile", "android", "app", "src", "main", "AndroidManifest.xml"), /android:dataExtractionRules="@xml\/data_extraction_rules"/);
  const rules = read("mobile", "android", "app", "src", "main", "res", "xml", "data_extraction_rules.xml");
  assert.match(rules, /<cloud-backup>[\s\S]*<exclude domain="sharedpref" \/>/);
  assert.match(rules, /<device-transfer>[\s\S]*<exclude domain="sharedpref" \/>/);
  assert.ok(fs.existsSync(path.join(root, "mobile", "android", "gradlew.bat")), "the project builds with its own Gradle wrapper");
});

test("the website account page lets people download their data, and offers no delete button", () => {
  const page = read("website", "src", "pages", "AccountPage.jsx");
  for (const table of ["profiles", "subscriptions", "usage_counters", "upgrade_requests", "payments"]) {
    assert.ok(page.includes(`'${table}'`), `the export leaves out ${table}`);
  }
  assert.match(page, /Download my data/);
  assert.doesNotMatch(page, /delete my account|Trash/i, "account deletion is handled by request, not from this page");
  assert.match(page, /<YourData entitlements=\{entitlements\}\/>/);
});

test("Keys & models tells people the built-in models run on free keys with per-minute limits", () => {
  const keys = read("src", "groundstation", "renderer", "AssistantKeys.jsx");
  const card = keys.slice(keys.indexOf('<h3 className="ai-keys__kicker">Mission AI</h3>'), keys.indexOf('<h3 className="ai-keys__kicker">Your keys</h3>'));
  assert.match(card, /<div className="ai-keys__limits" role="note" aria-label="Free-tier limits">/);
  assert.match(card, /Gemini allows about 10 to 15 requests a minute, and NVIDIA models about 40/);
  assert.match(card, /For higher limits, add your own key below\./);
  // Shown whether the keys are managed on the server or bundled, not inside one branch.
  assert.ok(card.indexOf("ai-keys__limits") > card.lastIndexOf("ai-keys__note"));
});
