// ===========================================
// SNAPSHOT - Commands
// SC: Take Snapshot — a model's events folded into one ModelSnapshot event: the
// model as it stands, without the history of building it. Share links send this,
// and Export without history saves it. Undoing the snapshot itself undoes the import.
// ===========================================

import { EventTypes } from '../../core/eventStore.js';
import { projectState } from '../../core/projections.js';

// What a snapshot keeps: the projected state, less what's worked out again on load
const KEEP = ['elements', 'slices', 'connections', 'scenarios', 'sliceOrder', 'chapters', 'chapterOrder',
  'flows', 'modelName', 'modelDescription', 'updateRoles', 'modelSource', 'sliceDecisions', 'follow'];

export function snapshotEvents(events) {
  const state = projectState(events);
  const kept = Object.fromEntries(KEEP.map(k => [k, state[k]]));
  // Automations inferred from older models are inferred again; don't freeze them in
  kept.slices = Object.fromEntries(Object.entries(state.slices).filter(([id]) => !id.startsWith('au_inferred_')));
  const now = new Date();
  return [{
    id: 'evt_' + now.getTime() + '_snap',
    type: EventTypes.ModelSnapshot,
    data: { state: kept, events: events.length },
    batch: 'b_snap_' + now.getTime().toString(36),
    timestamp: now.toISOString()
  }];
}
