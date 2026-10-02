import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowSquareOut, ArrowsIn, ArrowsOutSimple, CaretDown, CornersOut, DotsSixVertical, DotsThree, Globe, MagnifyingGlass,
  Play, Plus, Power, Sparkle, SquaresFour, Stop, TerminalWindow,
} from '@phosphor-icons/react';
import { CLAUDE_VERBS, FOLDERS, LAYOUTS, PROJECT } from '../demoData.js';
import { claudeIdle, runtime, useDemo } from '../useDemo.js';
import { Dot } from './Groundstation.jsx';

const BADGE_CLASS = { agent: 'ws-badge--agent', test: 'ws-badge--test' };

function paneCount(layout) {
  return LAYOUTS.find(item => item.id === layout)?.panes || 4;
}

function ClaudePrompt({ worker }) {
  const { dispatch } = useDemo();
  const answer = allow => event => { event.stopPropagation(); dispatch({ type: 'ANSWER_PROMPT', workerId: worker.id, allow }); };
  return <div className="cc-box" role="group" aria-label={`${worker.name} permission prompt`}>
    <div className="cc-box__title">Bash command</div>
    <div className="cc-box__cmd">{worker.prompt.command}</div>
    <div className="cc-box__why">{worker.prompt.why}</div>
    <div className="cc-box__q">{worker.prompt.question}</div>
    <button type="button" className="cc-box__choice is-first" onClick={answer(true)}>❯ 1. Yes</button>
    <button type="button" className="cc-box__choice" onClick={answer(true)}>  2. Yes, and don't ask again for npm install commands</button>
    <button type="button" className="cc-box__choice" onClick={answer(false)}>  3. No, and tell Claude what to do differently (esc)</button>
  </div>;
}

// Claude Code as it looks in a terminal: its header stays at the top, the
// transcript scrolls, and the input sits at the bottom. A permission question
// takes the input's place, the way the CLI draws it.
function ClaudeTerminal({ worker }) {
  const { state, dispatch } = useDemo();
  const box = useRef(null);
  const stick = useRef(true);
  const [draft, setDraft] = useState('');
  useLayoutEffect(() => {
    const element = box.current;
    if (element && stick.current) element.scrollTop = element.scrollHeight;
  }, [worker.lines.length, worker.prompt]);
  const running = worker.status === 'running' || worker.status === 'waiting';
  const idle = claudeIdle(worker);
  const working = worker.status === 'running' && !idle;
  const seconds = Math.max(1, Math.round(((state.tick % 60) * 450) / 1000));
  const transcript = worker.lines.filter(item => item.tone !== 'claude');
  const send = event => {
    event.preventDefault();
    if (!draft.trim() || !idle) return;
    dispatch({ type: 'CLAUDE', text: draft });
    setDraft('');
    stick.current = true;
  };
  return <div className="cc-term">
    <div className="cc-head" aria-label="Claude Code">
      <span className="cc-head__logo" aria-hidden="true">✻</span>
      <span className="cc-head__text"><b>Claude Code</b> v2.1 · Sonnet 4.5 · <span>{PROJECT.path}</span></span>
      <span className="cc-head__tag">AI agent in OUTARCH</span>
    </div>
    <div ref={box} className="rx-term cc-log" data-lenis-prevent="" onScroll={event => { const element = event.currentTarget; stick.current = element.scrollHeight - element.scrollTop - element.clientHeight < 24; }}>
      {transcript.map((item, index) => <div key={index} className={`rx-term__line ${item.tone ? `t-${item.tone}` : ''}`}>{item.text || ' '}</div>)}
    </div>
    <div className="cc-dock">
      {worker.prompt ? <ClaudePrompt worker={worker}/> : running ? <>
        {working ? <div className="cc-spin"><span aria-hidden="true">✻</span>{CLAUDE_VERBS[worker.script] || 'Thinking'}… <small>({seconds}s · esc to interrupt)</small></div> : null}
        <form className="cc-input" onSubmit={send}>
          <span aria-hidden="true">&gt;</span>
          <input value={draft} onChange={event => setDraft(event.target.value)} disabled={!idle} aria-label="Type to Claude Code" placeholder={idle ? 'Try "why are the auth tests failing?"' : 'Claude is working…'} spellCheck={false} autoComplete="off" maxLength={200}/>
        </form>
        <div className="cc-foot">⏵⏵ accept edits off · ? for shortcuts</div>
      </> : null}
    </div>
  </div>;
}

