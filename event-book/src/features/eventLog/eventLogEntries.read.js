// ===========================================
// EVENT LOG - Event Log Entries: the open book's events newest first, each with its type, when it happened and
// the data it carries (a long one cut short; a snapshot says what is in it instead of printing the whole model).
// ===========================================

import { getEventStream } from '../../core/eventStore.js';
import { sourceSummary } from '../../core/source.js';

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

// events: the book's (the open one's by default) -> [{ index (in the stream, for copying it), type, time, text }], newest first
export function eventLogEntries(events = getEventStream()) {
  return events.map((evt, index) => ({ index, type: evt.type, time: new Date(evt.timestamp).toLocaleTimeString(), text: dataText(evt) })).reverse();
}
