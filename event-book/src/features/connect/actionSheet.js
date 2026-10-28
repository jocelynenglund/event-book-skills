// ===========================================
// CONNECT - Action Sheet
// ===========================================

import { projectState } from '../../core/projections.js';
import { typeIcons, typeLabels, elementActions } from '../../core/constants.js';
import { showSheet, hideAllSheets } from '../../ui/sheets.js';
import { showToast } from '../../ui/toast.js';
import { setSelectedElement, getSelectedElement, dispatchConnection } from './command.js';
import { showPicker, showSVPicker, showSCPicker } from './pickers.js';

export function showActions(elementId, e) {
  if (e) e.stopPropagation();
  
  const state = projectState();
  const element = state.elements[elementId];
  setSelectedElement(element);
  
  // Debug: log element info
  console.log('showActions for:', elementId, 'type:', element?.type, 'name:', element?.name);
  console.log('Available actions:', elementActions[element.type]);
  
  let actions = elementActions[element.type] || [];
  
  // Context-aware filtering for processors
  if (element.type === 'processor') {
    const inSlice = Object.values(state.slices).find(s => 
      s.elements.includes(element.id) && s.type === 'AU'
    );
    
    if (inSlice) {
      actions = [];
    } else {
      const hasTrigger = state.connections.some(c => 
        c.to === element.id && c.relation === 'trigger'
      );
      
      if (hasTrigger) {
        actions = actions.filter(a => a.relation === 'context' || a.relation === 'invokes');
      } else {
        actions = actions.filter(a => a.relation === 'trigger');
      }
    }
  }
  
  if (actions.length === 0) {
    showToast('No actions available');
    return;
  }
  
  document.getElementById('actionSheetTitle').textContent = element.name;
  document.getElementById('actionOptions').innerHTML = actions.map(action => {
    let onclick;
    let desc;
    
    if (action.svPicker) {
      onclick = `window.EventPad.showSVPicker()`;
      desc = 'Pick from State View';
    } else if (action.scPicker) {
      onclick = `window.EventPad.showSCPicker()`;
      desc = 'Pick or create State Change';
    } else if (action.multiPicker) {
      onclick = `window.EventPad.showMultiPicker('${action.target}', '${action.relation}', '${action.sliceType || ''}')`;
      desc = 'Select existing';
    } else if (action.picker) {
      onclick = `window.EventPad.showPicker('${action.target}', '${action.relation}', '${action.sliceType || ''}')`;
      desc = 'Pick existing';
    } else {
      onclick = `window.EventPad.dispatchConnection('${action.relation}', '${action.target}', '${action.sliceType || ''}')`;
      desc = 'Create new';
    }
    
    return `
      <div class="sheet-option" onclick="${onclick}">
        <div class="sheet-option-icon" style="background: var(--${action.target}); color: ${action.target === 'command' || action.target === 'processor' ? '#fff' : '#000'};">${typeIcons[action.target]}</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title">${action.label}</div>
          <div class="sheet-option-desc">${desc} ${typeLabels[action.target]}</div>
        </div>
      </div>
    `;
  }).join('');
  
  showSheet('actionSheet');
}
