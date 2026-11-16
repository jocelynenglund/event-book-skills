// ===========================================
// LITERATURE - Chapter Vote Count (SV: Chapter Vote Count)
// How many readers have voted for a chapter (one 👍 each).
// ===========================================

export const chapterVoteCount = (state, chapterId) => Object.keys(state.votes?.[chapterId] || {}).length;
