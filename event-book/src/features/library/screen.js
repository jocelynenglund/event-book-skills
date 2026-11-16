// ===========================================
// LIBRARY - Screen view (SV: Library Screen)
// Everything the Bookshelves show, read once from the books and shaped for the screen: the
// sections with their books (each book's spine: cloth, height, edition, small print, who has it),
// the chips' counts, the tag chips, the velocity line and the reference shelf. The screen draws
// from this and reads nothing else of the books. Device-local state (folds, the chosen tag, the
// recent stack's order) comes in as plain values. A book's state may come in with it (the app
// keeps one per book); without it the book is projected once here.
// ===========================================

import { projectState } from '../../core/projections.js';
import { planBuildProgress } from '../buildProgress/planBuildProgress.read.js';
import { sliceActor } from '../board/command.js';
import { detailsOf, editionShelves } from '../editions/shelves.js';
import { isBuildBook, latestBuild } from '../buildVersions/rules.js';
import { latestUsage } from '../usage/rules.js';
import { isLiterature } from '../literature/rules.js';
import { referenceState } from '../references/store.js';
import { velocityLine } from '../velocity/rules.js';
import { byName } from '../../ui/byName.js';
import { bookshelfSections } from './sections.js';
import { shelfOrder } from './propUp.js';
import { tagCounts } from './tags.js';
import { ordinal } from '../editions/rules.js';
import { retiredShelf } from '../retire/retiredShelf.read.js';

// Cloth for the published editions: deep colours with gold rules
const CLOTHS = ['#2f5d8a', '#7a2f3a', '#2f6a4f', '#5a3f7a', '#8a5a2a'];
const clothOf = id => CLOTHS[([...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 0) >>> 0) % CLOTHS.length];

// How a book's edition reads: "1st edition", "draft 3 of the 2nd edition", "draft 3"
export function editionText(e) {
  return e.published ? `${ordinal(e.edition)} edition` : e.edition ? `draft ${e.draft} of the ${ordinal(e.edition)} edition` : `draft ${e.draft}`;
}

const SHORT_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const editedOn = at => at && !isNaN(new Date(at)) ? SHORT_DATE.format(new Date(at)) : '';

// The few books opened last lie flat on top of the bookcase
export const RECENT_FLAT = 3;

// One book, as its spine needs it. updatedAt: when it last changed (ISO).
function bookOf({ id, updatedAt, events, state }, loan) {
  state ||= projectState(events);
  const d = detailsOf(state);
  const e = state.edition;
  const title = state.modelName || 'Untitled model';
  // Taller for more slices, and for a long title (up to a point)
  const longestWord = Math.max(...title.split(/\s+/).map(w => w.length));
  const height = Math.min(246, Math.max(166, 146 + d.total * 6, 86 + title.length * 7, 80 + longestWord * 10));
  const build = isBuildBook(events) ? latestBuild(events) : null;
  const slices = Object.keys(state.slices).length;
  const story = isLiterature(state);
  return {
    id, key: id, title,
    kind: isBuildBook(events) ? 'built' : e.published ? 'published' : 'draft',
    published: !!e.published,
    edition: { number: e.edition, draft: e.draft, text: editionText(e) },
    cloth: clothOf(id), height,
    // Refined, not built yet: a loose sheet each (up to 3)
    ready: Math.min(d.ready, 3),
    // A builder has the plan: how far it has got
    progress: planBuildProgress(state, id),
    slices, scenarios: Object.keys(state.scenarios).length, story,
    build,
    // 📈: a build book with usage data (the nightly usage import)
    usage: build != null && !!latestUsage(events),
    edited: editedOn(updatedAt),
    updatedAt: updatedAt || null,
    status: loan.status, device: loan.device || null,
    loan: loan.status === 'on-loan-agent' ? 'agent' : '',
    // For the tag chips, the catalog and the sheets
    tags: state.tags || [],
    description: state.modelDescription || '',
    chapters: state.chapterOrder.map(c => state.chapters[c]?.name).filter(Boolean)
  };
}

// The small print up a spine (thin spaces round the dots): slices · scenarios (or ¶ for a story) · build · 📈 · edited date
export const spineMeta = b => [b.slices, ...(b.story ? ['¶'] : [b.scenarios]), ...(b.build != null ? [`b${b.build}`] : []), ...(b.usage ? ['📈'] : []), ...(b.edited ? [b.edited] : [])].join(' · ');

// The velocity line's part of the screen: hidden (null) until some build has a second edition; pending while
// a book's summary is still being worked out (summaries undefined)
export function velocityOf(summaries, { open = false, today } = {}) {
  if (!summaries) return { pending: true, open, line: null };
  return { pending: false, open, line: velocityLine(summaries, open ? 30 : 7, today) };
}

