// ===========================================
// EVENT LOG - Parts of the event log panel, each drawn from its entry of Event Log Entries alone.
// A root carries data-component and data-key.
// ===========================================

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// One event: its type and time, and its data; tap to copy it
export function eventLogItem(entry) {
  return `
    <div class="event-log-item" data-component="Event log item" data-key="${entry.index}" onclick="window.EventPad.copyEvent(${entry.index}, this)">
      <div class="event-log-item-header">
        <span class="event-log-type">${escapeHtml(entry.type)}</span>
        <span class="event-log-time">${escapeHtml(entry.time)}</span>
      </div>
      <div class="event-log-data">${escapeHtml(entry.text)}</div>
    </div>
  `;
}
