// ===========================================
// COMMENTS - Conversation on the slice page (SV: Slice Page Threads)
// Under a slice's scenarios (a literature point's sentences): every thread about it, the slice's
// own and its scenarios', each labelled with the scenario and the Given/When/Then line it is
// about, oldest first, replies under each, Reply and Resolve in place. Resolved ones fold under
// "N resolved". A box at the end starts a new thread on the slice. Talk, so it works on a
// read-only book too. (The thread sheet is the same conversation from the outline and board.)
// ===========================================

import { showToast } from '../../ui/toast.js';
import { setNickname, addComment, replyToThread, resolveComment, deleteComment } from './command.js';
import { setReplyTo } from './conversationReply.js';

// A tap or key in the section; rerender redraws the page where it stands
export function conversationAction(a, t, sliceId, rerender) {
  const text = id => document.getElementById(id)?.value;
  const done = why => { if (why) { showToast(why); return; } setReplyTo(null); rerender(); };
  if (a === 'reply') { setReplyTo(t.dataset.comment); rerender(); document.getElementById('cvReply')?.focus(); }
  else if (a === 'reply-cancel') { setReplyTo(null); rerender(); }
  else if (a === 'send-reply') done(replyToThread({ threadId: t.dataset.comment, text: text('cvReply') }));
  else if (a === 'send-new') done(addComment({ sliceId, text: text('cvText') }));
  else if (a === 'nick-page') { const why = setNickname(text('cvNick')); why ? showToast(why) : (rerender(), document.getElementById('cvText')?.focus()); }
  else if (a === 'resolve') done(resolveComment(t.dataset.comment));
  else if (a === 'delete') done(deleteComment(t.dataset.comment));
}
