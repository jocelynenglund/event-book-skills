// ===========================================
// SHARE IMAGE - A shot from the book itself
// For a caller that has the book (the open model, or some events) rather than a shot: asks the view
// (ModelDetailShareShot) for it. The renderers draw only from the shot they are given.
// ===========================================

import { projectState } from '../../core/projections.js';
import { getEventStream } from '../../core/eventStore.js';
import { modelDetailShareShot } from './modelDetailShareShot.read.js';

// args: the old renderer options (events, chapterId, onlySlices, showProps, showScenarios, …)
export function shotOf({ events = null, chapterId = null, onlySlices = null, ...options } = {}) {
  const state = events ? projectState(events) : projectState();
  return modelDetailShareShot(state, { scope: { chapters: chapterId && [].concat(chapterId), slices: onlySlices }, options, events: events || getEventStream() });
}
