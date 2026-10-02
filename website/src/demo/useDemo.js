import { createContext, useContext } from 'react';
import { BACKLOG, DEFAULT_PANES, PROJECT, RECIPE, SCRIPTS, WORKERS, claudeScriptFor, shellReply } from './demoData.js';

// The demo's whole state and every way it changes. One tick is TICK_MS; each
// running worker prints at most one line per tick, so the panes read like
// real output rather than a wall of text.

export const TICK_MS = 450;
const MAX_LINES = 120;
const TOAST_TICKS = 16;

const line = (text, tone = '') => ({ text, tone });

function freshWorker(spec) {
  return {
    ...spec,
    status: spec.start,
    lines: [...(BACKLOG[spec.id] || [])],
    script: spec.start === 'running' ? spec.id : null,
    step: 0,
    loopAt: 0,
    prompt: null,
    attention: null,
    startedTick: spec.start === 'running' ? -120 : null,
  };
}

export function initialState() {
  const workers = Object.fromEntries(WORKERS.map(spec => [spec.id, freshWorker(spec)]));
  return {
    tick: 0,
    seq: 10,
    codes: { W: 1, A: 0, M: 0 },
    route: 'groundstation',
    layout: '2x2',
    panes: [...DEFAULT_PANES],
    folder: 'all',
    focused: 'claude',
    focusMode: false,
    selected: 'queue',
    inspector: true,
    gsFilter: 'all',
    gsQuery: '',
    stars: { web: true },
    workers,
    needs: [{ id: 'n-failure-queue', code: 'W01', kind: 'failure', workerId: 'queue', title: 'Queue worker needs a decision', tick: -40 }],
    resolved: [],
    needsTab: 'all',
    toasts: [],
    unread: 1,
    history: [
      { id: 'h1', tick: -40, tone: 'err', text: 'Queue worker exited with code 1', workerId: 'queue' },
      { id: 'h2', tick: -118, tone: 'ok', text: 'Web dev server is ready on port 5173', workerId: 'web' },
      { id: 'h3', tick: -119, tone: 'ok', text: 'API gateway is listening on port 4000', workerId: 'api' },
      { id: 'h4', tick: -120, tone: 'info', text: 'Workspace restored: 5 workers started', workerId: null },
      { id: 'h5', tick: -125, tone: 'info', text: `Opened project ${PROJECT.name}`, workerId: null },
    ],
    recipe: { status: 'ready', runs: 0, steps: RECIPE.steps.map(step => ({ ...step, state: 'waiting' })) },
    ai: { messages: [], proposed: false, fixed: false, auto: false },
    palette: false,
    goals: { approve: false, restart: false, recipe: false, ai: false },
    chime: 0,
    extra: 0,
  };
}

function nextId(state, prefix) {
  state.seq += 1;
  return `${prefix}${state.seq}`;
}

function log(state, tone, text, workerId = null) {
  state.history = [{ id: nextId(state, 'h'), tick: state.tick, tone, text, workerId }, ...state.history].slice(0, 80);
}

function toast(state, item) {
  const id = nextId(state, 't');
  state.toasts = [...state.toasts.filter(existing => !(item.key && existing.key === item.key)), { id, tick: state.tick, ...item }].slice(-3);
  if (item.tone === 'warn' || item.tone === 'err') state.unread += 1;
}

const CODE_PREFIX = { permission: 'A', failure: 'W', tests: 'W', plan: 'M', idle: 'M' };

function addNeed(state, need) {
  if (state.needs.some(item => item.id === need.id)) return;
  const prefix = CODE_PREFIX[need.kind] || 'W';
  state.codes[prefix] += 1;
  const code = `${prefix}${String(state.codes[prefix]).padStart(2, '0')}`;
  state.needs = [{ tick: state.tick, code, ...need }, ...state.needs];
}

function resolveNeed(state, id, outcome) {
  const need = state.needs.find(item => item.id === id);
  state.needs = state.needs.filter(item => item.id !== id);
  state.toasts = state.toasts.filter(item => item.needId !== id);
  if (need) state.resolved = [{ ...need, outcome, resolvedTick: state.tick }, ...state.resolved].slice(0, 12);
}

