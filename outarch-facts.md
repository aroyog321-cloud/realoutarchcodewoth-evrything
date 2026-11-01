# outarch-facts.md
# Single source of truth for all agents and prompts writing about Outarch.
# Edit this file; never duplicate it.

---

## Product
**Outarch** — outarch.com
Formerly called Mission Control.

---

## What it does
Outarch is a Windows desktop app that runs all your dev processes — servers, databases, containers, AI coding agents — in a tiled terminal cockpit and watches them for you. When something crashes, needs a decision, or requires approval, it surfaces exactly that with one-click fixes, so you stop reading logs and start shipping.

---

## Who it's for
A solo or small-team backend/fullstack developer who keeps 5–10 processes running while working: a dev server, a database, a test watcher, and one or more AI agents (Claude Code, Codex, Gemini CLI). They have too many terminal tabs and too little confidence that nothing has silently died.

---

## The problem, in the user's words
> "I have eight terminal tabs open and I spend half my day just checking if something crashed. Half the time my dev server died ten minutes ago and I didn't notice. And now I'm running Claude Code and I have no idea what it's actually doing or whether it's about to delete something."

---

## Price / free tier / trial

| Plan     | Price               | Hard limits                                                          |
|----------|---------------------|----------------------------------------------------------------------|
| Free     | $0                  | 3 terminals, 1 project, 3 Mission AI messages/day, no VS Code bridge |
| Pro      | ~$7.30/mo (₹700)    | 8 terminals, unlimited projects, MCP read-only, mobile companion     |
| Ultimate | ~$10.42/mo (₹1,000) | Unlimited terminals, full MCP, VS Code bridge, unlimited BYOK keys   |

Prepaid only — 1 month or 12 months, no auto-renewal. Annual is priced as 10 months.
Workspace Recipes has a built-in 3-day free trial on the Free plan.
The CLI (termctl) has no sign-in and no plan limits.

---

## 3 things it does better than alternatives

1. **Supervision by exception, not log noise.**
   Outarch classifies terminal streams in real time — crashes, port conflicts, test results, git state — and routes only things needing human judgment to a "Needs You" decision queue, with root-cause evidence and 1-click actions already attached. No other terminal tool does this.

2. **An actual control plane for AI agents.**
   It owns the PTY sessions that Claude Code, Codex, and Gemini CLI run inside. Every tool call goes through a local MCP gateway that holds execution and waits for your explicit approval before any file change or destructive command runs. You get a desktop notification with sound the moment an agent stops to ask — even when Outarch is in the background.

3. **DAG startup recipes with real readiness gates.**
   Define dependency-ordered boot stacks (Postgres → migrations → API → frontend) with port checks, HTTP health checks, and stdout regex gates. If step 3 fails, click Recover and only the failed steps re-run. No shell scripts, no guessing.

---

## Known competitors

- **Windows Terminal / iTerm2** — passive emulators, zero supervision
- **Warp** — AI autocomplete in a terminal, no process supervision or agent gating
- **tmux / Zellij** — tiling multiplexers, no intelligence layer
- **PM2** — Node process manager, CLI-only, no AI agent oversight
- **Cursor / VS Code terminal** — editor-integrated terminals, not a supervision engine

---

## 5 real things from building it
*(This section matters most. Use these details verbatim or close to it — they are what keep posts from reading like AI.)*

1. **The mobile pairing secret was leaking in a plaintext URL.**
   The crypto stack was real — X25519 key exchange, HKDF-SHA256, AES-256-GCM, biometric verification on Android. But the pairing code itself was being sent in a plaintext HTTP query string. The UI copy said it was never transmitted in plaintext. Both things were simultaneously true in the codebase.

2. **The Gemini and NVIDIA API keys were hardcoded in source and are now in git history forever.**
   They lived in src/service/missionAiBuiltinKeys.cjs. Anyone with a copy of the repo can run git show and read them. Moving keys to Supabase Edge Functions was the right fix and shipped in 2.19, but the old keys still need rotating at the provider — something easy to forget once the UI stops complaining.

3. **"Open in Browser" silently did nothing for months.**
   The feature used window.open, which Electron explicitly blocks in sandboxed renderers. The button was there, styled, and felt responsive. Nothing opened. It only surfaced during a full audit when someone traced the IPC call that never arrived.

4. **342 of 350 tests pass. Eight failures are real product defects, not flaky tests.**
   Broadcast Terminal and CrashLens Free Port call IPC methods that do not exist in the protocol. CrashLens reports a request as "queued" even when the underlying call failed. These are not edge cases — they are features on the marketing page.

5. **The CSS bundle hit 685 KB (111 KB gzip) because of competing design systems.**
   No single decision caused it. Multiple layout passes, overlapping utility layers, and one-off fixes accumulated over 2.x releases until every UI change required reconciling three different cascade systems. The renderer test suite now covers 96 route/theme/width combinations specifically because of this.

---

## What I want people to do
**Download and install the Windows app.** That is the primary action.

The conversion funnel is:
install → agent notification fires on first Claude Code run with zero setup → hit the 3-terminal or 1-project Free limit → upgrade to Pro.

Secondary: sign up on outarch.com to get a free account (required to use Mission AI and sync the plan across reinstalls).

---

*Last updated: October 2026. Source: codebase audit of OUTARCH 2.19.0, OUTARCH_ACCOUNTS_AND_UPDATES.md, FULL_CODEBASE_AUDIT_REPORT.md, information.md.*
