// ===========================================
// RETIRE - SV: Built From — the plans retired into one edition of an app's build: { app, edition, plans: [{ id, title }] },
// by title. books: [{ id, events, state? }] (the plans are the books retired into that app and edition).
// ===========================================

import { projectState } from '../../core/projections.js';
import { retiredOf } from '../editions/rules.js';

export function builtFrom(books, app, edition) {
  const plans = books.flatMap(b => {
    const r = retiredOf(b.events);
    return r && r.app === app && r.edition === edition ? [{ id: b.id, title: (b.state || projectState(b.events)).modelName || 'Untitled model' }] : [];
  }).sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));
  return { app, edition, plans };
}
