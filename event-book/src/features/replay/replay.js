// ===========================================
// REPLAY - Scrub through how a model was built (SV: View Model At)
// A slider over the open model's history, one step per user action (the
// events of one batch, as Undo takes them back); ▶ plays it from the start.
// While scrubbing, everything reads the model as it was at that step, and the
// board is look-only. ✕ comes back to now.
// ===========================================

import { getEventStream, setReplayLimit, EventTypes } from '../../core/eventStore.js';
import { projectState, sliceTitle } from '../../core/projections.js';
import { render, showSliceOnBoard, getView } from '../../ui/feed.js';
import { isChapterFolded } from '../board/view.js';
import { showToast } from '../../ui/toast.js';

let steps = [];      // [{ end, events }] end = how many events the model has after this step
let at = 0;          // the step shown
let events = [];
let timer = null;

const label = type => type.replace(/(?<=[a-z0-9])(?=[A-Z])/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase());

// One step per batch (a user action), in order. A batch that builds a lot at once (an
// import, a script, an agent's call) is split at each new slice, scenario and chapter,
// so it still replays piece by piece.
const STARTS = new Set([EventTypes.SliceCreated, EventTypes.ScenarioAdded, EventTypes.ChapterCreated]);
function stepsOf(all) {
  const out = [];
  all.forEach((e, i) => {
    const last = out[out.length - 1];
    const sameBatch = last && e.batch && last.events[0].batch === e.batch;
    const splits = STARTS.has(e.type) && last?.events.some(x => STARTS.has(x.type));
    if (sameBatch && !splits) { last.events.push(e); last.end = i + 1; }
    else out.push({ end: i + 1, events: [e] });
  });
  return out;
}

// What a step did, in words: its first event, with a name from the model where there is one
function describe(step) {
  const first = step.events[0];
  if (first.type === EventTypes.ModelSnapshot) return 'Imported (a snapshot)';
  const state = projectState(events.slice(0, step.end));
  const d = first.data || {};
  const name = d.name
    || state.elements[d.elementId]?.name
    || (d.sliceId && state.slices[d.sliceId] ? sliceTitle(state.slices[d.sliceId], state) : '')
    || state.scenarios[d.scenarioId]?.name
    || state.chapters[d.chapterId]?.name || '';
  const more = step.events.length > 1 ? ` (+${step.events.length - 1})` : '';
  return `${label(first.type)}${name ? ` · ${name}` : ''}${more}`;
}

const when = iso => {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

function show(i, follow = false) {
  at = Math.max(0, Math.min(steps.length, i));
  const step = steps[at - 1];
  setReplayLimit(step ? step.end : 0);
  render();
  const bar = document.getElementById('replayBar');
  if (!bar) return;
  bar.querySelector('#replaySlider').value = String(at);
  bar.querySelector('#replayPos').textContent = `${at} / ${steps.length}`;
  bar.querySelector('#replayWhat').textContent = step ? describe(step) : 'Before anything was added';
  bar.querySelector('#replayWhen').textContent = step ? when(step.events[0].timestamp) : '';
  // Playing: keep the slice being built in view (unless its chapter is a closed book)
  const sliceId = step?.events.map(e => e.data?.sliceId).find(Boolean);
  if (follow && sliceId && getView() === 'board') {
    const slice = projectState().slices[sliceId];
    if (slice && !(slice.chapterId && isChapterFolded(slice.chapterId))) showSliceOnBoard(sliceId);
  }
}

function stop() {
  clearInterval(timer);
  timer = null;
  const play = document.getElementById('replayPlay');
  if (play) { play.textContent = '▶'; play.setAttribute('aria-label', 'Play'); }
}

function play() {
  if (timer) return stop();
  if (at >= steps.length) show(0);
  // About 20 seconds for the whole history, however long it is
  const every = Math.max(40, Math.min(450, 20000 / Math.max(1, steps.length)));
  const btn = document.getElementById('replayPlay');
  btn.textContent = '❚❚';
  btn.setAttribute('aria-label', 'Pause');
  timer = setInterval(() => {
    if (at >= steps.length) return stop();
    show(at + 1, true);
  }, every);
}

export function isReplaying() { return !!document.getElementById('replayBar'); }

export function closeReplay() {
  stop();
  setReplayLimit(null);
  document.getElementById('replayBar')?.remove();
  document.body.classList.remove('replaying');
  render();
}

// atEvents: open scrubbed to the step that ends there (a build book's edition), else at now
export function openReplay(atEvents = null) {
  if (isReplaying()) return;
  events = getEventStream();
  steps = stepsOf(events);
  if (steps.length < 2) { showToast(events.length ? 'Nothing to replay: this model came without its history' : 'Nothing to replay yet'); return; }
  const bar = document.createElement('div');
  bar.id = 'replayBar';
  bar.className = 'replay-bar';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Replay how this model was built');
  bar.innerHTML = `
    <div class="replay-top">
      <button class="replay-btn" id="replayPlay" aria-label="Play">▶</button>
      <input type="range" id="replaySlider" class="replay-slider" min="0" max="${steps.length}" step="1" value="${steps.length}" aria-label="Step">
      <button class="replay-btn replay-close" id="replayClose" aria-label="Back to now">✕</button>
    </div>
    <div class="replay-info">
      <span class="replay-pos" id="replayPos"></span>
      <span class="replay-what" id="replayWhat"></span>
      <span class="replay-when" id="replayWhen"></span>
    </div>`;
  document.body.appendChild(bar);
  document.body.classList.add('replaying');
  bar.querySelector('#replaySlider').addEventListener('input', e => { stop(); show(Number(e.target.value)); });
  bar.querySelector('#replayPlay').addEventListener('click', play);
  bar.querySelector('#replayClose').addEventListener('click', closeReplay);
  show(atEvents == null ? steps.length : steps.filter(s => s.end <= atEvents).length);
}
