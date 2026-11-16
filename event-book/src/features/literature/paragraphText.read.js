// ===========================================
// LITERATURE - Paragraph Text (SV: Paragraph Text)
// A paragraph's words as the screens show them: per sentence, runs of plain text, a heading, or a
// suggested edit (the words struck, the replacement inserted, its number when asked).
// ===========================================

import { isHeading } from './sentences.js';
import { sentencesOf, pointText, openSuggestions } from './rules.js';

const headingText = text => String(text).replace(/^#{1,6}\s+/, '');

// A sentence with its open suggestions marked; a mark that overlaps an earlier one is listed elsewhere, not drawn
export function sentenceRuns(sentence, suggestions, numbered) {
  if (isHeading(sentence) && !suggestions.length) return [{ heading: headingText(sentence) }];
  const marks = suggestions.map(x => ({ x, at: sentence.indexOf(x.find) })).filter(m => m.at >= 0).sort((a, b) => a.at - b.at);
  const runs = [];
  let pos = 0;
  marks.forEach(({ x, at }) => {
    if (at < pos) return;
    if (at > pos) runs.push({ text: sentence.slice(pos, at) });
    runs.push({ find: x.find, replace: x.replace, n: numbered ? x.n : null });
    pos = at + x.find.length;
  });
  if (pos < sentence.length || !runs.length) runs.push({ text: sentence.slice(pos) });
  return runs;
}

// The paragraph: its sentences' runs; with no suggestions (or no sentences) its text as one
export function paragraphText(state, sliceId, numbered) {
  const open = openSuggestions(state, sliceId);
  const sentences = sentencesOf(state, sliceId);
  if (!open.length || !sentences.length) {
    const text = pointText(state, sliceId);
    return [[isHeading(text) ? { heading: headingText(text) } : { text }]];
  }
  return sentences.map(x => sentenceRuns(x.text, open.filter(o => o.sentenceId === x.id), numbered));
}
