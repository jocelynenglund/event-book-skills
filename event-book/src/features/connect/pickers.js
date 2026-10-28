// ===========================================
// CONNECT - Element Pickers
// ===========================================

import { appendEvent, EventTypes } from '../../core/eventStore.js';
import { projectState } from '../../core/projections.js';
import { typeIcons, typeLabels, byName } from '../../core/constants.js';
import { showSheet, hideAllSheets } from '../../ui/sheets.js';
import { showToast } from '../../ui/toast.js';
import { render } from '../../ui/feed.js';
import { getSelectedElement, dispatchConnection, setSelectedElement } from './command.js';
import { promptSliceNaming } from '../nameSlice/sheet.js';

let pendingPicker = null;
let multiPickerSelection = new Set();
let multiPickerConfig = null;

export function showPicker(targetType, relation, sliceType) {
  hideAllSheets();
  
  const state = projectState();
  const availableElements = Object.values(state.elements)
    .filter(el => el.type === targetType)
    .sort(byName);
  
  console.log('showPicker called:', { targetType, relation, sliceType });
  console.log('Available elements:', availableElements);
  
  document.getElementById('pickerSheetTitle').textContent = `Pick ${typeLabels[targetType]}`;
  
  const pickerOptions = document.getElementById('pickerOptions');
  const pickerEmpty = document.getElementById('pickerEmpty');
  
  // Always hide empty state, always show "Create new" option
  pickerEmpty.style.display = 'none';
  
  // Create new option at the top
  let optionsHtml = `
    <div class="sheet-option" onclick="window.EventPad.createNewFromPicker('${targetType}', '${relation}', '${sliceType}')">
      <div class="sheet-option-icon" style="background: var(--${targetType}); color: ${targetType === 'command' || targetType === 'processor' ? '#fff' : '#000'};">+</div>
      <div class="sheet-option-text">
        <div class="sheet-option-title">Create new ${typeLabels[targetType]}</div>
        <div class="sheet-option-desc">Add a new element</div>
      </div>
    </div>
  `;
  
  // Existing elements
  if (availableElements.length > 0) {
    optionsHtml += availableElements.map(el => `
      <div class="sheet-option" onclick="window.EventPad.pickElement('${el.id}')">
        <div class="sheet-option-icon" style="background: var(--${el.type}); color: ${el.type === 'command' || el.type === 'processor' ? '#fff' : '#000'};">${typeIcons[el.type]}</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title">${el.name}</div>
          <div class="sheet-option-desc">${typeLabels[el.type]}</div>
        </div>
      </div>
    `).join('');
  }
  
  pickerOptions.innerHTML = optionsHtml;
  
  pendingPicker = { targetType, relation, sliceType };
  showSheet('pickerSheet');
}

export function createNewFromPicker(targetType, relation, sliceType) {
  hideAllSheets();
  dispatchConnection(relation, targetType, sliceType);
}

export function showDirectPicker(elementId, targetType, relation) {
  const state = projectState();
  const element = state.elements[elementId];
  setSelectedElement(element);
  
  console.log('showDirectPicker:', { elementId, targetType, relation, element });
  showPicker(targetType, relation, ''); // No sliceType for screens
}

export function pickElement(elementId) {
  if (!pendingPicker) return;
  
  const { targetType, relation, sliceType } = pendingPicker;
  const state = projectState();
  const selectedElement = getSelectedElement();
  const pickedElement = state.elements[elementId];
  
  hideAllSheets();
  
  // Special case: Processor picking command - create AU slice
  if (selectedElement.type === 'processor' && targetType === 'command') {
    createAUSlice(elementId, state, selectedElement);
    pendingPicker = null;
    render();
    return;
  }
  
  // Default: Create connection to existing element
  appendEvent(EventTypes.ProducerSet, {
    fromId: selectedElement.id,
    toId: elementId,
    relation
  });
  
  // Check if selected element is in a slice
  const existingSlice = Object.values(state.slices).find(s => 
    s.elements.includes(selectedElement.id)
  );
  
  if (existingSlice) {
    appendEvent(EventTypes.SliceElementAdded, {
      sliceId: existingSlice.id,
      elementId: elementId
    });
    showToast(`${pickedElement.name} added to slice!`);
  } else {
    showToast(`Connected to ${pickedElement.name}`);
  }
  
  pendingPicker = null;
  render();
}

