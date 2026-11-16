// ===========================================
// READ-ONLY - Read Only Chapter Menu: what the ⋮ on a chapter offers in a book that can't be changed here.
// Only sharing: the chapter as a picture.
// ===========================================

// -> null when the chapter is gone, else { chapterId, name, share: { title, desc } }
export function readOnlyChapterMenu(book, chapterId) {
  const chapter = book.chapters[chapterId];
  if (!chapter) return null;
  return { chapterId, name: chapter.name, share: { title: 'Share as picture…', desc: `A picture of ${chapter.name}, with its slices` } };
}