// books: [{ id, updatedAt, events, state? }]. Device and sync things come in as plain values:
//   kept (sync bookkeeping by book), signedIn, shared (ids of books shared with this account),
//   notHere (library books not on this device), opened ({ id: iso }), propped (ids),
//   tag (the chosen tag chip), references (the shelf's saved chapters),
//   velocity (the books' summaries; undefined while they're worked out) and its open window.
export function libraryScreen(books, {
  kept = {}, signedIn = false, shared = [], notHere = [], opened = {}, propped = [], tag: chosen = null,
  references = [], velocity, velocityOpen = false, today
} = {}) {
  const loans = Object.fromEntries(bookshelfSections(books, signedIn ? kept : {}).library.map(b => [b.id, b]));
  const all = books.map(b => bookOf(b, loans[b.id] || { status: 'private' }));
  const byId = Object.fromEntries(all.map(b => [b.id, b]));
  const sharedIds = new Set(shared);
  // Where each book lives: published or drafts (its own history); who has it decides On loan
  const placed = editionShelves(books.map(b => ({ id: b.id, events: b.events })));
  const away = new Set(all.filter(b => b.status === 'on-loan' || b.status === 'on-loan-agent').map(b => b.id));
  // Tag chips filter the shelves; a tag nobody wears any more is dropped
  const tags = tagCounts(all);
  const tag = tags.some(x => x.tag === chosen) ? chosen : null;
  const wears = id => !tag || byId[id].tags.includes(tag);
  // A retired plan has left Drafts and Published (and every other shelf): it has the Retired shelf
  const retired = retiredShelf(books);
  const retiredIds = new Set(retired.rows.map(r => r.id));
  const idsOf = pick => placed.filter(x => pick(x) && wears(x.id) && !retiredIds.has(x.id)).map(x => x.id);
  const ids = {
    published: idsOf(x => x.section === 'published' && !sharedIds.has(x.id) && !away.has(x.id)),
    drafts: idsOf(x => x.section === 'drafts' && !sharedIds.has(x.id) && !away.has(x.id)),
    onloan: all.filter(b => away.has(b.id) && wears(b.id) && !retiredIds.has(b.id)).map(b => b.id),
    shared: idsOf(x => sharedIds.has(x.id) && !away.has(x.id))
  };

  // A shelf: propped up first, on their stands; then the few opened last lie flat in a stack (not On
  // loan: those are away); the rest stand in line, A–Z
  const shelf = (key, title, stack = true) => {
    const list = ids[key];
    const order = shelfOrder({ ids: list, titleOf: id => byId[id].title, opened, propped, stackSize: RECENT_FLAT, stack });
    return {
      key, title, count: list.length,
      note: key === 'published' ? 'An edition is a book whose every slice is done: open a draft, compare a build, then Publish.' : null,
      propped: order.proppedUp.map(id => ({ ...byId[id], layout: 'propped' })),
      recent: order.stack.map((id, i) => ({ ...byId[id], layout: 'flat', slot: i })),
      standing: order.inLine.map(id => ({ ...byId[id], layout: 'standing' }))
    };
  };
  const sections = [shelf('published', 'Published'), shelf('drafts', 'Drafts'),
    ...(ids.onloan.length ? [shelf('onloan', 'On loan', false)] : []),
    ...(ids.shared.length ? [shelf('shared', 'Shared with me')] : [])];

  const refs = [...references].sort(byName).map(r => {
    const { state, chapterId } = referenceState(r);
    const slices = state.sliceOrder.map(id => state.slices[id]).filter(s => s?.chapterId === chapterId);
    return { id: r.id, key: r.id, title: r.name, slices: slices.length, blocks: slices.slice(0, 12).map(s => (sliceActor(s, state) === 'processor' ? 'AU' : s.type)) };
  });

  return {
    books: all,
    signedIn,
    sections,
    // The chips at the top, one per section (Not here is filled in as the library answers)
    chips: [
      { section: 'published', label: 'Published', count: ids.published.length },
      { section: 'drafts', label: 'Drafts', count: ids.drafts.length },
      ...(ids.onloan.length ? [{ section: 'onloan', label: 'On loan', count: ids.onloan.length }] : []),
      ...(ids.shared.length ? [{ section: 'shared', label: 'Shared with me', count: ids.shared.length }] : []),
      ...(signedIn ? [{ section: 'missing', label: 'Not here', count: notHere.length }] : []),
      { section: 'reference', label: 'Reference', count: refs.length }],
    tags: tags.map(x => ({ ...x, on: x.tag === tag })),
    tag,
    // Which shelf each book is on, for the catalog
    shelfOf: Object.fromEntries([['published', 'Published'], ['drafts', 'Drafts'], ['onloan', 'On loan'], ['shared', 'Shared with me']]
      .flatMap(([key, name]) => ids[key].map(id => [id, name])).concat([...retiredIds].map(id => [id, 'Retired']))),
    retired,
    velocity: velocityOf(velocity, { open: velocityOpen, today }),
    reference: { count: refs.length, books: refs }
  };
}

// What the sheets and the catalog say of one book, from its state
export function bookFacts(state) {
  const e = state.edition;
  return {
    name: state.modelName || 'Untitled model', description: state.modelDescription || '', tags: state.tags || [],
    edition: e, slices: Object.keys(state.slices).length, scenarios: Object.keys(state.scenarios).length,
    chapters: state.chapterOrder.length, chapterNames: state.chapterOrder.map(c => state.chapters[c]?.name).filter(Boolean),
    literature: isLiterature(state),
    // Published with verdicts recorded on its edition
    judged: !!(e.published && e.edition && Object.keys(state.verdicts?.[e.edition] || {}).length)
  };
}