function createAUSlice(commandId, state, selectedElement) {
  // Find trigger connection for this processor
  const triggerConn = state.connections.find(c => 
    c.to === selectedElement.id && c.relation === 'trigger'
  );
  
  if (!triggerConn) return;
  
  // Create connection to command
  appendEvent(EventTypes.ProducerSet, {
    fromId: selectedElement.id,
    toId: commandId,
    relation: 'invokes'
  });
  
  // Get the readModelId from trigger event's SV slice
  const triggerEventId = triggerConn.from;
  const svSlice = Object.values(state.slices).find(s => 
    s.type === 'SV' && s.elements.includes(triggerEventId)
  );
  const primaryReadModelId = svSlice?.elements.find(id => 
    state.elements[id]?.type === 'readModel'
  );
  
  // Get additional context ReadModels
  const contextConns = state.connections.filter(c => 
    c.from === selectedElement.id && c.relation === 'context'
  );
  const additionalReadModelIds = contextConns.map(c => c.to);
  
  // Build elements array
  const elements = [triggerEventId];
  if (primaryReadModelId) elements.push(primaryReadModelId);
  additionalReadModelIds.forEach(id => {
    if (!elements.includes(id)) elements.push(id);
  });
  elements.push(selectedElement.id, commandId);
  
  const sliceId = 'slice_' + Date.now();
  
  appendEvent(EventTypes.SliceInferred, {
    sliceId,
    sliceType: 'AU',
    elements,
    complete: true
  });
  
  showToast(`AU slice created!`);
  
  // Prompt for name
  promptSliceNaming(sliceId, `${selectedElement.name} Automation`);
}

// SV Picker - shows events from existing SV slices for AU trigger
export function showSVPicker() {
  hideAllSheets();
  
  const state = projectState();
  const svSlices = Object.values(state.slices).filter(s => s.type === 'SV' && s.name);
  
  document.getElementById('pickerSheetTitle').textContent = 'Pick Trigger from State View';
  
  const pickerOptions = document.getElementById('pickerOptions');
  const pickerEmpty = document.getElementById('pickerEmpty');
  
  if (svSlices.length === 0) {
    pickerOptions.innerHTML = '';
    pickerEmpty.textContent = 'No State Views yet. Create an SV slice first (Event → ReadModel).';
    pickerEmpty.style.display = 'block';
  } else {
    pickerEmpty.style.display = 'none';
    
    let html = '';
    svSlices.forEach(sv => {
      const events = sv.elements
        .map(id => state.elements[id])
        .filter(el => el && el.type === 'event');
      
      const readModel = sv.elements
        .map(id => state.elements[id])
        .find(el => el && el.type === 'readModel');
      
      if (events.length > 0 && readModel) {
        html += `<div style="padding: 8px 16px; color: var(--text-muted); font-size: 12px; text-transform: uppercase;">${sv.name}</div>`;
        events.forEach(evt => {
          html += `
            <div class="sheet-option" onclick="window.EventPad.pickSVTrigger('${evt.id}', '${readModel.id}', '${sv.id}')">
              <div class="sheet-option-icon" style="background: var(--event);">🟧</div>
              <div class="sheet-option-text">
                <div class="sheet-option-title">${evt.name}</div>
                <div class="sheet-option-desc">+ 🟩 ${readModel.name} as context</div>
              </div>
            </div>
          `;
        });
      }
    });
    
    pickerOptions.innerHTML = html || '<div style="padding: 16px; color: var(--text-muted);">No events in State Views</div>';
  }
  
  showSheet('pickerSheet');
}

