// SCENARIOS - Scenario Given Entries (SV): what a scenario is given, to start the editor from: each event with its example
// values. Events deleted since ("(removed)" on the board) drop out here, so saving cleans them up.
export function scenarioGivenEntries(book, scenario) {
  return (scenario.given || []).filter(g => book.elements[g.elementId])
    .map(g => ({ elementId: g.elementId, values: { ...(g.values || {}) } }));
}
