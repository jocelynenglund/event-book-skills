// ===========================================
// REFERENCES - Reference Menu: what a reference's menu says about it: its name and how big it is.
// ===========================================

import { listReferences } from './store.js';
import { referenceSummary } from './referenceShelf.read.js';

// -> { id, name, summary } | null for a reference that is gone
export function referenceMenu(id) {
  const ref = listReferences().find(r => r.id === id);
  return ref ? { id, name: ref.name, summary: referenceSummary(ref) } : null;
}
