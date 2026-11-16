// ===========================================
// LITERATURE - Chapter Requirement (SV: Chapter Requirement)
// A chapter's requirement: its text, and that text as the rule paragraphs and (from a "**Fine print:**"
// paragraph on) the fine print. null when the chapter has none.
// ===========================================

const FINE = /^\*\*fine print:?\*\*:?\s*/i;

export function chapterRequirement(state, chapterId) {
  const text = state.requirements?.[chapterId];
  if (!text) return null;
  const paras = String(text).split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
  const at = paras.findIndex(x => FINE.test(x));
  const rule = at < 0 ? paras : paras.slice(0, at);
  const fine = at < 0 ? [] : [paras[at].replace(FINE, ''), ...paras.slice(at + 1)].filter(Boolean);
  return { chapterId, text, rule, fine };
}
