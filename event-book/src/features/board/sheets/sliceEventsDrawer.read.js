// BOARD SHEETS - Slice Events Drawer (SV): a slice's events, one by one (the board folds them into a pile): each says where it
// comes from and where a tap goes (the command that produces it, else its sticky to read or edit). A view's events are in two
// groups once it has scenarios: what none of them starts from, and what some do. givens: the events its scenarios start from
// (they belong to other slices, so they are read, not edited). readOnly: not checked out here, so no ✎ and no +.
// null when the slice is gone.
import { sliceTitle, getOrderedSlices, givenEventsOf } from '../../../core/projections.js';
import { elementLabel, externalAttr, propLabel } from '../../../core/constants.js';

// Where an event comes from: the first change (or automation) slice that has it and a command
function producerOf(eventId, book) {
  const isCommand = id => book.elements[id]?.type === 'command';
  const slice = getOrderedSlices(book).find(s => s.type !== 'SV' && s.elements.includes(eventId) && s.elements.some(isCommand));
  return slice ? { slice, commandId: slice.elements.find(isCommand) } : null;
}

export function sliceEventsDrawer(book, sliceId, { readOnly = false, givens = false } = {}) {
  const slice = book.slices[sliceId];
  if (!slice) return null;
  const given = givens ? givenEventsOf(sliceId, book) : [];
  const events = givens ? given.map(g => g.element) : slice.elements.map(id => book.elements[id]).filter(el => el?.type === 'event');
  const reads = slice.type === 'SV';
  const used = id => given.find(g => g.element.id === id)?.scenarios || 0;
  const covered = new Set(givenEventsOf(sliceId, book).map(g => g.element.id));
  const split = !givens && reads && covered.size > 0;
  const groups = split
    ? [{ title: 'No scenario yet', items: events.filter(e => !covered.has(e.id)) }, { title: 'With scenarios', items: events.filter(e => covered.has(e.id)) }].filter(g => g.items.length)
    : [{ title: '', items: events }];
  const locked = readOnly || givens;
  return {
    sliceId, heading: givens ? 'Given in its scenarios' : reads ? 'Events it reads' : 'Events', sub: sliceTitle(slice, book),
    readOnly: locked, addLabel: reads ? 'An event it reads' : 'Event',
    groups: groups.map(g => ({
      title: g.title,
      rows: g.items.map(el => {
        const from = producerOf(el.id, book);
        return {
          id: el.id, name: el.name, type: el.type, attrs: externalAttr(el), sliceId,
          kind: `${elementLabel(el)} · ${from ? `↳ from ${sliceTitle(from.slice, book)}` : 'nothing produces it yet'}${givens ? ` · in ${used(el.id)} ${used(el.id) === 1 ? 'scenario' : 'scenarios'}` : ''}`,
          props: (el.properties || []).map(propLabel),
          // where a tap goes: to the command that produces it, else to the sticky (read, or edit when it can be)
          go: from ? { action: 'event-go', el: from.commandId, slice: from.slice.id } : { action: locked ? 'event-read' : 'event-edit', el: el.id, slice: sliceId },
          editable: !locked
        };
      })
    }))
  };
}