function Terminal({ worker }) {
  const { dispatch } = useDemo();
  const box = useRef(null);
  const stick = useRef(true);
  const [draft, setDraft] = useState('');
  useLayoutEffect(() => {
    const element = box.current;
    if (element && stick.current) element.scrollTop = element.scrollHeight;
  }, [worker.lines.length, worker.prompt]);
  const shell = worker.kind === 'shell' && worker.status === 'running';
  const claude = worker.id === 'claude';
  return <div ref={box} className="rx-term" data-lenis-prevent="" onScroll={event => { const element = event.currentTarget; stick.current = element.scrollHeight - element.scrollTop - element.clientHeight < 24; }}>
    {worker.lines.map((item, index) => <div key={index} className={`rx-term__line ${item.tone ? `t-${item.tone}` : ''}`}>{item.text || ' '}</div>)}
    {worker.prompt ? <ClaudePrompt worker={worker}/> : null}
    {shell ? <form className="rx-shell" onSubmit={event => { event.preventDefault(); dispatch({ type: 'SHELL', workerId: worker.id, text: draft }); setDraft(''); stick.current = true; }}>
      <span>PS {PROJECT.path}&gt;</span>
      <input value={draft} onChange={event => setDraft(event.target.value)} aria-label={`Type into ${worker.name}`} placeholder="try: git status" spellCheck={false} autoComplete="off"/>
    </form> : null}
    {!shell && !claude && worker.status === 'running' ? <span className="rx-caret" aria-hidden="true"/> : null}
  </div>;
}

function IdleCard({ worker }) {
  const { dispatch } = useDemo();
  return <div className="ws-idle">
    <div>
      <strong><span><Power size={15}/></span>Not running</strong>
      <p>Starting it opens {worker.kind === 'shell' ? 'an interactive PowerShell in this project' : <>{worker.cmd} in this project</>}.</p>
      <button type="button" className="rx-btn rx-btn--primary" onClick={event => { event.stopPropagation(); dispatch({ type: 'START', workerId: worker.id }); }}><Play size={14} weight="fill"/>Start {worker.name}</button>
      <small>{worker.start === 'running' ? 'Starts automatically when this project opens.' : 'Starts when you choose, or when a recipe needs it.'}</small>
    </div>
  </div>;
}

function Banner({ worker }) {
  const { dispatch } = useDemo();
  if (worker.status === 'waiting') return <div className="ws-banner ws-banner--warn"><i/>Waiting for your answer · OUTARCH rang and added it to Needs You</div>;
  if (worker.status === 'failed') return <div className="ws-banner ws-banner--err"><i/>Process exited with code 1<button type="button" className="rx-btn rx-btn--xs" onClick={event => { event.stopPropagation(); dispatch({ type: 'RESTART', workerId: worker.id }); }}>Restart</button></div>;
  if (worker.attention) return <div className="ws-banner ws-banner--warn"><i/>{worker.attention}<button type="button" className="rx-btn rx-btn--xs" style={{ color: '#c9c9ff' }} onClick={event => { event.stopPropagation(); dispatch({ type: 'AI_ASK', topic: 'tests', text: 'Why are the tests failing?' }); }}><Sparkle size={12} weight="fill"/>Ask Mission AI</button></div>;
  if (worker.status === 'idle') return <div className="ws-banner"><i style={{ background: '#737373' }}/>Not running</div>;
  if (worker.status === 'done') return <div className="ws-banner"><i style={{ background: '#3291ff' }}/>Finished · exit code 0</div>;
  if (worker.lines.length < 2) return <div className="ws-banner"><i/>Running · no output reported yet</div>;
  return null;
}