function append(worker, lines) {
  worker.lines = [...worker.lines, ...lines].slice(-MAX_LINES);
}

function startWorker(state, id, script = id, banner = null) {
  const worker = state.workers[id];
  worker.status = 'running';
  worker.script = script;
  worker.step = 0;
  worker.loopAt = 0;
  worker.prompt = null;
  worker.startedTick = state.tick;
  if (banner !== false) append(worker, [banner || line(`PS ${PROJECT.path}> ${worker.cmd}`, 'cmd')]);
}

function playWorker(state, worker) {
  const script = SCRIPTS[worker.script];
  if (!script || worker.status !== 'running') return;
  const step = script[worker.step];
  if (!step) return;
  if (step.loop) {
    // Services idle along at one line every few ticks.
    if ((state.tick + worker.id.length) % 4 !== 0) return;
    append(worker, [step.loop[worker.loopAt % step.loop.length]]);
    worker.loopAt += 1;
    return;
  }
  if (step.prompt) {
    worker.status = 'waiting';
    worker.prompt = step.prompt;
    const needId = `n-permission-${worker.id}`;
    addNeed(state, { id: needId, kind: 'permission', workerId: worker.id, title: `${worker.name} is asking for permission` });
    toast(state, { key: needId, needId, tone: 'warn', sticky: true, title: `${worker.name} is asking for permission`, source: 'tidepool', detail: step.prompt.command, workerId: worker.id, action: 'open' });
    log(state, 'warn', `${worker.name} asked to run ${step.prompt.command}`, worker.id);
    state.chime += 1;
    return;
  }
  if (step.attention) {
    worker.attention = step.attention;
    worker.step += 1;
    const needId = `n-tests-${worker.id}`;
    addNeed(state, { id: needId, kind: 'tests', workerId: worker.id, title: `${worker.name} needs a decision` });
    toast(state, { key: needId, needId, tone: 'err', title: `Unit tests: 1 failed, 84 passed`, detail: 'src/auth/session.test.ts', workerId: worker.id, action: 'ai' });
    log(state, 'warn', `${worker.name}: ${step.attention}`, worker.id);
    return;
  }
  if (step.done) {
    worker.step += 1;
    if (!step.keepRunning) {
      worker.status = 'done';
      worker.script = null;
      log(state, 'ok', `${worker.name} finished`, worker.id);
    }
    return;
  }
  append(worker, [step]);
  worker.step += 1;
}

function advanceRecipe(state) {
  const recipe = state.recipe;
  if (recipe.status !== 'running') return;
  for (const step of recipe.steps) {
    const worker = state.workers[step.workerId];
    if (step.state === 'waiting' && step.after.every(dep => recipe.steps.find(other => other.workerId === dep)?.state === 'ready')) {
      startWorker(state, step.workerId, step.workerId, line(`PS ${PROJECT.path}> ${worker.cmd}`, 'cmd'));
      step.state = 'starting';
      log(state, 'info', `${RECIPE.name}: started ${worker.name}`, worker.id);
    } else if (step.state === 'starting') {
      const ready = step.workerId === 'db' ? worker.step >= 3 : worker.status === 'done';
      if (ready) {
        step.state = 'ready';
        log(state, 'ok', `${RECIPE.name}: ${worker.name} ready (${step.gate})`, worker.id);
      }
    }
  }
  if (recipe.steps.every(step => step.state === 'ready')) {
    recipe.status = 'done';
    state.goals.recipe = true;
    toast(state, { tone: 'ok', title: `${RECIPE.name} finished`, detail: `${recipe.steps.length} of ${recipe.steps.length} workers ready` });
    log(state, 'ok', `${RECIPE.name} finished: every gate passed`);
  }
}

function idleWorkers(state) {
  return Object.values(state.workers).filter(worker => worker.status === 'idle' || worker.status === 'done');
}

