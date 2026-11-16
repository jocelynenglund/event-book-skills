// ===========================================
// OUTLINE - Add kinds (SV: Outline Add Kinds)
// The ＋ buttons under a chapter: the kinds of step it can add (Do, See, Auto), and the chapter they are for
// ('' for no chapter).
// ===========================================

import { addKindChoices } from './outlineAddForm.read.js';

export function outlineAddKinds(state, { chapterId = '' } = {}) {
  return { kinds: addKindChoices, chapterId: chapterId || '' };
}