function Pane({ worker, index, focused }) {
  const { state, dispatch } = useDemo();
  const live = worker.status === 'running' || worker.status === 'waiting';
  const showIdle = worker.status === 'idle' && worker.lines.filter(item => item.text.trim()).length === 0;
  return <section className={`ws-pane ${focused ? 'is-focused' : ''} ${worker.status === 'waiting' ? 'is-waiting' : ''}`} onPointerDown={() => { if (!focused) dispatch({ type: 'FOCUS', workerId: worker.id }); }} aria-label={`${worker.name} terminal`}>
    <header className="ws-pane__head">
      <Dot status={worker.status}/>
      <span className="ws-pane__name">{worker.name}<CaretDown size={10}/></span>
      <span className={`ws-badge ${BADGE_CLASS[worker.kind] || ''}`}>{worker.badge}</span>
      <span className="ws-pane__meta">{live ? `· ${runtime(state, worker)}` : worker.status === 'failed' ? 'failed' : 'idle'}</span>
      <div className="ws-pane__tools">
        <kbd>Alt {index + 1}</kbd>
        <button type="button" aria-label="Move pane"><DotsSixVertical size={14}/></button>
        <button type="button" className="ws-find" onClick={event => { event.stopPropagation(); dispatch({ type: 'TOAST', toast: { tone: 'info', title: `Find in ${worker.name}`, detail: 'Searches the whole scrollback, Ctrl F' } }); }}>Find</button>
        {live
          ? <button type="button" aria-label={`Stop ${worker.name}`} onClick={event => { event.stopPropagation(); dispatch({ type: 'STOP', workerId: worker.id }); }}><Stop size={13} weight="fill"/></button>
          : <button type="button" aria-label={`Start ${worker.name}`} style={{ color: '#32d583' }} onClick={event => { event.stopPropagation(); dispatch({ type: worker.status === 'idle' ? 'START' : 'RESTART', workerId: worker.id }); }}><Play size={13} weight="fill"/></button>}
        <button type="button" aria-label="More"><DotsThree size={16} weight="bold"/></button>
        <button type="button" aria-label="Pop out" onClick={event => { event.stopPropagation(); dispatch({ type: 'TOAST', toast: { tone: 'info', title: 'Pop-out window', detail: `${worker.name} opens in its own window, same terminal` } }); }}><ArrowSquareOut size={14}/></button>
        <button type="button" aria-label={state.focusMode ? 'Back to the grid' : `Focus ${worker.name}`} onClick={event => { event.stopPropagation(); dispatch({ type: 'FOCUS', workerId: worker.id }); dispatch({ type: 'FOCUS_MODE' }); }}>{state.focusMode ? <ArrowsIn size={14}/> : <ArrowsOutSimple size={14}/>}</button>
      </div>
    </header>
    <Banner worker={worker}/>
    {showIdle ? <IdleCard worker={worker}/> : worker.id === 'claude' ? <ClaudeTerminal worker={worker}/> : <Terminal worker={worker}/>}
  </section>;
}