function restart(state, id, how = 'RESTART') {
  const worker = state.workers[id];
  if (!worker || worker.status === 'waiting') return;
  let script = worker.id;
  if (worker.id === 'tests' && state.ai.fixed) script = 'testsFixed';
  if (worker.id.startsWith('extra')) script = 'shell';
  startWorker(state, worker.id, script, how === 'RESTART' ? line('── restarted by you ──', 'info') : line(`PS ${PROJECT.path}> ${worker.cmd}`, 'cmd'));
  worker.attention = null;
  resolveNeed(state, `n-failure-${worker.id}`, how === 'RESTART' ? 'Restarted' : 'Started');
  resolveNeed(state, `n-tests-${worker.id}`, 'Re-run');
  if (worker.id === 'queue') state.goals.restart = true;
  log(state, 'info', `You ${how === 'RESTART' ? 'restarted' : 'started'} ${worker.name}`, worker.id);
}

// What Mission AI says, read from the demo's own state so it stays true.
function aiAnswer(state, topic, text) {
  const workers = Object.values(state.workers);
  const live = workers.filter(worker => worker.status === 'running' || worker.status === 'waiting');
  const failed = workers.filter(worker => worker.status === 'failed');
  if (topic === 'tests') {
    if (state.ai.fixed) return { steps: ['Read Unit tests (watch) output'], text: 'The suite is green again: 85 of 85 tests pass since the fix you approved to src/auth/session.ts.' };
    return {
      steps: ['Read Unit tests (watch) output', 'Read src/auth/session.ts', 'Ran npm test -- auth in a private terminal'],
      text: 'One test fails: session.test.ts > "rejects expired tokens". It expects 401 but gets 500, because verifyToken() checks the signature before the expiry and the error handler turns that throw into a 500. Checking exp first returns the 401 the test expects.',
      action: state.ai.proposed ? null : { kind: 'plan', title: 'Fix the expiry check, then re-run tests', steps: ['Edit src/auth/session.ts: check exp before the signature', 'Restart Unit tests (watch)'] },
    };
  }
  if (topic === 'running') {
    const unhealthy = [...failed.map(worker => `${worker.name} stopped with an error`), ...workers.filter(worker => worker.status === 'waiting').map(worker => `${worker.name} is waiting for permission`), ...workers.filter(worker => worker.attention && worker.status === 'running').map(worker => `${worker.name}: ${worker.attention}`)];
    return { steps: ['Read Groundstation state'], text: `${live.length} of ${workers.length} workers are running: ${live.map(worker => worker.name).join(', ') || 'none'}.${unhealthy.length ? `\nNeeds attention:\n${unhealthy.map(item => `• ${item}`).join('\n')}` : '\nNothing looks unhealthy.'}` };
  }
  if (topic === 'failed') {
    const queue = state.workers.queue;
    if (queue.status !== 'failed') return { steps: ['Read History'], text: 'No worker is failing right now. The last failure was Queue worker, which you restarted; it has been running since.' };
    return {
      steps: ['Read Queue worker output', 'Checked port 6379'],
      text: 'Queue worker exited with code 1: it could not reach Redis at 127.0.0.1:6379 (ECONNREFUSED) when it started. Redis is listening now, so a restart should connect.',
      action: { kind: 'restart', workerId: 'queue', title: 'Restart Queue worker', steps: ['Restart Queue worker'] },
    };
  }
  if (topic === 'ports') {
    const servers = workers.filter(worker => worker.port && (worker.status === 'running' || worker.status === 'waiting'));
    return { steps: ['Read listening ports'], text: servers.length ? servers.map(worker => `• ${worker.name}: http://localhost:${worker.port}`).join('\n') : 'No local servers are listening right now.' };
  }
  if (topic === 'idle') {
    const idle = idleWorkers(state);
    if (!idle.length) return { steps: ['Read Groundstation state'], text: 'Every worker is already running.' };
    return { steps: ['Read Groundstation state'], text: `${idle.length} workers are idle.`, action: { kind: 'idle', title: `Start ${idle.length} idle workers`, steps: idle.map(worker => `Start ${worker.name}`) } };
  }
  return { steps: [], text: `In the app, Mission AI reads this workspace (workers, errors, Needs You, project memory) to answer "${text.slice(0, 60)}". This demo knows the four suggested questions.` };
}

