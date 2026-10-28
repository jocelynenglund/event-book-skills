// ===========================================
// LIVE - Watch an agent build a model (?live, served by the eventPAD MCP server)
// The server pushes the model on every change; it lands in one "live" model on
// this device, and the board follows the newest slice. Edits made here are
// overwritten by the next push: it's for watching.
// ===========================================

import { createModel, replaceModelEvents, listModels, openModel, getCurrentModelId } from '../../core/eventStore.js';
import { projectState, getOrderedSlices } from '../../core/projections.js';
import { render, showSliceOnBoard, getView } from '../../ui/feed.js';
import { isChapterFolded, toggleChapterFolded } from '../board/view.js';

const LIVE_KEY = 'eventpad_live_model';

export function initLive() {
  if (!new URLSearchParams(location.search).has('live') || typeof EventSource === 'undefined') return;
  const banner = document.createElement('div');
  banner.className = 'live-banner';
  banner.setAttribute('role', 'status');
  banner.innerHTML = '<span class="live-dot" aria-hidden="true"></span><span>Live from your agent</span><span class="live-status" id="liveStatus">connecting…</span>';
  document.body.appendChild(banner);
  document.body.classList.add('live-mode');
  const status = text => { document.getElementById('liveStatus').textContent = text; };

  let liveId = null;
  try { liveId = localStorage.getItem(LIVE_KEY); } catch (e) { /* storage blocked */ }
  const seen = new Set();
  let first = true;

  const source = new EventSource('/live/stream');
  source.onmessage = e => {
    const { events } = JSON.parse(e.data);
    if (!liveId || !listModels().some(m => m.id === liveId)) {
      liveId = createModel(events);
      try { localStorage.setItem(LIVE_KEY, liveId); } catch (err) { /* this time only */ }
    } else {
      if (getCurrentModelId() !== liveId) openModel(liveId);
      replaceModelEvents(liveId, events);
    }
    const slices = getOrderedSlices(projectState());
    const fresh = slices.filter(s => !seen.has(s.id));
    slices.forEach(s => seen.add(s.id));
    render();
    // Follow the newest slice (opening its chapter if it's folded)
    const newest = fresh[fresh.length - 1];
    if (!first && newest && getView() === 'board') {
      if (newest.chapterId && isChapterFolded(newest.chapterId)) toggleChapterFolded(newest.chapterId);
      showSliceOnBoard(newest.id);
    }
    first = false;
    status(`${slices.length} ${slices.length === 1 ? 'slice' : 'slices'} · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`);
  };
  source.onerror = () => status('reconnecting…');
}
