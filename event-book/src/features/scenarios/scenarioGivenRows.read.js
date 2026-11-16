// SCENARIOS - Scenario Given Rows (SV): the events a scenario is given, in order, as the editor lists them (the same event can
// come more than once, each with its own example values). An event deleted since drops out (its row's index stays the entry's).
import { scenarioElementFields } from './scenarioElementFields.read.js';

export function scenarioGivenRows(book, entries) {
  return entries.flatMap((g, index) => {
    const inputs = scenarioElementFields(book, g.elementId, 'given', g.values);
    return inputs ? [{ index, elementId: g.elementId, name: inputs.name, inputs }] : [];
  });
}