export function WorkspaceView() {
  const { state, dispatch } = useDemo();
  const [find, setFind] = useState('');
  const workers = Object.values(state.workers);
  const count = paneCount(state.layout);
  let visible;
  if (state.focusMode) visible = [state.focused];
  else if (state.folder === 'all') visible = state.panes.filter(id => state.workers[id]).slice(0, count);
  else visible = workers.filter(worker => worker.group === state.folder).map(worker => worker.id).slice(0, count);
  const hidden = workers.filter(worker => !visible.includes(worker.id) && (!find || worker.name.toLowerCase().includes(find.toLowerCase())));
  const focused = state.workers[state.focused];
  const services = workers.filter(worker => worker.port && worker.status === 'running').length;
  const idleCount = workers.filter(worker => worker.status === 'idle').length;

  return <>
    <div className="ws-offcanvas">
      <span className="rx-caps">Not on the canvas</span>
      <span className="ws-count">{hidden.length} not mounted</span>
      {hidden.slice(0, 6).map(worker => <button key={worker.id} type="button" className="ws-chip" onClick={() => dispatch({ type: 'FOCUS', workerId: worker.id, show: true })}>
        <Dot status={worker.status}/>{worker.name}<small>{worker.status === 'running' ? 'live' : worker.status}</small>
      </button>)}
    </div>
    <div className="ws-toolbar">
      <span className="ws-toolbar__name">{focused ? <><Dot status={focused.status}/>{focused.name}</> : 'Workspace'}</span>
      <div className="ws-seg" role="group" aria-label="Layout">
        {LAYOUTS.map(layout => <button key={layout.id} type="button" aria-pressed={!state.focusMode && state.layout === layout.id} onClick={() => dispatch({ type: 'LAYOUT', layout: layout.id })}>{layout.label}</button>)}
      </div>
      <label className="rx-field"><MagnifyingGlass size={15}/><input value={find} onChange={event => setFind(event.target.value)} placeholder="Find a worker..." aria-label="Find a worker"/></label>
      <button type="button" className="rx-btn rx-btn--primary" onClick={() => dispatch({ type: 'ADD_WORKER' })}><Plus size={15} weight="bold"/>Add terminal worker</button>
      <button type="button" className="ws-iconbtn" aria-label="In-app browser" onClick={() => dispatch({ type: 'TOAST', toast: { tone: 'info', title: 'In-app browser', detail: 'Opens localhost pages beside your terminals, Alt B' } })}><Globe size={17}/></button>
      <button type="button" className="ws-iconbtn ws-iconbtn--ai" aria-label="Mission AI" onClick={() => dispatch({ type: 'NAV', route: 'ai' })}><Sparkle size={16} weight="fill"/></button>
      <button type="button" className="rx-btn rx-btn--link" onClick={() => dispatch({ type: 'NAV', route: 'recipes' })}><SquaresFour size={15}/>Recipes</button>
      <button type="button" className="rx-btn rx-btn--primary" disabled={!idleCount} onClick={() => dispatch({ type: 'START_IDLE' })}><Play size={13} weight="fill"/>Start idle</button>
      <button type="button" className="rx-btn rx-btn--warn" onClick={() => dispatch({ type: 'STOP_ALL' })}>Stop all</button>
      <button type="button" className="rx-btn" aria-pressed={state.focusMode} onClick={() => dispatch({ type: 'FOCUS_MODE' })}><CornersOut size={15}/>Focus</button>
    </div>
    <div className="ws-folders" role="group" aria-label="Terminal folders">
      {FOLDERS.map(folder => {
        const total = folder.id === 'all' ? workers.length : workers.filter(worker => worker.group === folder.id).length;
        if (!total) return null;
        return <button key={folder.id} type="button" className="ws-folder" aria-pressed={state.folder === folder.id} onClick={() => dispatch({ type: 'FOLDER', folder: folder.id })}>
          {folder.id === 'all' ? <SquaresFour size={15}/> : <TerminalWindow size={15}/>}{folder.label}<b>{total}</b>
        </button>;
      })}
      <button type="button" className="ws-folder ws-folder--new" onClick={() => dispatch({ type: 'TOAST', toast: { tone: 'info', title: 'New folder', detail: 'Group terminals your own way' } })}><Plus size={14} weight="bold"/>New folder</button>
    </div>
    <div className="ws-grid" data-layout={state.focusMode ? '1' : state.layout}>
      {visible.map((id, index) => <Pane key={id} worker={state.workers[id]} index={index} focused={state.focused === id}/>)}
      {!visible.length ? <div className="ws-empty">No terminals in this folder yet.</div> : null}
    </div>
    <div className="ws-bottom"><span>⌄ Services <b>{services}</b></span><span>⌄ Usage <b>-</b></span></div>
  </>;
}
