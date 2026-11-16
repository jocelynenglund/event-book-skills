// ===========================================
// BOARD SHEETS - One small view per sheet (SV: Slice Menu View, Chapter Menu View, New Slice View …)
// Each holds exactly what its sheet shows, shaped for it: the sheet draws from it and reads
// nothing else of the book. Local UI state (what is folded, which view is open) is not here.
// The book comes in as `book`.
// ===========================================

import { getBoardGroups, getScenariosForSlice, sliceFlow, sliceTitle, chapterFlows, getTodoUpdates } from '../../../core/projections.js';
import { externalAttr, byName } from '../../../core/constants.js';
import { isLiterature } from '../../literature/rules.js';
import { isAutomated, freeViewSlices } from '../../automate/command.js';
import { isTrigger, readsModel } from '../command.js';
import { sliceTypeLabels } from '../boardSliceHeaderFields.read.js';
import { searchKey } from './shared.js';

const elementsOf = (book, type) => Object.values(book.elements).filter(e => e.type === type).sort(byName);
// A sticky as a picker's chip shows it
const chipOf = (e, linked) => ({ id: e.id, type: e.type, name: e.name, attrs: externalAttr(e), todo: !!e.todo, linked, key: searchKey(e.name) });

// ---------- A slice's menu ----------

// What the ⋮ on a slice offers; null when the slice is gone
export function sliceMenuView(book, sliceId) {
  const slice = book.slices[sliceId];
  if (!slice) return null;
  const scenarios = getScenariosForSlice(sliceId, book).map(s => ({ id: s.id, name: s.name }));
  const synthetic = sliceId.startsWith('au_inferred_');   // an inferred automation: nothing of its own to edit
  const hasChapter = !!slice.chapterId;
  return {
    sliceId, type: slice.type, typeLabel: sliceTypeLabels[slice.type] || 'Slice', synthetic,
    title: sliceTitle(slice, book), name: slice.name || '', description: slice.description || '',
    scenarios,
    // waive: offered only without scenarios; lift: when it is waived already
    waive: synthetic ? null : !scenarios.length && !slice.waived ? 'ask' : slice.waived ? 'lift' : null,
    waivedReason: slice.waived?.reason || '',
    // automation: only a state change can be run by a processor
    automation: synthetic || slice.type !== 'SC' ? null : isAutomated(slice) ? 'automated' : 'by a person',
    hasChapter, chapterName: hasChapter ? (book.chapters[slice.chapterId]?.name || '') : 'none',
    flowName: hasChapter ? (sliceFlow(slice, book)?.name || 'Main line') : null
  };
}

// Run it from an automation: the events and processors to pick from, the views that could be its first half
export function automateView(book, sliceId) {
  const slice = book.slices[sliceId];
  if (!slice) return null;
  const names = type => [...new Set(elementsOf(book, type).map(e => e.name))];
  return {
    sliceId, title: sliceTitle(slice, book), events: names('event'), processors: names('processor'),
    views: freeViewSlices(book).map(v => ({ id: v.id, title: sliceTitle(v, book) }))
  };
}

// Why it needs no scenario
export function waiveView(book, sliceId) {
  const slice = book.slices[sliceId];
  return slice ? { sliceId, title: sliceTitle(slice, book) } : null;
}

// A slice's description, from its ⓘ
export function sliceInfoView(book, sliceId) {
  const slice = book.slices[sliceId];
  return slice ? { sliceId, title: sliceTitle(slice, book), typeLabel: sliceTypeLabels[slice.type] || '', description: slice.description || '' } : null;
}

// Slices in their chapter's order, each with the neighbour a move up or down swaps with
export function reorderView(book) {
  const groups = getBoardGroups(book)
    .map(g => ({ chapter: g.chapter, slices: g.slices.filter(s => book.sliceOrder.includes(s.id)) }))
    .filter(g => g.slices.length);
  return {
    chapters: groups.map(({ chapter, slices }) => ({
      name: chapter ? chapter.name : null,
      rows: slices.map((s, i) => ({ sliceId: s.id, type: s.type, title: sliceTitle(s, book), up: slices[i - 1]?.id || null, down: slices[i + 1]?.id || null }))
    }))
  };
}

// The model's name, description, preface and tags
export function modelNameView(book) {
  return { name: book.modelName || '', description: book.modelDescription || '', preface: book.preface || '', tags: book.tags || [], literature: isLiterature(book) };
}

// ---------- Chapters ----------

