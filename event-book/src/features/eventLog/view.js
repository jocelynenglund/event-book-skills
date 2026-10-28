// ===========================================
// EVENT LOG - View (SV: View Event Log)
// ===========================================

import { getEventStream } from '../../core/eventStore.js';
import { sourceSummary } from '../../core/source.js';
import { escapeHtml } from '../board/view.js';

const LONG = 1500;   // characters of an event's data shown; tapping still copies all of it

// A snapshot carries a whole model: say what's in it instead of printing it
function snapshotSummary(data) {
  const st = data?.state || {};
  const n = o => Object.keys(o || {}).length;
  const count = (k, one, many) => `${k} ${k === 1 ? one : many}`;
  const lines = [
    '📸 ' + [count(n(st.slices), 'slice', 'slices'), count(n(st.chapters), 'chapter', 'chapters'),
      count(n(st.elements), 'sticky', 'stickies'), count(n(st.scenarios), 'scenario', 'scenarios')].join(' · '),
    sourceSummary(st)
  ].filter(Boolean);
  return lines.join('\n') + '\n(tap to copy the whole snapshot)';
}

function dataText(evt) {
  if (evt.type === 'ModelSnapshot') return snapshotSummary(evt.data);
  const text = JSON.stringify(evt.data, null, 2) ?? '';
  return text.length > LONG ? text.slice(0, LONG) + '\n… (tap to copy all of it)' : text;
}

// Render event log list
export function renderEventLog() {
  const eventStream = getEventStream();
  
  if (eventStream.length === 0) {
    return '<div class="event-log-empty">No events yet</div>';
  }
  
  return eventStream.slice().reverse().map((evt, i) => `
    <div class="event-log-item" onclick="window.EventPad.copyEvent(${eventStream.length - 1 - i}, this)">
      <div class="event-log-item-header">
        <span class="event-log-type">${escapeHtml(evt.type)}</span>
        <span class="event-log-time">${new Date(evt.timestamp).toLocaleTimeString()}</span>
      </div>
      <div class="event-log-data">${escapeHtml(dataText(evt))}</div>
    </div>
  `).join('');
}
