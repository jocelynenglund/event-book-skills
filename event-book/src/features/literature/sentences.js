// ===========================================
// LITERATURE - Splitting a draft into paragraphs and sentences (pure text, no store)
// A draft's sentences are kept verbatim, so the splitter errs towards not breaking one: a sentence ends
// at . ! ? or … (and any closing quote or bracket after it) when whitespace and then something
// that is not a lowercase letter follows, and the full stop isn't an abbreviation's (Mr., e.g., p.m.).
// Decimals and URLs have no space after their dots, so they never break.
// ===========================================

const HEADING = /^#{1,6}\s+\S/;
export const isHeading = text => HEADING.test(String(text || '').trim());

// Blank lines divide paragraphs; a Markdown heading line is a block of its own
export function splitParagraphs(markdown) {
  const blocks = [];
  String(markdown || '').replace(/\r\n?/g, '\n').split(/\n[ \t]*\n/).forEach(block => {
    let lines = [];
    const flush = () => { if (lines.join('').trim()) blocks.push(lines.join('\n').trim()); lines = []; };
    block.split('\n').forEach(line => {
      if (isHeading(line)) { flush(); blocks.push(line.trim()); } else lines.push(line);
    });
    flush();
  });
  return blocks;
}

// Words that end in a full stop without ending the sentence
const ABBREVIATIONS = new Set(['mr', 'mrs', 'ms', 'mx', 'dr', 'prof', 'sr', 'jr', 'st', 'mt', 'vs', 'cf', 'inc', 'ltd', 'co', 'corp', 'approx', 'dept', 'est', 'fig', 'vol']);
const OPENERS = /^["'“‘(\[«]+/;

function endsWithAbbreviation(before) {
  const word = before.split(' ').pop().replace(OPENERS, '');
  // dotted: e.g  i.e  U.S  p.m
  return /^(?:\p{L}\.)+\p{L}$/u.test(word) || ABBREVIATIONS.has(word.toLowerCase());
}

export function splitSentences(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return [];
  if (isHeading(t)) return [t];
  const out = [];
  let start = 0;
  const end = /([.!?…]+)(["'”’)\]»]*)\s+/g;
  let m;
  while ((m = end.exec(t))) {
    const next = t[m.index + m[0].length];
    if (!next || /\p{Ll}/u.test(next)) continue;
    // Mr. Smith: a capital after an abbreviation doesn't start a sentence
    if (m[1] === '.' && endsWithAbbreviation(t.slice(start, m.index))) continue;
    out.push(t.slice(start, m.index + m[1].length + m[2].length));
    start = m.index + m[0].length;
  }
  out.push(t.slice(start));
  return out.filter(Boolean);
}

// A point is named by its paragraph's first few words
export function pointName(text, words = 5) {
  const plain = String(text || '').replace(/^#{1,6}\s+/, '').replace(/[*_`>]+/g, '').trim();
  return plain.split(/\s+/).slice(0, words).join(' ').replace(/[\s.,;:!?…"'“”‘’)\]]+$/u, '');
}
