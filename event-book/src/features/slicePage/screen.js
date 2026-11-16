// ===========================================
// SLICE PAGE - Screen view (SV: Slice Page Screen)
// Everything the Slice page shows of one slice, read once from the book and shaped for the screen:
// its place among the slices, kicker, title, description, buttons, usage and spec trail, paragraphs,
// stickies in the order data flows, scenarios with their values, and the conversation.
// The page draws from this and reads nothing else of the book. A slice that is gone is null.
// Local state comes in as opts: readOnly, idsHidden, from (the slice a page turn comes from),
// me and nick (this device, for the conversation).
// ===========================================

import { getOrderedSlices, getScenariosForSlice, sliceTitle, sliceFlow, sliceRef } from '../../core/projections.js';
import { elementLabel, propLabel } from '../../core/constants.js';
import { filled } from '../scenarios/view.js';
import { paragraphsOf } from '../article/command.js';
import { aliaser, shownEntries, scenarioHasIds } from '../scenarios/ids.js';
import { sourceUrl, sourceLabel } from '../../core/source.js';
import { sliceTypeLabels } from '../board/boardSliceHeaderFields.read.js';
import { sliceUsageOf, eventUsageOf } from '../usage/view.js';
import { specTrailOf } from '../specs/specTrail.read.js';
import { laneOf, sliceActor } from '../board/command.js';
import { isLiterature } from '../literature/rules.js';
import { conversationOf } from '../comments/sliceConversation.read.js';

// A change reads top-down (screen → command → event); a view the other way (events → read model → screen)
function inFlowOrder(slice, state) {
  const els = slice.elements.map(id => state.elements[id]).filter(Boolean);
  const lanes = slice.type === 'SV' ? [2, 1, 0] : [0, 1, 2];
  return lanes.flatMap(l => els.filter(e => laneOf[e.type] === l));
}

// "Code: path:line" in a description becomes a link when the model knows its repo:
// the text in parts, each plain text or a code reference with its link (or none)
function descriptionParts(text, state) {
  const parts = [];
  let at = 0;
  for (const m of text.matchAll(/(Code: )([^\s:]+)(?::(\d+))?/g)) {
    if (m.index > at) parts.push({ text: text.slice(at, m.index) });
    const url = sourceUrl(state, m[2], m[3]);
    parts.push(url ? { pre: m[1], file: m[2], line: m[3] || null, url } : { text: m[0] });
    at = m.index + m[0].length;
  }
  if (at < text.length) parts.push({ text: text.slice(at) });
  return parts;
}

