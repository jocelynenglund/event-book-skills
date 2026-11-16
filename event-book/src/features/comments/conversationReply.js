// ===========================================
// COMMENTS - Which thread on the slice page is being replied to in place (screen state, not the book)
// ===========================================

let replyTo = null;
export const getReplyTo = () => replyTo;
export const setReplyTo = id => { replyTo = id; };
