// What the live demo on the home page plays: one made-up project ("tidepool")
// with the kinds of workers people run in OUTARCH, and what each one prints.
// Nothing here talks to a real terminal. The flows mirror the app's: an agent
// stopping to ask permission, a crashed worker, failing tests, a recipe that
// starts workers in dependency order, and Mission AI proposing a fix that runs
// only after it is approved.

export const PROJECT = { name: 'tidepool', initial: 'T', path: 'D:\\work\\tidepool' };

// tone: '' plain, dim, ok, warn, err, info, ai, cmd, claude
const L = (text, tone = '') => ({ text, tone });

// group: the Workspace folder tab it sits under. link: the Groundstation role.
export const WORKERS = [
  { id: 'claude', name: 'Claude Code', cmd: 'claude', badge: 'AI AGENT', link: 'Agent', group: 'agents', kind: 'agent', start: 'running' },
  { id: 'web', name: 'Web dev server', cmd: 'npm run dev', badge: 'APP SERVICE', link: 'Service', group: 'services', kind: 'service', start: 'running', port: 5173 },
  { id: 'tests', name: 'Unit tests (watch)', cmd: 'npm run test:watch', badge: 'TEST FEEDBACK', link: 'Test watcher', group: 'tests', kind: 'test', start: 'running' },
  { id: 'queue', name: 'Queue worker', cmd: 'node worker.js', badge: 'SERVICE', link: 'Service', group: 'services', kind: 'service', start: 'failed' },
  { id: 'api', name: 'API gateway', cmd: 'node server.js', badge: 'APP SERVICE', link: 'Service', group: 'services', kind: 'service', start: 'running', port: 4000 },
  { id: 'shell', name: 'PowerShell', cmd: 'powershell.exe -NoLogo', badge: 'SHELL SESSION', link: 'Terminal', group: 'shells', kind: 'shell', start: 'running' },
  { id: 'db', name: 'Postgres', cmd: 'docker run -p 5432:5432 postgres:16', badge: 'CONTAINER', link: 'Container', group: 'containers', kind: 'service', start: 'idle', port: 5432 },
  { id: 'codex', name: 'Codex review', cmd: 'codex', badge: 'AI AGENT', link: 'Agent', group: 'agents', kind: 'agent', start: 'idle' },
  { id: 'e2e', name: 'E2E tests', cmd: 'npx playwright test', badge: 'TEST FEEDBACK', link: 'Test watcher', group: 'tests', kind: 'test', start: 'idle' },
  { id: 'git', name: 'git', cmd: 'git status', badge: 'SHELL SESSION', link: 'Git', group: 'git', kind: 'shell', start: 'idle' },
];

export const FOLDERS = [
  { id: 'all', label: 'All terminals' },
  { id: 'shells', label: 'Shell terminals' },
  { id: 'services', label: 'Service terminals' },
  { id: 'containers', label: 'Container terminals' },
  { id: 'tests', label: 'Test terminals' },
  { id: 'agents', label: 'AI agents' },
  { id: 'git', label: 'Git terminals' },
];

// Claude Code's welcome, drawn the way it appears in a terminal.
export const CLAUDE_WELCOME = [
  L(' ▐▛███▜▌   Claude Code v2.1.276', 'claude'),
  L('▝▜█████▛▘  Sonnet 4.5 · Claude Pro', 'claude'),
  L('  ▘▘ ▝▝    D:\\work\\tidepool', 'claude'),
  L(''),
];

// Opening lines already on screen when the demo appears.
export const BACKLOG = {
  claude: [...CLAUDE_WELCOME, L('> refactor the auth module to use zod schemas', 'cmd'), L('')],
  web: [L('> tidepool@1.8.0 dev', 'dim'), L('> vite --port 5173', 'dim'), L('')],
  tests: [L(' RUN  v3.2.4 D:/work/tidepool', 'info'), L('')],
  queue: [
    L('[queue] connecting to redis://localhost:6379', 'dim'),
    L('Error: connect ECONNREFUSED 127.0.0.1:6379', 'err'),
    L('    at TCPConnectWrap.afterConnect (node:net:1611:16)', 'dim'),
    L('Process exited with code 1', 'err'),
  ],
  api: [L('[api] loading .env (3 keys, values hidden)', 'dim')],
  shell: [L('Windows PowerShell', 'dim'), L('Type help to see what this demo shell understands.', 'dim'), L('')],
  db: [], codex: [], e2e: [], git: [],
};

