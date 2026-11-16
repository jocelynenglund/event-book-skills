// ===========================================
// BOARD - Spine (SV: Board Spine Bands)
// A folded chapter as a book spine: its name, a band per slice (by kind), how many slices, and its meter.
// ===========================================

import { sliceActor } from './command.js';
import { chapterMeter } from '../usage/view.js';

export function boardSpineBands(state, ch) {
  const chapter = state.chapters[ch.id];
  return { id: ch.id, name: chapter?.name || '', slices: ch.slices.length,
    bands: ch.slices.map(s => sliceActor(s, state) === 'processor' ? 'AU' : s.type), meter: chapterMeter(chapter, state) };
}
