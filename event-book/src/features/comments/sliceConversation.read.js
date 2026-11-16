// ===========================================
// COMMENTS - Slice Conversation: what the conversation under a slice's scenarios shows: every thread about it,
// the slice's own and its scenarios' (or sentences'), oldest first, each with what it is about, resolved ones
// folded, and the box to write in (or the nickname question). Talk, so it works on a read-only book too.
// ===========================================

import { commentDeviceId, nickname } from './command.js';
import { sliceThreads } from './read.js';
import { threadsFor } from './threadSheet.read.js';
import { getReplyTo } from './conversationReply.js';

const clip = (t, n) => (t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t);

// What a thread is about: the whole slice, a scenario (and its Given / When / Then line), or a sentence's start
function aboutOf(t, sentences) {
  if (!t.scenarioId) return 'The slice';
  if (!t.scenarioName) return 'A scenario that was removed';
  if (sentences?.[t.scenarioId]) return `Sentence “${clip(t.scenarioName, 40)}”`;
  return `${t.scenarioName}${t.partLabel ? ` › ${t.partLabel}${t.line ? `: ${t.line}` : ''}` : ''}`;
}

// who is looking: me (this device's id), nick (its nickname), both local state; replyTo: the thread being replied to
// -> { sliceId, open, threads: [thread with about, replying], resolvedCount, nick, lit, placeholder }
export function conversationOf(slice, state, { me = commentDeviceId(), nick = nickname(), replyTo = getReplyTo() } = {}) {
  const r = sliceThreads(state, slice.id);
  const sentences = state.sentences || {};
  const threads = threadsFor(r.threads, me).map((t, i) => ({ ...t, about: aboutOf({ ...t, line: r.threads[i].line }, sentences), replying: replyTo === t.commentId }));
  return { sliceId: slice.id, open: r.open, threads, nick, lit: state.kind === 'literature' };
}
