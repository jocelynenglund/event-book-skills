// ===========================================
// CONNECT - Command
// ===========================================

import { appendEvent, EventTypes } from '../../core/eventStore.js';
import { projectState } from '../../core/projections.js';
import { hideAllSheets } from '../../ui/sheets.js';
import { showToast } from '../../ui/toast.js';
import { render } from '../../ui/feed.js';
import { promptSliceNaming } from '../nameSlice/sheet.js';

let selectedElement = null;

export function getSelectedElement() {
  return selectedElement;
}

export function setSelectedElement(element) {
  selectedElement = element;
}

export function dispatchConnection(relation, targetType, sliceType) {
  hideAllSheets();
  
  const name = prompt(`Name the ${targetType}:`);
  if (!name) return;

  const newElementId = 'el_' + Date.now();
  
  // 1. Create the new element
  appendEvent(EventTypes.ElementCreated, {
    elementId: newElementId,
    elementType: targetType,
    name
  });

  // 2. Create connection
  const fromId = (relation === 'producer' || relation === 'trigger') ? newElementId : selectedElement.id;
  const toId = (relation === 'producer' || relation === 'trigger') ? selectedElement.id : newElementId;
  
  appendEvent(EventTypes.ProducerSet, {
    fromId,
    toId,
    relation
  });

  // 3. Check if selected element is already in a slice
  const state = projectState();
  const existingSlice = Object.values(state.slices).find(s => 
    s.elements.includes(selectedElement.id)
  );
  
  if (existingSlice) {
    // Add new element to existing slice
    let position = 'end';
    
    if (targetType === 'screen' && relation === 'input') {
      position = 'start';
    } else if (targetType === 'readModel') {
      position = 'end';
    }
    
    appendEvent(EventTypes.SliceElementAdded, {
      sliceId: existingSlice.id,
      elementId: newElementId,
      position
    });
    
    showToast('Added to slice!');
  } else if (sliceType) {
    // 4. Infer new slice if pattern detected
    inferNewSlice(sliceType, relation, newElementId, state);
  }

  showToast(`${targetType} connected!`);
  render();
}

function inferNewSlice(sliceType, relation, newElementId, state) {
  const sliceId = 'slice_' + Date.now();
  let elements = [];
  let commandId = null;
  let eventId = null;
  
  if (sliceType === 'SC') {
    if (relation === 'producer') {
      commandId = newElementId;
      eventId = selectedElement.id;
    } else if (relation === 'produces') {
      commandId = selectedElement.id;
      eventId = newElementId;
    }
    
    // Check for pre-connected elements
    const inputScreens = state.connections
      .filter(c => c.from === commandId && c.relation === 'input')
      .map(c => c.to)
      .filter(id => state.elements[id]?.type === 'screen');
    
    const outputReadModels = state.connections
      .filter(c => c.from === eventId && c.relation === 'consumer')
      .map(c => c.to)
      .filter(id => state.elements[id]?.type === 'readModel');
    
    elements = [...inputScreens, commandId, eventId, ...outputReadModels];
    
  } else if (sliceType === 'SV') {
    let eventIds = [];
    let readModelId = null;
    
    if (relation === 'consumer') {
      eventIds = [selectedElement.id];
      readModelId = newElementId;
    } else if (relation === 'updatedBy') {
      eventIds = [newElementId];
      readModelId = selectedElement.id;
    }
    
    const otherEvents = state.connections
      .filter(c => c.to === readModelId && (c.relation === 'consumer' || c.relation === 'updatedBy'))
      .map(c => c.from)
      .filter(id => state.elements[id]?.type === 'event' && !eventIds.includes(id));
    
    const displayScreens = state.connections
      .filter(c => c.from === readModelId && c.relation === 'display')
      .map(c => c.to)
      .filter(id => state.elements[id]?.type === 'screen');
    
    elements = [...displayScreens, readModelId, ...otherEvents, ...eventIds];
    
  } else if (sliceType === 'AU') {
    elements = [selectedElement.id, newElementId];
  }

  appendEvent(EventTypes.SliceInferred, {
    sliceId,
    sliceType,
    elements,
    complete: sliceType !== 'AU'
  });

  // Show naming prompt
  const patternDesc = 
    sliceType === 'SC' ? 'Command → Event forms a State Change slice' :
    sliceType === 'SV' ? 'Event → Read Model forms a State View slice' :
    'Event → Processor starts an Automation slice';
  
  promptSliceNaming(sliceId, patternDesc);
}
