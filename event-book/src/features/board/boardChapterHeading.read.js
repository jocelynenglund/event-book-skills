// ===========================================
// BOARD - Chapter header (SV: Board Chapter Heading)
// A chapter's header over its columns: its name, how many slices it shows, and the flows it offers
// (with the one shown).
// ===========================================

import { chapterFlows } from '../../core/projections.js';

// ch: the chapter from the layout; flowOf(id, state): the flow shown in a chapter, or null
export function boardChapterHeading(state, ch, flowOf = () => null) {
  const shown = flowOf(ch.id, state);
  return { id: ch.id, name: state.chapters[ch.id]?.name || '', slices: ch.slices.length,
    flows: chapterFlows(ch.id, state).map(f => ({ id: f.id, name: f.name })), shownFlow: shown ? shown.id : null };
}
