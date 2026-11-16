// ===========================================
// BUILD PROGRESS - The steps sheet a progress chip opens: one replay of the book, handed to Slice Progress History.
// ===========================================

import { projectState } from '../../core/projections.js';
import { openBoardSheet } from '../board/sheets/shared.js';
import { sliceProgressHistory } from './sliceProgressHistory.read.js';
import { sliceProgressHistorySheet } from './progress.parts.js';

export function openProgressHistory(sliceId) {
  const html = sliceProgressHistorySheet(sliceProgressHistory(projectState(), sliceId));
  if (html) openBoardSheet(html);
}
