// SCENARIOS - Scenario Editor Choices (SV): what the editor's When and Then offer for a scenario of a slice, and how each is
// filled in so far. A change slice (SC): When picks one of the slice's commands (the only command is the When unless another
// was chosen already) with its values; Then is an event (any in the book) with its values, or a rejection with its reason.
// A view slice (SV): Then picks one of the slice's read models with its values, or its example rows when it is a list.
// null when the slice is gone.
import { byName } from '../../core/constants.js';
import { scenarioElementFields } from './scenarioElementFields.read.js';
import { scenarioGivenPool } from './scenarioGivenPool.read.js';

export function scenarioEditorChoices(book, sliceId, scenario) {
  const slice = book.slices[sliceId];
  if (!slice) return null;
  const sliceElements = slice.elements.map(id => book.elements[id]).filter(Boolean);
  const named = type => sliceElements.filter(e => e.type === type).sort(byName).map(e => ({ id: e.id, name: e.name }));
  const then = scenario.then;
  const inputsOf = (id, prefix, values) => (id ? scenarioElementFields(book, id, prefix, values) : null);

  if (scenario.type === 'SC') {
    const commands = named('command');
    const events = scenarioGivenPool(book, sliceId).map(e => ({ id: e.id, name: e.name }));
    const selectedCommand = commands.find(c => c.id === scenario.when?.commandId)
      || (!scenario.when?.commandId && commands.length === 1 ? commands[0] : null);
    const isEvent = then?.type === 'event';
    return {
      sliceId, type: 'SC',
      when: { commands, selectedId: selectedCommand?.id || '', inputs: inputsOf(selectedCommand?.id, 'when', scenario.when?.values) },
      then: {
        kind: then?.type === 'rejection' || then?.type === 'nothing' ? then.type : 'event', events, selectedId: then?.eventId || '',
        inputs: isEvent ? inputsOf(events.find(e => e.id === then.eventId)?.id, 'then-event', then.values) : null,
        reason: then?.type === 'rejection' ? then.reason || '' : '',
        nothingReason: then?.type === 'nothing' ? then.reason || '' : ''
      }
    };
  }
  const readModels = named('readModel');
  const selected = readModels.find(rm => rm.id === then?.readModelId);
  const inputs = inputsOf(selected?.id, 'then-rm', then?.values);
  return {
    sliceId, type: scenario.type,
    then: {
      readModels, selectedId: then?.readModelId || '', inputs,
      // A list read model: its example rows (values), one by one
      rows: inputs?.isList ? (then.rows?.length ? then.rows.map(r => ({ ...r })) : [{}]) : []
    }
  };
}