function runAction(state, action) {
  if (action.kind === 'plan') {
    state.ai.fixed = true;
    log(state, 'ai', 'Mission AI edited src/auth/session.ts (approved by you)', 'tests');
    startWorker(state, 'tests', 'testsFixed', line('── file changed: src/auth/session.ts ──', 'info'));
    state.workers.tests.attention = null;
    resolveNeed(state, 'n-tests-tests', 'Fixed by Mission AI');
  } else if (action.kind === 'restart') {
    restart(state, action.workerId);
  } else if (action.kind === 'idle') {
    for (const worker of idleWorkers(state)) {
      if (worker.status === 'idle' || worker.status === 'done') restart(state, worker.id, 'START');
    }
  }
}

function settleAiAction(state, messageId, approve) {
  const message = state.ai.messages.find(item => item.id === messageId);
  if (!message?.action || message.action.status !== 'pending') return;
  message.action.status = approve ? 'approved' : 'rejected';
  resolveNeed(state, `n-ai-${messageId}`, approve ? 'Approved' : 'Rejected');
  if (message.action.kind === 'plan') state.ai.proposed = approve;
  if (approve) {
    runAction(state, message.action);
    state.ai.messages = [...state.ai.messages, { id: nextId(state, 'm'), tick: state.tick, role: 'ai', text: message.action.kind === 'plan' ? 'Done. verifyToken() checks exp first now, and Unit tests (watch) is re-running.' : 'Done.' }];
  } else {
    log(state, 'info', 'You rejected a Mission AI proposal');
    state.ai.messages = [...state.ai.messages, { id: nextId(state, 'm'), tick: state.tick, role: 'ai', text: 'Understood, nothing was changed.' }];
  }
}

