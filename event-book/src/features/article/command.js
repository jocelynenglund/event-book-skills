// ===========================================
// ARTICLE - Two rounds: structure, then text
// SC: Approve Structure — round one, for any book (an app plan or an article): its chapters and
//     slices are right as laid out. A later change to them takes the approval back (projections).
// SC: Write Paragraph / Edit Paragraph — round two for an article: a point's actual text, the
//     article's version of a scenario (Refined looks at one or the other).
// SV: Review Rounds — where the book is: structure approved or waiting; how many slices have
//     their content (scenarios or paragraphs); how many are refined.
// Each command returns null when it recorded its event, else why it was refused.
// ===========================================

import { appendEvent, EventTypes } from '../../core/eventStore.js';
import { projectState, getOrderedSlices, getScenariosForSlice } from '../../core/projections.js';

const paragraphId = () => '¶' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const record = (type, data) => (appendEvent(type, data) ? null : 'Read only');

export function approveStructure({ by = null, state = projectState() } = {}) {
  const slices = getOrderedSlices(state);
  if (!slices.length) return 'Nothing to approve yet';
  if (state.structure?.approved) return 'Already approved';
  return record(EventTypes.StructureApproved, { approvedBy: by, chapters: state.chapterOrder.filter(id => state.chapters[id]).length, slices: slices.length });
}

export function writeParagraph({ sliceId, text, by = null, state = projectState() } = {}) {
  if (!state.slices[sliceId]) return 'No such point';
  if (!state.structure?.approved) return 'Approve the structure first';
  const body = String(text || '').trim();
  if (!body) return 'Write something first';
  return record(EventTypes.ParagraphWritten, { paragraphId: paragraphId(), sliceId, text: body, by });
}

export function editParagraph({ paragraphId: id, text, state = projectState() } = {}) {
  if (!state.paragraphs?.[id]) return 'No such paragraph';
  const body = String(text || '').trim();
  if (!body) return 'Write something first';
  if (body === state.paragraphs[id].text) return null;
  return record(EventTypes.ParagraphEdited, { paragraphId: id, text: body });
}

// A point's paragraphs, in the order they were written
export const paragraphsOf = (state, sliceId) => Object.values(state.paragraphs || {}).filter(p => p.sliceId === sliceId);

// A book in the rounds: its structure approved (or changed since), paragraphs written, or an
// article from the start (slices of prose: none has a sticky)
export function inRounds(state) {
  const slices = Object.values(state.slices || {});
  return !!state.structure || Object.keys(state.paragraphs || {}).length > 0 || (slices.length > 0 && slices.every(s => !s.elements.length));
}

// SV: Review Rounds
export function reviewRounds(state) {
  const slices = getOrderedSlices(state);
  const withContent = slices.filter(s => getScenariosForSlice(s.id, state).length || paragraphsOf(state, s.id).length).length;
  const refined = slices.filter(s => s.refined).length;
  // Every slice refined is the structure approved too (a refined paragraph can't be refined in a
  // structure still waiting): the banner shouldn't ask for an approval that's already given
  const st = state.structure;
  const approved = st?.approved || (slices.length > 0 && refined === slices.length);
  const structure = approved ? 'approved' : st?.changed ? 'waiting (changed since it was approved)' : 'waiting';
  const text = approved
    ? `Structure approved · ${withContent} of ${slices.length} written · ${refined} refined`
    : `Structure ${st?.changed ? 'changed since you approved it' : 'waiting for your approval'} · ${slices.length} ${state.kind === 'literature' ? (slices.length === 1 ? 'paragraph' : 'paragraphs') : slices.length === 1 ? 'slice' : 'slices'}`;
  return { structure, slicesWithContent: withContent, refined, slices: slices.length, text };
}