// The chapters a slice can go to (in order, the current one marked, then "No chapter"); none for a new chapter
export function chapterPickerView(book, sliceId) {
  const slice = sliceId ? book.slices[sliceId] : null;
  const current = slice?.chapterId || null;
  const options = slice && book.chapterOrder.length
    ? [...book.chapterOrder, null].map(id => ({ chapterId: id, name: id ? book.chapters[id].name : 'No chapter', current: current === id }))
    : [];
  return { sliceId: slice ? sliceId : null, sliceName: slice ? slice.name || 'this slice' : null, options };
}

// A chapter's menu: its name, place among the chapters, and its flows
export function chapterMenuView(book, chapterId) {
  const chapter = book.chapters[chapterId];
  if (!chapter) return null;
  const index = book.chapterOrder.indexOf(chapterId);
  return {
    chapterId, name: chapter.name, index, first: index === 0, last: index === book.chapterOrder.length - 1,
    flows: chapterFlows(chapterId, book).map(f => ({ id: f.id, name: f.name }))
  };
}

// The flows a slice can be on: the chapter's main line, then its flows, the current one marked
export function flowPickerView(book, sliceId) {
  const slice = book.slices[sliceId];
  if (!slice?.chapterId) return null;
  const current = sliceFlow(slice, book)?.id || null;
  const flows = chapterFlows(slice.chapterId, book);
  return {
    sliceId, chapterId: slice.chapterId, sliceName: slice.name || 'this slice',
    options: [null, ...flows.map(f => f.id)].map(id => ({ flowId: id, name: id ? book.flows[id].name : 'Main line', current: current === id })),
    hasFlows: flows.length > 0
  };
}

// ---------- A new slice ----------

// chapterId: preselected (from a chapter's menu); undefined takes the last chapter. position: { before | after: sliceId }.
// Next to a slice, the new one joins that slice's chapter and the chapter chips are not offered.
export function newSliceView(book, chapterId, position = null) {
  const anchor = position && book.slices[position.before || position.after];
  const chosen = anchor ? (anchor.chapterId || null)
    : chapterId !== undefined ? chapterId : (book.chapterOrder[book.chapterOrder.length - 1] || null);
  return {
    chapterId: chosen,
    where: anchor ? { side: position.before ? 'before' : 'after', name: anchor.name || 'this slice' } : null,
    chips: anchor || !book.chapterOrder.length ? []
      : [...book.chapterOrder, null].map(id => ({ chapterId: id, label: id ? book.chapters[id].name : 'No chapter', active: chosen === id }))
  };
}

// "The system reacts": the events that can trigger it and the read models it can read
export function automationView(book) {
  return {
    events: elementsOf(book, 'event').map(e => ({ ...chipOf(e, false), external: !!e.external })),
    readModels: elementsOf(book, 'readModel').map(e => chipOf(e, false))
  };
}

// The partner a new automation's slice was paired with (its view half), to place beside it
export function newSlicePartner(book, sliceId) {
  return book.slices[sliceId]?.pairWith || null;
}

// A processor already named so (case, spaces, dashes ignored): typing its name reuses it
export function processorNamed(book, name) {
  return elementsOf(book, 'processor').find(e => searchKey(e.name) === searchKey(name))?.id || null;
}

// ---------- Processors and to-do lists ----------

// Every event, ticked if it updates this to-do list
export function updatedByView(book, readModelId) {
  const rm = book.elements[readModelId];
  if (!rm) return null;
  const linked = new Set(getTodoUpdates(readModelId, book).map(u => u.event.id));
  return { readModelId, name: rm.name, events: elementsOf(book, 'event').map(e => chipOf(e, linked.has(e.id))) };
}

// What a processor reads and what wakes it; sliceId is kept only when that slice exists
export function processorInputsView(book, processorId, sliceId = null) {
  const proc = book.elements[processorId];
  if (!proc) return null;
  return {
    processorId, name: proc.name, sliceId: sliceId && book.slices[sliceId] ? sliceId : null,
    readModels: elementsOf(book, 'readModel').map(m => chipOf(m, readsModel(processorId, m.id, book))),
    events: elementsOf(book, 'event').map(e => chipOf(e, isTrigger(e.id, processorId, book)))
  };
}

// A read model already named so: typing its name links that one
export function readModelNamed(book, name) {
  return elementsOf(book, 'readModel').find(e => searchKey(e.name) === searchKey(name))?.id || null;
}