export function reducer(previous, action) {
  const state = structuredClone(previous);
  switch (action.type) {
    case 'TICK': {
      state.tick += 1;
      for (const worker of Object.values(state.workers)) playWorker(state, worker);
      advanceRecipe(state);
      state.toasts = state.toasts.filter(item => item.sticky || state.tick - item.tick < TOAST_TICKS);
      return state;
    }
    case 'NAV':
      state.route = action.route;
      state.palette = false;
      if (action.route === 'needs') state.unread = 0;
      return state;
    case 'LAYOUT':
      state.layout = action.layout;
      state.focusMode = false;
      return state;
    case 'FOLDER':
      state.folder = action.folder;
      return state;
    case 'FOCUS': {
      state.focused = action.workerId;
      state.selected = action.workerId;
      if (action.show) {
        state.folder = 'all';
        const count = { 1: 1, '1x2': 2, '2x1': 2, '2x2': 4, '3x2': 6 }[state.layout] || 4;
        const at = state.panes.indexOf(action.workerId);
        if (at === -1 || at >= count) state.panes = [action.workerId, ...state.panes.filter(id => id !== action.workerId)];
        state.route = 'workspace';
      }
      return state;
    }
    case 'SELECT':
      state.selected = action.workerId;
      state.inspector = true;
      return state;
    case 'INSPECTOR':
      state.inspector = action.open;
      return state;
    case 'GS_FILTER':
      state.gsFilter = action.filter;
      return state;
    case 'GS_QUERY':
      state.gsQuery = action.query;
      return state;
    case 'STAR':
      state.stars[action.workerId] = !state.stars[action.workerId];
      return state;
    case 'FOCUS_MODE':
      state.focusMode = action.on ?? !state.focusMode;
      state.route = 'workspace';
      return state;
    case 'ANSWER_PROMPT': {
      const worker = state.workers[action.workerId];
      if (!worker?.prompt) return previous;
      append(worker, [line(action.allow ? '  ❯ 1. Yes' : '  ❯ 3. No, and tell Claude what to do differently', 'cmd')]);
      worker.prompt = null;
      worker.status = 'running';
      if (action.allow) {
        worker.step += 1;
        state.goals.approve = true;
        log(state, 'ok', `You allowed ${worker.name} to run npm install zod@3`, worker.id);
      } else {
        worker.script = 'claudeDenied';
        worker.step = 0;
        log(state, 'warn', `You denied ${worker.name}'s request`, worker.id);
      }
      resolveNeed(state, `n-permission-${worker.id}`, action.allow ? 'Allowed once' : 'Denied');
      return state;
    }
    case 'RESTART':
    case 'START':
      restart(state, action.workerId, action.type);
      return state;
    case 'STOP': {
      const worker = state.workers[action.workerId];
      if (!worker || !['running', 'waiting'].includes(worker.status)) return previous;
      worker.status = 'idle';
      worker.script = null;
      worker.prompt = null;
      append(worker, [line('Stopped by you. The process exited cleanly.', 'dim')]);
      resolveNeed(state, `n-permission-${worker.id}`, 'Stopped');
      log(state, 'info', `You stopped ${worker.name}`, worker.id);
      return state;
    }
    case 'START_IDLE': {
      const ids = (action.ids || idleWorkers(state).map(worker => worker.id));
      for (const id of ids) restart(state, id, 'START');
      if (ids.length) toast(state, { tone: 'ok', title: `Started ${ids.length} idle worker${ids.length === 1 ? '' : 's'}`, detail: ids.map(id => state.workers[id].name).join(', ') });
      return state;
    }
    case 'STOP_ALL': {
      const live = Object.values(state.workers).filter(worker => worker.status === 'running' || worker.status === 'waiting');
      for (const worker of live) { worker.status = 'idle'; worker.script = null; worker.prompt = null; append(worker, [line('Stopped by you. The process exited cleanly.', 'dim')]); resolveNeed(state, `n-permission-${worker.id}`, 'Stopped'); }
      if (live.length) { log(state, 'info', `You stopped ${live.length} workers`); toast(state, { tone: 'info', title: `Stopped ${live.length} workers`, detail: 'Every owned terminal exited cleanly' }); }
      return state;
    }
    case 'ADD_WORKER': {
      state.extra += 1;
      const id = `extra${state.extra}`;
      state.workers[id] = { id, name: `PowerShell ${state.extra + 1}`, cmd: 'powershell.exe -NoLogo', badge: 'SHELL SESSION', link: 'Terminal', group: 'shells', kind: 'shell', status: 'idle', lines: [], script: null, step: 0, loopAt: 0, prompt: null, attention: null, startedTick: null };
      state.panes = [id, ...state.panes];
      state.focused = id;
      state.route = 'workspace';
      state.folder = 'all';
      log(state, 'info', `You added ${state.workers[id].name}`, id);
      return state;
    }
    case 'ACK': {
      const need = state.needs.find(item => item.id === action.needId);
      if (!need) return previous;
      resolveNeed(state, need.id, action.outcome || 'Acknowledged');
      if (need.workerId && state.workers[need.workerId] && need.kind === 'tests') state.workers[need.workerId].attention = null;
      log(state, 'info', `${action.outcome || 'Acknowledged'}: ${need.title}`, need.workerId);
      return state;
    }
    case 'NEEDS_TAB':
      state.needsTab = action.tab;
      return state;
    case 'SEEN':
      state.unread = 0;
      return state;
    case 'LAUNCH_RECIPE': {
      if (state.recipe.status === 'running') return previous;
      state.recipe = { status: 'running', runs: state.recipe.runs + 1, steps: RECIPE.steps.map(step => ({ ...step, state: 'waiting' })) };
      for (const step of RECIPE.steps) {
        const worker = state.workers[step.workerId];
        if (worker.status === 'running' || worker.status === 'done') { worker.status = 'idle'; worker.script = null; }
      }
      toast(state, { tone: 'info', title: `${RECIPE.name} is starting`, detail: 'Workers start as their dependencies become ready' });
      log(state, 'info', `You launched the recipe ${RECIPE.name}`);
      return state;
    }
    case 'AI_AUTO':
      state.ai.auto = !state.ai.auto;
      return state;
    case 'AI_NEW':
      state.ai.messages = [];
      return state;
    case 'AI_ASK': {
      const question = action.text;
      state.ai.messages = [...state.ai.messages, { id: nextId(state, 'm'), tick: state.tick, role: 'user', text: question }];
      const answer = aiAnswer(state, action.topic, question);
      const id = nextId(state, 'm');
      const message = { id, tick: state.tick, role: 'ai', text: answer.text, steps: answer.steps || [] };
      if (answer.action) message.action = { ...answer.action, status: 'pending' };
      state.ai.messages = [...state.ai.messages, message];
      if (action.topic === 'tests') state.goals.ai = true;
      if (message.action) {
        if (message.action.kind === 'plan') state.ai.proposed = true;
        if (state.ai.auto) {
          settleAiAction(state, id, true);
        } else {
          addNeed(state, { id: `n-ai-${id}`, kind: message.action.kind === 'plan' ? 'plan' : message.action.kind === 'idle' ? 'idle' : 'failure', workerId: message.action.workerId || (message.action.kind === 'plan' ? 'tests' : null), title: `Mission AI plan: ${message.action.title}`, messageId: id });
          log(state, 'ai', `Mission AI proposed: ${message.action.title} (waiting for you)`);
        }
      }
      state.route = 'ai';
      return state;
    }
    case 'AI_SETTLE':
      settleAiAction(state, action.messageId, action.approve);
      return state;
    case 'DISMISS_TOAST':
      state.toasts = state.toasts.filter(item => item.id !== action.id);
      return state;
    case 'TOAST':
      toast(state, action.toast);
      return state;
    case 'PALETTE':
      state.palette = action.open;
      return state;
    case 'SHELL': {
      const worker = state.workers[action.workerId || 'shell'];
      if (!worker || worker.status !== 'running') return previous;
      if (['cls', 'clear'].includes(action.text.trim().toLowerCase())) { worker.lines = []; return state; }
      append(worker, [line(`PS ${PROJECT.path}> ${action.text}`, 'cmd'), ...shellReply(action.text)]);
      return state;
    }
    case 'CLAUDE': {
      // A visitor typed into the demo's Claude Code: echo it, then play a reply.
      const worker = state.workers.claude;
      const text = action.text.trim().slice(0, 200);
      if (!text || !worker || worker.status !== 'running' || !claudeIdle(worker)) return previous;
      append(worker, [line(''), line(`> ${text}`, 'cmd'), line('')]);
      worker.script = claudeScriptFor(text);
      worker.step = 0;
      return state;
    }
    case 'RESET':
      return initialState();
    default:
      return previous;
  }
}

