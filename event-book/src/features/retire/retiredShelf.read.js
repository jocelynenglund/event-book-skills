// ===========================================
// RETIRE - SV: Retired Shelf — the plans that were retired, newest first, for the folded shelf at the bottom of
// the Bookshelves: { count, rows: [{ id, title, app, edition, text }] }, text "<title> · built into <app> edition N · <date>".
// books: [{ id, events, state? }]. A book that isn't retired is none of it.
// ===========================================

import { projectState } from '../../core/projections.js';
import { retiredOf } from '../editions/rules.js';

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dateOf = at => at && !isNaN(new Date(at)) ? DATE.format(new Date(at)) : '';

export function retiredShelf(books) {
  const rows = books.flatMap(b => {
    const r = retiredOf(b.events);
    if (!r) return [];
    const title = (b.state || projectState(b.events)).modelName || 'Untitled model';
    const into = `built into ${r.app || 'its app'}${r.edition != null ? ` edition ${r.edition}` : ''}`;
    return [{ id: b.id, title, app: r.app, edition: r.edition, at: r.retiredAt || '', text: [title, into, dateOf(r.retiredAt)].filter(Boolean).join(' · ') }];
  }).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return { count: rows.length, rows: rows.map(({ at, ...row }) => row) };
}