// SC Picker - shows existing SC slices + option to create new command
export function showSCPicker() {
  hideAllSheets();

  const state = projectState();
  const scSlices = Object.values(state.slices).filter(s => s.type === 'SC' && s.name);

  document.getElementById('pickerSheetTitle').textContent = 'Pick State Change to produce';

  const pickerOptions = document.getElementById('pickerOptions');
  const pickerEmpty = document.getElementById('pickerEmpty');

  pickerEmpty.style.display = 'none';

  // Create new command (will float until event is connected → SC inferred)
  let html = `
    <div class="sheet-option" onclick="window.EventPad.createNewSCCommand()">
      <div class="sheet-option-icon" style="background: var(--command); color: #fff;">+</div>
      <div class="sheet-option-text">
        <div class="sheet-option-title">Create new Command</div>
        <div class="sheet-option-desc">Connect an event to complete the SC slice</div>
      </div>
    </div>
  `;

  if (scSlices.length === 0) {
    html += `<div style="padding: 12px 16px; color: var(--text-muted); font-size: 13px;">No State Change slices yet — create one above</div>`;
  } else {
    scSlices.forEach(sc => {
      const command = sc.elements.map(id => state.elements[id]).find(el => el?.type === 'command');
      const event = sc.elements.map(id => state.elements[id]).find(el => el?.type === 'event');
      if (command) {
        html += `
          <div class="sheet-option" onclick="window.EventPad.pickSCSlice('${sc.id}')">
            <div class="sheet-option-icon" style="background: var(--command); color: #fff;">🟦</div>
            <div class="sheet-option-text">
              <div class="sheet-option-title">${sc.name}</div>
              <div class="sheet-option-desc">${command.name}${event ? ' → ' + event.name : ''}</div>
            </div>
          </div>
        `;
      }
    });
  }

  pickerOptions.innerHTML = html;
  showSheet('pickerSheet');
}

export function createNewSCCommand() {
  hideAllSheets();

  const name = prompt('Name the Command:');
  if (!name) return;

  const selectedElement = getSelectedElement(); // the processor
  const newCommandId = 'el_' + Date.now();

  appendEvent(EventTypes.ElementCreated, {
    elementId: newCommandId,
    elementType: 'command',
    name
  });

  appendEvent(EventTypes.ProducerSet, {
    fromId: selectedElement.id,
    toId: newCommandId,
    relation: 'invokes'
  });

  // Add command to the AU slice
  const state = projectState();
  const auSlice = Object.values(state.slices).find(s =>
    s.type === 'AU' && s.elements.includes(selectedElement.id)
  );
  if (auSlice) {
    appendEvent(EventTypes.SliceElementAdded, {
      sliceId: auSlice.id,
      elementId: newCommandId
    });
  }

  showToast(`🟦 ${name} created — connect an event to complete the SC slice`);
  render();
}

export function pickSCSlice(scSliceId) {
  hideAllSheets();

  const state = projectState();
  const selectedElement = getSelectedElement(); // the processor
  const scSlice = state.slices[scSliceId];
  if (!scSlice) return;

  const command = scSlice.elements.map(id => state.elements[id]).find(el => el?.type === 'command');
  if (!command) return;

  // Connect processor → command
  appendEvent(EventTypes.ProducerSet, {
    fromId: selectedElement.id,
    toId: command.id,
    relation: 'invokes'
  });

  // Find or create the AU slice
  const stateAfter = projectState();
  const auSlice = Object.values(stateAfter.slices).find(s =>
    s.type === 'AU' && s.elements.includes(selectedElement.id)
  );
  if (auSlice) {
    scSlice.elements.forEach(elId => {
      if (!auSlice.elements.includes(elId)) {
        appendEvent(EventTypes.SliceElementAdded, {
          sliceId: auSlice.id,
          elementId: elId
        });
      }
    });
    showToast(`AU slice connected to ${scSlice.name}!`);
  } else {
    // No AU slice yet — build from connections
    const triggerConn = stateAfter.connections.find(c =>
      c.to === selectedElement.id && c.relation === 'trigger'
    );
    const svSlice = triggerConn ? Object.values(stateAfter.slices).find(s =>
      s.type === 'SV' && s.elements.includes(triggerConn.from)
    ) : null;
    const svElements = svSlice ? svSlice.elements : (triggerConn ? [triggerConn.from] : []);
    const auSliceId = 'slice_au_' + Date.now();
    appendEvent(EventTypes.SliceInferred, {
      sliceId: auSliceId,
      sliceType: 'AU',
      elements: [...svElements, selectedElement.id, ...scSlice.elements],
      complete: true
    });
    promptSliceNaming(auSliceId, `${selectedElement.name} Automation`);
    showToast(`AU slice created with ${scSlice.name}!`);
  }
  render();
}

