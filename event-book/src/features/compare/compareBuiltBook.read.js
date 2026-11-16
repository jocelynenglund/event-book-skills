// ===========================================
// COMPARE - Compare Built Book: the shelf Compare was built against, as the confirm and keep-as-planned
// commands take it (its slices, and the commit they were built at).
// ===========================================

import { projectState } from '../../core/projections.js';
import { readModelEvents } from '../../core/eventStore.js';

export const compareBuiltBook = builtId => projectState(readModelEvents(builtId));
