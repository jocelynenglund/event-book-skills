// ===========================================
// SCENARIOS - View (SV: View Scenario)
// ===========================================

import { externalAttr } from '../../core/constants.js';
import { idsHidden, aliaser, shownEntries } from './ids.js';

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Only values that were filled in: an empty one says nothing
// A generated spec still marked pending in the build: not passing yet, or passing (its mark can go)
export const pendingMark = scn => scn?.pending === 'not passing yet'
  ? ' <span class="scn-pending" title="A generated spec: written, not passing yet">⏳ not passing yet</span>'
  : scn?.pending === 'passing' ? ' <span class="scn-pending passing" title="Passing: the builder can take its pending mark off">✓ passing, still marked pending</span>' : '';

export const filled = v => v !== '' && v !== null && v !== undefined
  && !(Array.isArray(v) && !v.length) && !(typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
export const hasValues = scn => [...(scn.given || []).map(g => g.values), scn.when?.values, scn.then?.values, ...(scn.then?.rows || [])]
  .some(v => v && Object.values(v).some(filled));

// Ids show as aliases (#1, #2: the same alias for the same value in a scenario), or not at all
let alias = aliaser(), hideIds = false;
function renderValues(values, el = null) {
  const entries = shownEntries(Object.entries(values || {}).filter(([, v]) => filled(v)), el, alias, hideIds);
  if (!entries.length) return '';
  return ` <span class="gwt-values">{ ${entries.map(([k, v, isAlias]) => `${escapeHtml(k)}: ${isAlias ? `<span class="gwt-id">${escapeHtml(v)}</span>` : escapeHtml(typeof v === 'string' ? `"${v}"` : JSON.stringify(v))}`).join(', ')} }</span>`;
}

let withValues = true;
function ref(el, values) {
  return el ? `<span class="gwt-ref" data-type="${el.type}"${externalAttr(el)}>${escapeHtml(el.name)}</span>${withValues ? renderValues(values, el) : ''}` : '<span class="gwt-missing">(removed)</span>';
}

// One scenario as Given / And / When / Then lines, with the values it sets (values: false, names only)
export function renderGwt(scn, state, { values = true } = {}) {
  withValues = values;
  alias = aliaser(); hideIds = idsHidden();
  try { return gwtLines(scn, state); } finally { withValues = true; }
}

function gwtLines(scn, state) {
  const lines = [];
  (scn.given || []).forEach((g, i) => {
    lines.push(`<div class="gwt-line"><span class="gwt-kw">${i === 0 ? 'Given' : 'And'}</span><span class="gwt-body">${ref(state.elements[g.elementId], g.values)}</span></div>`);
  });
  if (!scn.given?.length) lines.push(`<div class="gwt-line"><span class="gwt-kw">Given</span><span class="gwt-body"><span class="gwt-none">nothing happened yet</span></span></div>`);
  if (scn.when?.commandId) {
    lines.push(`<div class="gwt-line"><span class="gwt-kw">When</span><span class="gwt-body">${ref(state.elements[scn.when.commandId], scn.when.values)}</span></div>`);
  }
  const then = scn.then;
  let thenHtml = '<span class="gwt-none">not set</span>';
  if (then?.type === 'event') thenHtml = ref(state.elements[then.eventId], then.values);
  else if (then?.type === 'readModel' && then.rows?.length && !withValues) thenHtml = `${ref(state.elements[then.readModelId])} <span class="gwt-values">(${then.rows.length} ${then.rows.length === 1 ? 'row' : 'rows'})</span>`;
  else if (then?.type === 'readModel' && then.rows?.length) {
    thenHtml = `${ref(state.elements[then.readModelId])}<span class="gwt-rows">${then.rows.map(r => `<span class="gwt-row">${renderValues(r, state.elements[then.readModelId])}</span>`).join('')}</span>`;
  }
  else if (then?.type === 'readModel') thenHtml = ref(state.elements[then.readModelId], then.values);
  else if (then?.type === 'rejection') thenHtml = `<span class="gwt-reject">Rejected: ${escapeHtml(then.reason || '')}</span>`;
  lines.push(`<div class="gwt-line"><span class="gwt-kw">Then</span><span class="gwt-body">${thenHtml}</span></div>`);
  return `<div class="gwt">${lines.join('')}</div>`;
}

// Render scenario section for a slice (element-level only)
export function renderScenarioSection(scenarios, state) {
  if (!scenarios || scenarios.length === 0) return '';
  
  const cards = scenarios.map(scn => {
    // Build preview with colored references (Given/And/When/Then format)
    let previewLines = [];
    
    if (scn.given?.length > 0) {
      scn.given.forEach((g, i) => {
        const el = state.elements[g.elementId];
        if (el) {
          const keyword = i === 0 ? 'Given' : 'And';
          previewLines.push(`<span class="keyword">${keyword}</span> <span class="event-ref">${el.name}</span>`);
        }
      });
    }
    
    if (scn.type === 'SC' && scn.when?.commandId) {
      const cmd = state.elements[scn.when.commandId];
      if (cmd) {
        previewLines.push(`<span class="keyword">When</span> <span class="command-ref">${cmd.name}</span>`);
      }
    }
    
    if (scn.then) {
      if (scn.then.type === 'event') {
        const evt = state.elements[scn.then.eventId];
        if (evt) {
          previewLines.push(`<span class="keyword">Then</span> <span class="event-ref">${evt.name}</span>`);
        }
      } else if (scn.then.type === 'rejection') {
        previewLines.push(`<span class="keyword">Then</span> <span class="rejection-ref">Rejected: "${scn.then.reason || ''}"</span>`);
      } else if (scn.then.type === 'readModel') {
        const rm = state.elements[scn.then.readModelId];
        if (rm) {
          previewLines.push(`<span class="keyword">Then</span> <span class="rm-ref">${rm.name}</span>`);
        }
      }
    }
    
    return `
      <div class="scenario-card" onclick="window.EventPad.editScenario('${scn.id}')">
        <span class="close-btn" onclick="event.stopPropagation(); window.EventPad.deleteScenario('${scn.id}')">×</span>
        <div class="scenario-header">
          <span class="scenario-name">${scn.name}</span>
        </div>
        <div class="scenario-preview">${previewLines.join('<br>') || 'Tap to edit...'}</div>
      </div>
    `;
  }).join('');
  
  const sliceId = scenarios[0]?.sliceId || '';
  const sliceType = scenarios[0]?.type || 'SC';
  
  return `
    <div class="scenarios-section">
      <h4>SCENARIOS (${scenarios.length})</h4>
      ${cards}
      <button class="add-scenario-btn" onclick="event.stopPropagation(); window.EventPad.addScenario('${sliceId}', '${sliceType}')">+ Add scenario</button>
    </div>
  `;
}