export function pickSVTrigger(eventId, readModelId, svSliceId) {
  hideAllSheets();
  
  const state = projectState();
  const selectedElement = getSelectedElement(); // the processor
  const evt = state.elements[eventId];
  
  appendEvent(EventTypes.TriggerSet, {
    fromId: eventId,
    toId: selectedElement.id,
    relation: 'trigger',
    readModelId: readModelId
  });

  // Create AU slice now — processor + SV elements
  const svSlice = state.slices[svSliceId];
  const existingAU = Object.values(state.slices).find(s =>
    s.type === 'AU' && s.elements.includes(selectedElement.id)
  );
  if (!existingAU && svSlice) {
    const auSliceId = 'slice_' + Date.now();
    const elements = [...svSlice.elements, selectedElement.id];
    appendEvent(EventTypes.SliceInferred, {
      sliceId: auSliceId,
      sliceType: 'AU',
      elements,
      complete: false
    });
    promptSliceNaming(auSliceId, `${selectedElement.name} Automation`);
  }
  
  showToast(`Trigger set: ${evt.name}. Now pick ‘Produces State Change’.`);
  render();
}

// ===========================================
// MULTI-SELECT PICKER (for SV slices)
// ===========================================

export function showMultiPicker(targetType, relation, sliceType) {
  hideAllSheets();
  
  const state = projectState();
  const availableElements = Object.values(state.elements)
    .filter(el => el.type === targetType)
    .sort(byName);
  
  multiPickerSelection = new Set();
  multiPickerConfig = { targetType, relation, sliceType };
  
  document.getElementById('multiPickerSheetTitle').textContent = `Who produces this?`;
  
  const pickerOptions = document.getElementById('multiPickerOptions');
  const pickerEmpty = document.getElementById('multiPickerEmpty');
  const confirmBtn = document.getElementById('multiPickerConfirm');
  
  pickerEmpty.style.display = 'none';

  // "Create new event" always at top — new event floats (no slice inferred yet)
  let optionsHtml = `
    <div class="sheet-option" onclick="window.EventPad.createNewProducerEvent()">
      <div class="sheet-option-icon" style="background: var(--event);">+</div>
      <div class="sheet-option-text">
        <div class="sheet-option-title">Create new Event</div>
        <div class="sheet-option-desc">Add a new event — connect a command later</div>
      </div>
    </div>
  `;

  if (availableElements.length > 0) {
    optionsHtml += availableElements.map(el => `
      <div class="sheet-option" data-element-id="${el.id}" onclick="window.EventPad.toggleMultiPickerItem('${el.id}')">
        <div class="sheet-option-icon" style="background: var(--${el.type}); color: ${el.type === 'command' || el.type === 'processor' ? '#fff' : '#000'};">${typeIcons[el.type]}</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title">${el.name}</div>
          <div class="sheet-option-desc">${typeLabels[el.type]}</div>
        </div>
        <span class="check">✓</span>
      </div>
    `).join('');
  }

  pickerOptions.innerHTML = optionsHtml;
  
  updateMultiPickerButton();
  showSheet('multiPickerSheet');
}

export function toggleMultiPickerItem(elementId) {
  if (multiPickerSelection.has(elementId)) {
    multiPickerSelection.delete(elementId);
  } else {
    multiPickerSelection.add(elementId);
  }
  
  // Update visual state
  const option = document.querySelector(`[data-element-id="${elementId}"]`);
  if (option) {
    option.classList.toggle('selected', multiPickerSelection.has(elementId));
  }
  
  updateMultiPickerButton();
}

function updateMultiPickerButton() {
  const btn = document.getElementById('multiPickerConfirm');
  const count = multiPickerSelection.size;
  btn.textContent = `Create SV Slice (${count} event${count !== 1 ? 's' : ''})`;
  btn.disabled = count === 0;
}

