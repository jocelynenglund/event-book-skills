// ===========================================
// PROPERTIES - Commands
// SC: Add Property — a field on a sticky (the property sheet; the outline adds them its own way).
// A sticky in a refined slice takes refined (and built) back from every slice it sits in (see sliceRefined).
// ===========================================

import { appendEvent, EventTypes } from '../../core/eventStore.js';

const newPropertyId = () => 'prop_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

export function addProperty(elementId, name, propertyType = 'string', items = null) {
  const propertyId = newPropertyId();
  appendEvent(EventTypes.PropertyAdded, { elementId, propertyId, name, propertyType, ...(items ? { items } : {}) });
  return propertyId;
}