export const DemoContext = createContext(null);
export function useDemo() {
  return useContext(DemoContext);
}

export function relativeTime(tickNow, tickThen, { short = false } = {}) {
  const seconds = Math.max(0, Math.round(((tickNow - tickThen) * TICK_MS) / 1000));
  if (short) return seconds < 60 ? 'now' : `${Math.floor(seconds / 60)}m`;
  if (seconds < 8) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

// Claude Code has finished its current script and is waiting at its input.
export function claudeIdle(worker) {
  const script = SCRIPTS[worker.script];
  return !script || worker.step >= script.length;
}

export function runtime(state, worker) {
  if (worker.startedTick == null || !['running', 'waiting'].includes(worker.status)) return '';
  const seconds = Math.round(((state.tick - worker.startedTick) * TICK_MS) / 1000);
  return seconds < 60 ? '<1m' : `${Math.floor(seconds / 60)}m`;
}

// Worker health numbers for the Groundstation table. The app samples real
// CPU and memory per process; the demo makes up steady, plausible ones.
export function health(state, worker) {
  if (!['running', 'waiting'].includes(worker.status)) return null;
  const seed = [...worker.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const cpu = ((seed * 7 + state.tick * 3) % 17) + (worker.kind === 'agent' ? 4 : 1);
  const mem = 60 + ((seed * 13) % 240) + (worker.kind === 'agent' ? 180 : 0);
  return { cpu, mem };
}

export function projectStatus(state) {
  const workers = Object.values(state.workers);
  if (workers.some(worker => worker.status === 'failed')) return { tone: 'bad', label: 'Degraded' };
  if (state.needs.length) return { tone: 'warn', label: 'Waiting on you' };
  return { tone: 'good', label: 'Healthy' };
}