// Scripts play one line per tick while the worker runs. A step can also be
// { prompt } (the agent stops and asks), { attention } (the test run needs a
// look), { done } (a one-shot job finished) or { loop } (repeat these lines).
export const SCRIPTS = {
  claude: [
    L('● Read(src/auth/session.ts)', 'ai'),
    L('  ⎿  Read 84 lines', 'dim'),
    L('● Read(src/auth/schema.ts)', 'ai'),
    L('  ⎿  Read 41 lines', 'dim'),
    L('● Update(src/auth/schema.ts)', 'ai'),
    L('  ⎿  Updated with 24 additions and 9 removals', 'dim'),
    L('● Bash(npm install zod@3)', 'ai'),
    { prompt: { command: 'npm install zod@3', why: 'Install zod for the new schemas', question: 'Do you want to proceed?' } },
    L('  ⎿  added 1 package in 2.1s', 'dim'),
    L('● Update(src/auth/middleware.ts)', 'ai'),
    L('  ⎿  Updated with 6 additions and 4 removals', 'dim'),
    L('● Bash(npm test -- auth)', 'ai'),
    L('  ⎿  14 passed', 'ok'),
    L(''),
    L('● Done. The auth module validates with zod now: 3 files changed, 1 package added.', 'ok'),
    { done: true, keepRunning: true },
  ],
  claudeDenied: [
    L('  ⎿  Not allowed. Stopping before installing anything.', 'warn'),
    L('● Edits so far are unstaged; nothing was installed.', 'ai'),
    { done: true, keepRunning: true },
  ],
  // What the demo's Claude Code answers when a visitor types into it.
  claudeTests: [
    L('● Bash(npm test -- auth)', 'ai'),
    L('  ⎿  1 failed, 13 passed', 'warn'),
    L('● Read(src/auth/session.ts)', 'ai'),
    L('  ⎿  Read 84 lines', 'dim'),
    L('● The failing test expects 401 for an expired token. verifyToken() checks the signature first and throws a 500. Checking expiry first fixes it.', 'ai'),
    { done: true, keepRunning: true },
  ],
  claudeExplain: [
    L('● Search(pattern: "zod", path: "src/auth")', 'ai'),
    L('  ⎿  Found 3 files', 'dim'),
    L('● The auth module now validates every request body with a zod schema (src/auth/schema.ts). Bad input returns 400 before it reaches a handler.', 'ai'),
    { done: true, keepRunning: true },
  ],
  claudeCommit: [
    L('● Bash(git add src/auth && git commit -m "auth: validate with zod")', 'ai'),
    L('  ⎿  [feature/auth-zod 4c1e2a9] auth: validate with zod', 'dim'),
    L('     3 files changed, 30 insertions(+), 13 deletions(-)', 'dim'),
    L('● Committed on feature/auth-zod.', 'ok'),
    { done: true, keepRunning: true },
  ],
  claudeGeneric: [
    L('● Read(package.json)', 'ai'),
    L('  ⎿  Read 46 lines', 'dim'),
    L('● On it. In OUTARCH this is the real Claude Code CLI, running in its own terminal. When it needs permission, OUTARCH rings and adds it to Needs You.', 'ai'),
    { done: true, keepRunning: true },
  ],
  web: [
    L('  VITE v6.1.0  ready in 412 ms', 'ok'),
    L(''),
    L('  ➜  Local:   http://localhost:5173/', 'info'),
    L('  ➜  Network: use --host to expose', 'dim'),
    { loop: [
      L('12:04:31 [vite] hmr update /src/routes/dashboard.tsx', 'dim'),
      L('GET /api/projects 200 in 18 ms'),
      L('12:04:48 [vite] page reload src/main.tsx', 'dim'),
      L('GET /api/projects/42/events 200 in 9 ms'),
    ] },
  ],
  api: [
    L('[api] connected to postgres at localhost:5432', 'dim'),
    L('[api] listening on http://localhost:4000', 'ok'),
    { loop: [
      L('POST /v1/sessions 201 34ms'),
      L('GET  /v1/projects 200 12ms'),
      L('GET  /v1/health 200 2ms', 'dim'),
      L('GET  /v1/projects/42 200 15ms'),
    ] },
  ],
  tests: [
    L(' ✓ src/api/projects.test.ts (12 tests) 38ms', 'ok'),
    L(' ✓ src/ui/chart.test.tsx (9 tests) 61ms', 'ok'),
    L(' ✓ src/queue/jobs.test.ts (22 tests) 104ms', 'ok'),
    L(' ✗ src/auth/session.test.ts > rejects expired tokens', 'err'),
    L('   → expected 401, received 500', 'err'),
    L(''),
    L(' Test Files  1 failed | 11 passed (12)', 'warn'),
    L('      Tests  1 failed | 84 passed (85)', 'warn'),
    { attention: 'Tests: 1 failed, 84 passed' },
    L(''),
    L(' Waiting for file changes...', 'dim'),
  ],
  testsFixed: [
    L(' RERUN  src/auth/session.ts changed', 'info'),
    L(' ✓ src/auth/session.test.ts (6 tests) 22ms', 'ok'),
    L(''),
    L(' Test Files  12 passed (12)', 'ok'),
    L('      Tests  85 passed (85)', 'ok'),
    L(''),
    L(' Waiting for file changes...', 'dim'),
    { done: true, keepRunning: true },
  ],
  queue: [
    L('[queue] connecting to redis://localhost:6379', 'dim'),
    L('[queue] connected, 3 jobs waiting', 'ok'),
    { loop: [
      L('[queue] job 812 send-digest done in 240ms'),
      L('[queue] job 813 resize-avatar done in 91ms'),
      L('[queue] idle, polling every 2s', 'dim'),
    ] },
  ],
  shell: [],
  git: [
    L('On branch feature/auth-zod'),
    L('Changes not staged for commit:', 'warn'),
    L('  modified:   src/auth/schema.ts', 'err'),
    L('  modified:   src/auth/session.ts', 'err'),
    { done: true },
  ],
  db: [
    L('PostgreSQL init process complete; ready for start up.', 'dim'),
    L('LOG:  listening on IPv4 address "0.0.0.0", port 5432', 'dim'),
    L('LOG:  database system is ready to accept connections', 'ok'),
    { loop: [L('LOG:  checkpoint complete: wrote 12 buffers (0.1%)', 'dim')] },
  ],
  codex: [
    L('>_ OpenAI Codex', 'info'),
    L('   directory: D:\\work\\tidepool', 'dim'),
    L(''),
    L('> review the diff on feature/auth-zod', 'cmd'),
    L('• Reading 3 changed files', 'ai'),
    L('• Checking the new schema against its call sites', 'ai'),
    L('  2 suggestions, 0 blocking issues', 'ok'),
    { done: true },
  ],
  e2e: [
    L('Running 18 tests using 4 workers', 'dim'),
    L('  ✓ sign in and open a project (2.4s)', 'ok'),
    L('  ✓ create an event from the dashboard (3.1s)', 'ok'),
    L('  18 passed (21.6s)', 'ok'),
    { done: true },
  ],
};

