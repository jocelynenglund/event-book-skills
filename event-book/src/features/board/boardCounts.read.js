// ===========================================
// BOARD - Stats (SV: Board Counts)
// The bar above the board: the book's title, how big it is by kind, the chat's open count, whether any
// chapter is open, and where an imported book came from. The slices the stage chips count come with it.
// folded(id): is this chapter folded (a device setting).
// ===========================================

import { getBoardGroups } from '../../core/projections.js';
import { boardChat } from '../comments/read.js';

export function boardCounts(state, { folded = () => false } = {}) {
  const chapterIds = state.chapterOrder.filter(id => state.chapters[id]);
  const of = type => Object.values(state.elements).filter(e => e.type === type).length;
  return {
    title: state.modelName || 'Untitled model',
    stageSlices: getBoardGroups(state).flatMap(g => g.slices),
    stats: {
      empty: !Object.keys(state.slices).length,
      slices: Object.keys(state.slices).length,
      chapters: state.chapterOrder.length,
      events: of('event'), commands: of('command'), readModels: of('readModel'), automations: of('processor'), screens: of('screen'),
      scenarios: Object.keys(state.scenarios).length,
      chat: boardChat(state).open, chapterIds, anyOpen: chapterIds.some(id => !folded(id)),
      source: state.modelSource?.commit ? { commit: state.modelSource.commit, build: state.modelSource.build || null } : null
    }
  };
}
