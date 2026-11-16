// ELEMENT MENU - Element Menu Options (SV): what the ⋮ on a sticky offers, in the order the menu lists them:
// a processor's inputs, a read model's list and to-do marks, what wakes a processor, external / legacy table / integration event on an event,
// then comment (in a slice), properties, connect, remove from slice (in a slice) and delete.
// Each: { key, call (the EventPad function it runs), passThis, icon, iconClass, iconBg, title, desc, danger }.
import { elementMenuState } from './elementMenuState.read.js';
import { elementMenuTrigger } from './elementMenuTrigger.read.js';

const GREY = 'var(--surface-hover)';

export function elementMenuOptions(book, elementId, sliceId = null) {
  const el = elementMenuState(book, elementId);
  if (!el) return null;
  const trigger = elementMenuTrigger(book, elementId, sliceId);
  const props = book.elements[elementId].properties;
  const option = (key, call, icon, title, desc, more = {}) => ({ key, call, passThis: false, icon, iconClass: '', iconBg: GREY, title, desc, danger: false, ...more });
  return [
    el.type === 'processor' && option('processorInputs', 'menuProcessorInputs', '⚙', 'Reads & triggers…', 'The read models it uses and the events that wake it', { iconBg: 'var(--note-readModel)' }),
    el.type === 'readModel' && !el.todo && option('list', 'menuToggleList', '≡', el.list ? 'A single record' : 'A list of rows',
      el.list ? 'One of these, not many' : 'Many of these; its properties describe one row', { iconBg: el.list ? 'var(--note-readModel)' : GREY }),
    el.type === 'readModel' && option('todo', 'menuToggleTodo', '☑', el.todo ? 'Not a to-do list' : 'Mark as to-do list',
      el.todo ? 'Back to a plain read model' : 'A work queue an automation picks items from', { iconBg: el.todo ? 'var(--note-readModel)' : GREY }),
    el.type === 'readModel' && el.todo && option('updatedBy', 'menuUpdatedBy', '+', 'Updated by…', 'Pick the events that add or tick off items', { iconBg: 'var(--note-event)' }),
    trigger && option('trigger', 'menuToggleTrigger', '⚡', trigger.triggering ? `Doesn't trigger ${trigger.name}` : `Triggers ${trigger.name}`,
      trigger.triggering ? 'Only feeds its read models' : 'This event wakes the processor up', { iconBg: trigger.triggering ? 'var(--note-processor)' : GREY }),
    el.type === 'event' && option('external', 'menuToggleExternal', '⇄', el.external ? 'Mark as internal' : 'Mark as external',
      el.external ? 'Happens in this system (orange)' : 'Comes from another system (yellow)', { iconBg: null, iconClass: `bd-type-icon-external${el.external ? ' on' : ''}` }),
    el.type === 'event' && option('table', 'menuToggleTable', '▦', el.table ? 'Not a legacy table' : 'Mark as legacy table',
      el.table ? 'A real event again (orange)' : 'A table in an old database, read as events (shadowy orange)', { iconBg: null, iconClass: `bd-type-icon-table${el.table ? ' on' : ''}` }),
    el.type === 'event' && !el.external && option('published', 'menuTogglePublished', '↗', el.published ? 'Not an integration event' : 'Mark as integration event',
      el.published ? 'Private to this system again' : 'Published to other systems: its fields are a contract (outward arrow)', { iconBg: null, iconClass: `bd-type-icon-published${el.published ? ' on' : ''}` }),
    sliceId && option('comment', 'menuComment', '💬', 'Comment', 'On this slice, for whoever reads the plan'),
    option('properties', 'menuProperties', '📝', 'Properties', props.length ? `${props.length} · ${props.map(p => p.name).join(', ')}` : 'No properties'),
    option('connect', 'menuConnect', '🔗', 'Connect', 'Link to other elements'),
    sliceId && option('removeFromSlice', 'menuRemoveFromSlice', '↩︎', 'Remove from slice', 'Keeps it in the model'),
    option('delete', 'menuDelete', '🗑️', 'Delete', 'Remove element', { passThis: true, iconBg: '#c0392b', danger: true })
  ].filter(Boolean);
}