// A recipe starts workers in dependency order and waits for each one's
// readiness gate before starting what depends on it.
export const RECIPE = {
  id: 'release',
  name: 'Release check',
  description: 'Postgres first, then the review and the end-to-end suite side by side.',
  parallel: 2,
  steps: [
    { workerId: 'db', after: [], gate: 'port 5432 open' },
    { workerId: 'codex', after: ['db'], gate: 'review finished' },
    { workerId: 'e2e', after: ['db'], gate: 'tests passed' },
  ],
};

export const LAYOUTS = [
  { id: '1', label: '1', panes: 1 },
  { id: '1x2', label: '1×2', panes: 2 },
  { id: '2x1', label: '2×1', panes: 2 },
  { id: '2x2', label: '2×2', panes: 4 },
  { id: '3x2', label: '3×2', panes: 6 },
];

export const DEFAULT_PANES = ['claude', 'web', 'tests', 'queue', 'api', 'shell'];

export const GOALS = [
  { id: 'approve', label: "Allow Claude Code's request" },
  { id: 'restart', label: 'Restart the crashed worker' },
  { id: 'recipe', label: 'Launch the Release check recipe' },
  { id: 'ai', label: 'Ask Mission AI about the failing test' },
];

export const AI_SUGGESTIONS = [
  { id: 'running', text: "What's running right now, and is anything unhealthy?" },
  { id: 'failed', text: 'Why did my last failed worker stop?' },
  { id: 'ports', text: 'Which local servers are up, and on which ports?' },
  { id: 'idle', text: "Start everything that's idle" },
];

