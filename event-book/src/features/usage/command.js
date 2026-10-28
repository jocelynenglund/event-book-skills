// ===========================================
// USAGE - Commands
// SC: Import Usage — a build book gets the app's usage for a window (the nightly job's file).
// Returns why it was refused, or null (it recorded UsageImported).
// ===========================================

import { appendEvent, getEventStream } from '../../core/eventStore.js';
import { usageFor } from './rules.js';

// used: the job's latest-used.json ({ app, at, since, days, total, counts })
export function importUsage(used) {
  const r = usageFor(getEventStream(), used);
  if (r.refused) return r.refused;
  for (const e of r.events) if (!appendEvent(e.type, e.data)) return 'Read only';
  return null;
}
