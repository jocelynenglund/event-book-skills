// ===========================================
// OUTLINE ADD FORM (SV) - what the "Add a step" sheet offers for one kind of step under a chapter: the
// chapter's name, the kinds to switch between, each field with the names the book already has for it (so a
// step can reuse an event or read model), and which of those names are elements the book has (a step with
// an existing name reuses the element rather than copying it; a to-do list is flagged).
//
// What the outline can add, and how each kind is asked for. An automation reads as a sentence — When … using
// … ⚙ … does … → … — and its shape follows from what's filled in: a reactor, a translator (from another
// system), or a to-do list it works through (a new read model gets its own view beside it).
// ===========================================

import { byName } from '../../core/constants.js';
import { outlineAddHint } from './outlineAddHint.read.js';

export const addKinds = {
  SC: { label: 'Do', propsNote: 'on the command and its event', fields: [
    { id: 'olAddFirst', type: 'command', label: 'Command', placeholder: 'e.g. Place order', required: true },
    { id: 'olAddEvent', type: 'event', label: 'Event', placeholder: 'e.g. Order placed (optional)' }] },
  SV: { label: 'See', propsNote: 'on the read model', fields: [
    { id: 'olAddFirst', type: 'readModel', label: 'Read model', placeholder: 'e.g. Order summary', required: true }] },
  AU: { label: 'Auto', propsNote: 'on the command and its result', fields: [
    { id: 'olAddFirst', type: 'event', label: 'When', placeholder: 'e.g. Agreement signed',
      check: { id: 'olAddExternal', label: 'from another system' } },
    { id: 'olAddUsing', type: 'readModel', label: 'Using', placeholder: 'e.g. Payments to capture (optional)',
      check: { id: 'olAddTodo', label: "it's a to-do list" } },
    { id: 'olAddProc', type: 'processor', label: '⚙ Processor', placeholder: 'e.g. Payment processor', required: true },
    { id: 'olAddCmd', type: 'command', label: 'Does', placeholder: 'e.g. Capture payment', required: true },
    { id: 'olAddResult', type: 'event', label: '→ Result', placeholder: 'e.g. Payment captured (optional)' }] }
};

// The kinds, for the buttons under a chapter and the tabs in the sheet
export const addKindChoices = Object.entries(addKinds).map(([kind, v]) => ({ kind, label: v.label }));

// chapterId: the chapter the step is added to ('' or null for none); kind: SC, SV or AU
export function outlineAddForm(state, { chapterId = null, kind = 'SC' } = {}) {
  const spec = addKinds[kind] || addKinds.SC;
  const types = [...new Set(spec.fields.map(f => f.type))];
  const elements = Object.values(state.elements);
  const known = Object.fromEntries(types.map(type => {
    const byKey = {};
    for (const e of elements) {
      const key = e.type === type ? e.name.trim().toLowerCase() : '';
      if (key && !byKey[key]) byKey[key] = { id: e.id, todo: !!e.todo };
    }
    return [type, byKey];
  }));
  const names = type => [...new Set(elements.filter(e => e.type === type).map(e => e.name))]
    .map(name => ({ name })).sort(byName).map(n => n.name);
  const shape = addKinds[kind] ? kind : 'SC';
  return {
    kind: shape,
    hint: outlineAddHint({ kind: shape, known }),
    chapterName: chapterId && state.chapters[chapterId] ? state.chapters[chapterId].name : null,
    kinds: addKindChoices.map(k => ({ ...k, active: k.kind === kind })),
    propsNote: spec.propsNote,
    fields: spec.fields.map((f, i) => ({ ...f, last: i === spec.fields.length - 1, names: names(f.type) })),
    known
  };
}
