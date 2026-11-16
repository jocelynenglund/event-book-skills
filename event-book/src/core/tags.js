// ===========================================
// TAGS - A book's few short tags: tidied the same way wherever they are set
// ===========================================

export const MAX_TAGS = 8;
export const MAX_TAG_LENGTH = 24;

// Trimmed, lower case, no repeats, empty ones dropped; at most MAX_TAGS, each cut to MAX_TAG_LENGTH.
// Takes a list or a comma-separated line.
export function normaliseTags(tags) {
  const list = Array.isArray(tags) ? tags : String(tags ?? '').split(',');
  const out = [];
  for (const t of list) {
    const tag = String(t ?? '').trim().replace(/\s+/g, ' ').toLowerCase().slice(0, MAX_TAG_LENGTH).trim();
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out.slice(0, MAX_TAGS);
}