// Values often arrive as JSON text (from tests): a list of rows reads better as a table
function parsed(v) {
  if (typeof v !== 'string' || !/^\s*[\[{]/.test(v)) return v;
  try { return JSON.parse(v); } catch (e) { return v; }
}
const isRows = v => Array.isArray(v) && v.length > 0 && v.every(r => r && typeof r === 'object' && !Array.isArray(r));
const show = v => (typeof v === 'string' ? v : JSON.stringify(v));

// A sticky's values: key / text, or key / rows; ids are aliases (#1, #2: the same alias for the same value
// in a scenario), or left out
function valuesOf(values, el, alias, hideIds) {
  const entries = shownEntries(Object.entries(values || {}).filter(([, v]) => filled(parsed(v))), el, alias, hideIds);
  return entries.map(([key, v, isAlias]) => {
    if (isAlias) return { key, text: v, alias: true };
    const p = parsed(v);
    return isRows(p) ? { key, rows: rowsOf(p) } : { key, text: show(p) };
  });
}

// A list's rows as text, one cell per field
const rowsOf = rows => rows.map(r => Object.fromEntries(Object.entries(r || {}).map(([k, v]) => [k, show(v)])));

// An integration event (ours, published to other systems) and who it goes to
const publishedOf = el => el.type === 'event' && !!el.published && !el.external;
const toOf = el => (publishedOf(el) ? (el.to || []).join(', ') : '');

// A sticky named in a scenario, with the values it was given ('removed' when the model lost it)
function refOf(el, values, alias, hideIds) {
  if (!el) return { removed: true };
  return { type: el.type, external: !!el.external, table: !!el.table, published: publishedOf(el), to: toOf(el), name: el.name, kind: elementLabel(el), values: valuesOf(values, el, alias, hideIds) };
}

function scenarioOf(scn, state, hideIds) {
  const alias = aliaser();
  const given = (scn.given || []).map(g => refOf(state.elements[g.elementId], g.values, alias, hideIds));
  const t = scn.then;
  let then = { kind: 'none' };
  if (t?.type === 'event') then = { kind: 'event', ref: refOf(state.elements[t.eventId], t.values, alias, hideIds) };
  else if (t?.type === 'rejection') then = { kind: 'rejection', reason: t.reason || '' };
  else if (t?.type === 'readModel') {
    const rows = t.rows?.length ? rowsOf(t.rows) : null;
    then = { kind: 'readModel', ref: refOf(state.elements[t.readModelId], rows ? null : t.values, alias, hideIds), rows };
  }
  // (the then's ids get their aliases before the when's, as the page always numbered them)
  const when = scn.when?.commandId ? refOf(state.elements[scn.when.commandId], scn.when.values, alias, hideIds) : null;
  let source = null;
  if (scn.source?.file) source = { label: sourceLabel(scn.source), url: sourceUrl(state, scn.source.file, scn.source.line) };
  return { id: scn.id, name: scn.name, mustHave: !!scn.mustHave, pending: scn.pending || null, source, given, when, then };
}

function stickyOf(el, sliceId, usageState) {
  return {
    id: el.id, sliceId, type: el.type, external: !!el.external, table: !!el.table, published: publishedOf(el), to: toOf(el), kind: elementLabel(el), name: el.name,
    used: eventUsageOf(el, usageState),
    fields: (el.properties || []).map(p => ({ label: propLabel(p), type: p.type || 'string' }))
  };
}

// An article's point: its paragraphs, each tap to edit, ＋ Paragraph once the structure is approved.
// A slice with stickies shows them only when it has some. null: nothing to show.
function paragraphsFor(slice, state, stickyCount) {
  const items = paragraphsOf(state, slice.id).map(p => ({ id: p.id, text: p.text, by: p.by || null }));
  const canAdd = !!state.structure?.approved && !stickyCount;
  return items.length || canAdd ? { sliceId: slice.id, items, canAdd } : null;
}

// What the page says when it turns into another chapter: the chapter's name
function turnChapterOf(state, slice, from) {
  const was = from && state.slices[from];
  if (!was || was.chapterId === slice.chapterId) return null;
  return state.chapters[slice.chapterId]?.name || 'Not in a chapter';
}

export function slicePageScreen(state, sliceId, opts = {}) {
  const slice = state.slices[sliceId];
  if (!slice) return null;
  const { readOnly = false, hideIds = false, from = null, me, nick } = opts;
  const order = getOrderedSlices(state);
  const at = order.findIndex(s => s.id === sliceId);
  const prev = order[at - 1], next = order[at + 1];
  const chapter = state.chapters[slice.chapterId];
  const flow = sliceFlow(slice, state);
  const title = sliceTitle(slice, state);
  const actor = sliceActor(slice, state);
  // Must haves (acceptance criteria) first, then the nice to haves
  const scns = [...getScenariosForSlice(sliceId, state)].sort((a, b) => !!b.mustHave - !!a.mustHave);
  const stickies = inFlowOrder(slice, state);
  const head = {
    sliceId, type: slice.type, actor, title,
    kicker: { ref: sliceRef(state, sliceId), type: sliceTypeLabels[slice.type] || slice.type, chapter: chapter?.name || null, flow: flow?.name || null },
    usage: sliceUsageOf(slice, state),
    specTrail: specTrailOf(slice, state),
    waived: slice.waived || null,
    description: slice.description ? descriptionParts(slice.description, state) : null,
    buttons: [
      ...(readOnly ? [] : [{ action: 'menu', label: 'Edit slice' }]),
      // From the board, ‹ Board goes back and lands on the slice: no second way there
      ...(opts.openedFrom === 'board' ? [] : [{ action: 'board', label: '↗ On the board' }]),
      { action: 'share', label: 'Share…' },
      ...(scns.some(s => scenarioHasIds(s, state)) ? [{ action: 'ids', label: hideIds ? 'Show ids' : 'Hide ids', pressed: hideIds }] : [])
    ]
  };
  return {
    sliceId, type: slice.type, actor, title, literature: isLiterature(state) ? { slice, state, paragraphs: paragraphsFor(slice, state, 0) } : null,
    nav: { n: at + 1, of: order.length, prev: prev?.id || null, next: next?.id || null },
    head,
    turnChapter: turnChapterOf(state, slice, from),
    paragraphs: paragraphsFor(slice, state, stickies.length),
    stickies: stickies.map(el => stickyOf(el, sliceId, state)),
    scenarios: { sliceId, type: slice.type, items: scns.map(s => scenarioOf(s, state, hideIds)) },
    conversation: conversationOf(slice, state, { me, nick })
  };
}