// The four columns Needs You shows for every decision.
export const NEED_COLUMNS = {
  permission: {
    label: 'Agent',
    evidence: 'Stopped at Bash(npm install zod@3) and is waiting for an answer.',
    impact: 'Adds one package to package.json and node_modules.',
    recommended: 'Allow once if the refactor needs zod; deny to keep dependencies as they are.',
    recovery: 'Denying stops the agent before it installs anything.',
  },
  failure: {
    label: 'Worker',
    evidence: 'Error: connect ECONNREFUSED 127.0.0.1:6379',
    impact: 'Jobs wait in the queue while it is down.',
    recommended: 'Restart it once Redis is reachable.',
    recovery: 'Recovery appears only after the engine verifies it is running.',
  },
  tests: {
    label: 'Worker',
    evidence: 'session.test.ts > rejects expired tokens: expected 401, received 500',
    impact: 'The auth change is unverified until the suite is green.',
    recommended: 'Ask Mission AI for the cause before editing.',
    recovery: 'Clears on its own when the next run passes.',
  },
  plan: {
    label: 'Mission AI',
    evidence: 'verifyToken() checks the signature before the expiry.',
    impact: 'Edits src/auth/session.ts, then restarts Unit tests (watch).',
    recommended: 'Approve once to apply both steps in order.',
    recovery: 'The edit is an ordinary file change you can revert with Git.',
  },
  idle: {
    label: 'Mission AI',
    evidence: 'Asked to start every idle worker.',
    impact: 'Starts the idle workers listed, each in its own terminal.',
    recommended: 'Approve once to start them.',
    recovery: 'Stop any of them from its terminal or from Groundstation.',
  },
};

// Which reply the demo's Claude Code plays for what a visitor typed.
export function claudeScriptFor(input) {
  const lower = input.trim().toLowerCase();
  if (/test|fail|bug|fix|error/.test(lower)) return 'claudeTests';
  if (/commit|git|push/.test(lower)) return 'claudeCommit';
  if (/explain|what|how|why|zod|auth/.test(lower)) return 'claudeExplain';
  return 'claudeGeneric';
}

// What Claude Code's spinner says while each script is working.
export const CLAUDE_VERBS = { claude: 'Refactoring', claudeDenied: 'Stopping', claudeTests: 'Investigating', claudeExplain: 'Reading', claudeCommit: 'Committing', claudeGeneric: 'Thinking' };

// The small set of commands the demo PowerShell answers.
export function shellReply(input) {
  const command = input.trim();
  const lower = command.toLowerCase();
  if (!command) return [];
  if (lower === 'help') return [L('Try: git status, npm test, node -v, ls, whoami, cls', 'dim')];
  if (lower === 'git status') return [L('On branch feature/auth-zod'), L('Changes not staged for commit:', 'warn'), L('  modified:   src/auth/schema.ts', 'err'), L('  modified:   src/auth/session.ts', 'err'), L('  modified:   package.json', 'err')];
  if (lower === 'node -v' || lower === 'node --version') return [L('v22.12.0')];
  if (lower === 'npm test') return [L('> vitest run', 'dim'), L(' Test Files  12 passed (12)', 'ok'), L('      Tests  85 passed (85)', 'ok')];
  if (lower === 'ls' || lower === 'dir') return [L('    Directory: D:\\work\\tidepool', 'dim'), L('d----  src'), L('d----  tests'), L('-a---  package.json'), L('-a---  termctl.config.json'), L('-a---  vite.config.ts')];
  if (lower === 'whoami') return [L('dev-laptop\\you')];
  if (lower === 'outarch' || lower === 'outarch --help') return [L('OUTARCH runs this shell. Every pane is a real terminal in the app.', 'info')];
  return [L(`${command.split(/\s+/)[0]}: not part of this demo. In OUTARCH this is a real PowerShell.`, 'warn')];
}
