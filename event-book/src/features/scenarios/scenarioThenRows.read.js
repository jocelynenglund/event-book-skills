// SCENARIOS - Scenario Then Rows (SV): a list read model's example rows, one by one, each with the value boxes of one row
// (null when the read model is gone)
import { scenarioElementFields } from './scenarioElementFields.read.js';

export function scenarioThenRows(book, readModelId, rows) {
  if (!book.elements[readModelId]) return null;
  return { readModelId, rows: rows.map((values, index) => ({ index, inputs: scenarioElementFields(book, readModelId, 'then-row', values) })) };
}
