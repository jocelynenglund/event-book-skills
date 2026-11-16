// ===========================================
// COMMENTS - Thread Sheet: what the thread sheet shows for a slice's or a scenario's threads, or for the board
// chat (no slice): the threads oldest first with their replies, resolved ones folded away, what is outstanding
// elsewhere (the chat), and the box to write in: the nickname question, or the parts of a scenario to comment
// on, the placeholder and who it is sent as. Replays the book once.
// ===========================================

import { projectState, sliceTitle } from '../../core/projections.js';
import { PARTS } from './command.js';
import { commentsOn, boardChat } from './read.js';
import { partLabel } from './partLabel.js';

export const whenText = iso => {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

// Threads as a person sees them: when each was said, the part named in words, and which ones are theirs to delete
export const threadsFor = (threads, me) => threads.map(c => ({
  commentId: c.commentId, nickname: c.nickname, text: c.text, resolved: !!c.resolved, whenText: whenText(c.at),
  partLabel: c.part ? partLabel[c.part] : null, line: c.line ?? null, scenarioId: c.scenarioId || null, scenarioName: c.scenarioName || null, mine: c.deviceId === me,
  replies: (c.replies || []).map(r => ({ commentId: r.commentId, nickname: r.nickname, text: r.text, whenText: whenText(r.at), mine: r.deviceId === me }))
}));

// at: { sliceId (null: the board chat), scenarioId, part, replyTo }. me: this device's id. nick: its nickname
// (null: asks for one). renaming: asking for another.
// -> null for a slice that is gone
export function threadSheet(at, { me = null, nick = null, renaming = false } = {}) {
  const state = projectState();
  const chat = !at.sliceId;
  const slice = chat ? null : state.slices[at.sliceId];
  if (!chat && !slice) return null;
  const sentence = at.scenarioId ? state.sentences?.[at.scenarioId] : null;   // literature: a sentence stands where a scenario would
  const scn = at.scenarioId ? state.scenarios[at.scenarioId] || (sentence && { name: sentence.text, sentence: true }) : null;
  const board = chat ? boardChat(state) : null;
  const all = threadsFor(chat ? board.messages : commentsOn(state, at.sliceId, at.scenarioId), me);
  const replyingTo = at.replyTo ? state.comments[at.replyTo] : null;
  const ask = !nick || renaming;
  const placeholder = replyingTo ? 'Your reply' : chat ? 'Say something to everyone reading this book' : scn?.sentence ? 'What should change in this sentence?'
    : scn ? 'What should change, or what\'s missing?' : state.kind === 'literature' ? 'A question or a note on this paragraph' : 'A question or a note on this slice';
  const open = all.filter(c => !c.resolved), done = all.filter(c => c.resolved);
  return {
    chat, title: chat ? 'Board chat' : 'Comments',
    sub: chat ? state.modelName || 'This book' : scn ? scn.name || 'Scenario' : sliceTitle(slice, state),
    scenarioNote: scn ? sliceTitle(slice, state) : null,
    outstanding: chat ? board.outstanding.map(t => ({ commentId: t.commentId, sliceTitle: t.sliceTitle, scenarioName: t.scenarioName, partLabel: t.part ? partLabel[t.part] : null,
      nickname: t.nickname, text: t.text, replies: t.replies })) : null,
    open, done,
    emptyNote: done.length ? 'Nothing open.' : chat ? 'Nothing said on the board yet.' : 'No comments yet.',
    nickname: ask ? { label: nick ? 'Your nickname' : 'What should we call you?', nick: nick || '', button: nick ? 'Save' : 'Continue' } : null,
    writer: ask ? null : {
      replyingTo: replyingTo ? replyingTo.nickname : null,
      parts: scn && !scn.sentence && !replyingTo ? [{ value: '', label: 'Whole scenario', on: !at.part }, ...PARTS.map(p => ({ value: p, label: partLabel[p], on: at.part === p }))] : null,
      placeholder, as: nick, send: replyingTo ? 'Reply' : 'Comment'
    }
  };
}
