// ===========================================
// EVENT LOG - View (SV: View Event Log)
// ===========================================

import { eventLogEntries } from './eventLogEntries.read.js';
import { eventLogItem } from './eventLog.parts.js';

// Render event log list
export function renderEventLog() {
  const entries = eventLogEntries();
  if (entries.length === 0) {
    return '<div class="event-log-empty">No events yet</div>';
  }
  return entries.map(eventLogItem).join('');
}