export function createNewProducerEvent() {
  hideAllSheets();

  const name = prompt('Name the Event:');
  if (!name) return;

  const state = projectState();
  const selectedElement = getSelectedElement();
  const readModelId = selectedElement.id;
  const newEventId = 'el_' + Date.now();

  // Create the event
  appendEvent(EventTypes.ElementCreated, {
    elementId: newEventId,
    elementType: 'event',
    name
  });

  // Connect: event → readModel (floating — no slice, no command yet)
  appendEvent(EventTypes.ConsumerAdded, {
    fromId: newEventId,
    toId: readModelId,
    relation: 'consumer'
  });

  showToast(`🟧 ${name} created — connect a command to complete the slice`);
  render();
}

export function confirmMultiPick() {
  if (multiPickerSelection.size === 0 || !multiPickerConfig) return;
  
  const state = projectState();
  const selectedElement = getSelectedElement();
  const readModelId = selectedElement.id;
  const eventIds = Array.from(multiPickerSelection);
  
  hideAllSheets();
  
  // Create connections from each event to the read model
  eventIds.forEach(eventId => {
    appendEvent(EventTypes.ConsumerAdded, {
      fromId: eventId,
      toId: readModelId,
      relation: 'consumer'
    });
  });
  
  // Create SV slice: events... → readModel
  const sliceId = 'slice_' + Date.now();
  const elements = [...eventIds, readModelId];
  
  appendEvent(EventTypes.SliceInferred, {
    sliceId,
    sliceType: 'SV',
    elements,
    complete: true
  });
  
  // Show naming prompt
  const eventNames = eventIds.map(id => state.elements[id]?.name).join(', ');
  showToast(`SV slice created with ${eventIds.length} event${eventIds.length > 1 ? 's' : ''}!`);
  
  promptSliceNaming(sliceId, `${selectedElement.name} View`);
  
  multiPickerSelection = new Set();
  multiPickerConfig = null;
  render();
}

// Add a screen to an existing SV or SC slice (called from "+Add screen" placeholder)
export function showAddScreenToSlice(sliceId) {
  hideAllSheets();

  const state = projectState();
  const screens = Object.values(state.elements).filter(e => e.type === 'screen').sort(byName);

  document.getElementById('pickerSheetTitle').textContent = 'Pick Screen';
  const pickerOptions = document.getElementById('pickerOptions');
  const pickerEmpty = document.getElementById('pickerEmpty');

  pendingPicker = { targetType: 'screen', relation: 'screen', sliceType: null, addToSliceId: sliceId };

  if (screens.length === 0) {
    pickerOptions.innerHTML = '';
    pickerEmpty.textContent = 'No screens yet.';
    pickerEmpty.style.display = 'block';
  } else {
    pickerEmpty.style.display = 'none';
    pickerOptions.innerHTML = screens.map(s => `
      <div class="picker-option" onclick="window.EventPad.pickScreenForSlice('${s.id}')">
        <span class="element-type-dot screen"></span>
        <span>${s.name}</span>
      </div>
    `).join('');
  }

  // Always show create option
  pickerOptions.innerHTML += `
    <div class="picker-option picker-create" onclick="window.EventPad.createScreenForSlice('${sliceId}')">
      + Create new screen
    </div>
  `;

  showSheet('pickerSheet');
}

export function pickScreenForSlice(screenId) {
  if (!pendingPicker?.addToSliceId) return;
  const sliceId = pendingPicker.addToSliceId;
  hideAllSheets();
  appendEvent(EventTypes.SliceElementAdded, {
    sliceId,
    elementId: screenId,
    position: 'start'
  });
  pendingPicker = null;
  render();
  showToast('Screen added!');
}

export function createScreenForSlice(sliceId) {
  hideAllSheets();
  const name = prompt('Screen name:');
  if (!name) return;
  const screenId = 'el_' + Date.now();
  appendEvent(EventTypes.ElementCreated, {
    elementId: screenId,
    elementType: 'screen',
    name
  });
  appendEvent(EventTypes.SliceElementAdded, {
    sliceId,
    elementId: screenId,
    position: 'start'
  });
  pendingPicker = null;
  render();
  showToast('Screen created and added!');
}
