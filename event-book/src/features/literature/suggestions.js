// ===========================================
// LITERATURE - Suggested edits to her sentences (plan "Edit my own draft", the voice round)
// SC: Suggest Edit — a numbered, smallest-possible change to one of her sentences: the exact words to find
//     in it (once) and what replaces them (nothing = cut), and why. Numbers run per book, so she can say
//     "skip 2,5". Agents suggest; they never change her words.
// SC: Accept Suggestions — all in, all but some numbers (those are closed, not lost), or the ones named.
//     The edits land in the sentences in ONE event, so undo and history work. It is an edit, so the
//     paragraph's Refined is taken back (the append rule in features/sliceRefined): Refined stays hers.
//     Only she accepts: an agent is refused.
// Each command returns null when it recorded its event, else why it was refused.
// ===========================================

import { appendEvent, EventTypes } from '../../core/eventStore.js';
import { projectState } from '../../core/projections.js';
import { openSuggestions, occurrences } from './rules.js';

const id = () => 'suggestion_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const record = (type, data) => (appendEvent(type, data) ? null : 'Read only');

export function suggestEdit({ sentenceId, find, replace = '', why, by = null, state = projectState() } = {}) {
  const sentence = state.sentences?.[sentenceId];
  if (!sentence) return 'No such sentence';
  find = String(find ?? ''); replace = String(replace ?? '');
  if (!find) return 'Say which words to change (find)';
  const times = occurrences(sentence.text, find);
  if (!times) return `"${find}" isn't in that sentence`;
  if (times > 1) return `"${find}" is in that sentence ${times} times: add words around it so it matches once`;
  if (find === replace) return 'That changes nothing';
  if (!String(why || '').trim()) return 'Say why: a few words she can judge it by';
  const n = Math.max(0, ...Object.values(state.suggestions || {}).map(x => x.n)) + 1;
  return record(EventTypes.EditSuggested, { suggestionId: id(), n, sliceId: sentence.sliceId, sentenceId, find, replace, why: String(why).trim(), by: by || null });
}

const unknown = (open, numbers) => numbers.find(n => !open.some(x => x.n === n));

// sliceId: only that paragraph's. only: just these numbers (the rest stay open). skip: all but these
// numbers (those are closed). A suggestion whose words an earlier one changed no longer matches once: it is closed with the skipped.
export function acceptSuggestions({ sliceId = null, only = null, skip = [], agent = false, state = projectState() } = {}) {
  if (agent) return 'Only the author accepts suggestions';
  const open = openSuggestions(state, sliceId);
  if (!open.length) return 'No suggestions to accept';
  const bad = unknown(open, [...(only || []), ...skip]);
  if (bad !== undefined) return `No open suggestion ${bad}`;
  const take = only ? open.filter(x => only.includes(x.n)) : open.filter(x => !skip.includes(x.n));
  const closed = only ? [] : open.filter(x => skip.includes(x.n));
  const texts = {}, accepted = [], skipped = closed.map(x => x.id);
  take.forEach(x => {
    const text = texts[x.sentenceId] ?? state.sentences[x.sentenceId].text;
    if (occurrences(text, x.find) !== 1) { skipped.push(x.id); return; }
    texts[x.sentenceId] = text.replace(x.find, () => x.replace);
    accepted.push(x.id);
  });
  return record(EventTypes.SuggestionsAccepted, { sliceId, accepted, skipped, edits: Object.entries(texts).map(([sentenceId, text]) => ({ sentenceId, text })) });
}

// Closed without applying: the numbers named
export function skipSuggestions({ numbers = [], sliceId = null, state = projectState() } = {}) {
  const open = openSuggestions(state, sliceId);
  const bad = unknown(open, numbers);
  if (bad !== undefined) return `No open suggestion ${bad}`;
  if (!numbers.length) return 'Which suggestions? Give their numbers';
  return record(EventTypes.SuggestionsAccepted, { sliceId, accepted: [], skipped: open.filter(x => numbers.includes(x.n)).map(x => x.id), edits: [] });
}
