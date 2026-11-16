// ===========================================
// OUTLINE EDIT FORM (SV) - what a slice's edit sheet asks for: its main stickies by kind (each with the
// names the book has of that kind, to reuse), how many more it has on the board, its properties as one
// line of text, and its description. null when the book has no such slice.
// ===========================================

import { sliceTitle } from '../../core/projections.js';
import { sliceActor } from '../board/command.js';
import { byName } from '../../core/constants.js';
import { outlinePropertiesText } from './command.js';

export function outlineEditForm(state, sliceId) {
  const slice = state.slices[sliceId];
  if (!slice) return null;
  const els = slice.elements.map(id => state.elements[id]).filter(Boolean);
  const first = type => els.find(e => e.type === type) || null;
  const field = (type, label, required = false) => ({ type, label, required, el: first(type) });
  const asked = slice.type === 'SV' ? [field('readModel', 'Read model', true)]
    : sliceActor(slice, state) === 'processor' || slice.type === 'AU'
      ? [field('processor', '⚙ Processor', true), field('command', 'Does', true), field('event', '→ Result')]
      : [field('command', 'Command', true), field('event', 'Event')];
  const names = type => [...new Set(Object.values(state.elements).filter(e => e.type === type).map(e => e.name))]
    .map(name => ({ name })).sort(byName).map(n => n.name);
  const shown = new Set(asked.map(f => f.el?.id));
  return {
    sliceId, title: sliceTitle(slice, state),
    fields: asked.map(f => ({ type: f.type, label: f.label, required: f.required, elementId: f.el?.id || '', name: f.el?.name || '', names: names(f.type) })),
    more: slice.elements.filter(id => state.elements[id] && !shown.has(id) && state.elements[id].type !== 'screen').length,
    propsNote: slice.type === 'SV' ? 'read model' : 'command and event',
    props: outlinePropertiesText(slice.id, state),
    description: slice.description || ''
  };
}
