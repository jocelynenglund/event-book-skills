// ===========================================
// SCENARIOS - Commands
// ===========================================

import { appendEvent, EventTypes } from '../../core/eventStore.js';

// Generate unique ID
function uid() {
  return 'scn_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
}

// Add scenario to slice (source: where its test is, { file, line }, when it came from one)
// pending: from a test export, a generated spec still marked "not built yet": 'not passing yet' or 'passing'
export function addScenario(sliceId, name, scenarioType, source = null, pending = null) {
  const scenarioId = uid();
  appendEvent(EventTypes.ScenarioAdded, {
    sliceId,
    scenarioId,
    name,
    scenarioType,
    ...(source?.file ? { source: { file: source.file, ...(source.line ? { line: source.line } : {}) } } : {}),
    ...(pending ? { pending } : {})
  });
  return scenarioId;
}

// A must have is an acceptance criterion; anything else is a nice to have
export function setMustHave(scenarioId, mustHave) {
  appendEvent(EventTypes.ScenarioMustHaveSet, { scenarioId, mustHave: !!mustHave });
}

// Onto another slice (one whose own slice was deleted, say)
export function moveScenario(scenarioId, sliceId) {
  appendEvent(EventTypes.ScenarioMoved, { scenarioId, sliceId });
}

export function renameScenario(scenarioId, name) {
  appendEvent(EventTypes.ScenarioRenamed, { scenarioId, name });
}

// Delete scenario
export function deleteScenario(scenarioId, sliceId) {
  appendEvent(EventTypes.ScenarioDeleted, {
    scenarioId,
    sliceId
  });
}

// Set Given events
export function setGiven(scenarioId, events) {
  appendEvent(EventTypes.GivenSet, {
    scenarioId,
    events // [{elementId, values}]
  });
}

// Set When command (SC scenarios only)
export function setWhen(scenarioId, commandId, values) {
  appendEvent(EventTypes.WhenSet, {
    scenarioId,
    commandId,
    values
  });
}

// Set Then event (SC scenarios - success)
export function setThenEvent(scenarioId, eventId, values) {
  appendEvent(EventTypes.ThenEventSet, {
    scenarioId,
    eventId,
    values
  });
}

// Set Then rejection (SC scenarios - failure)
export function setThenRejection(scenarioId, reason) {
  appendEvent(EventTypes.ThenRejectionSet, {
    scenarioId,
    reason
  });
}

// Set Then read model (SV scenarios)
// rows: for a read model that's a list, its example rows (each like values)
export function setThenReadModel(scenarioId, readModelId, values, rows = null) {
  appendEvent(EventTypes.ThenReadModelSet, {
    scenarioId,
    readModelId,
    values,
    ...(rows ? { rows } : {})
  });
}
