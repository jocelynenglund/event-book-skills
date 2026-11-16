// ===========================================
// SHARE IMAGE - Share Scope Choices: what the scope button says and offers once the sheet has a scope.
// The scope is kept as long as it still makes sense (chapters that are gone drop off, a slice that is gone
// means the whole model); the choices are this slice (when opened from a slice's menu), the whole model
// (a small book) and the chapters.
// ===========================================

import { sliceTitle } from '../../core/projections.js';
import { shareScopes } from './shareScopes.read.js';
import { scopeOf } from './scope.js';

// scope: the sheet's now (see scopeOf). sliceId: the slice the sheet was opened from, or null.
// -> { scope, scopes (Share Scopes), slice: {id, name} | null, options: [{id, name}], label, showButton, showSearch }
export function shareScopeChoices(state, scope = null, sliceId = null) {
  const wanted = scopeOf(scope);
  // A slice that is gone means the whole model again
  const kept = wanted.slices && !state.slices[wanted.slices[0]] ? null : scope || null;
  const scopes = shareScopes(state, kept);
  const picked = scopes.picked;
  const open = sliceId && state.slices[sliceId];
  const slice = open ? { id: open.id, name: 'This slice: ' + sliceTitle(open, state) } : null;
  const options = [...(slice ? [{ id: 'slice:' + slice.id, name: slice.name }] : []),
    ...(scopes.whole ? [{ id: '', name: 'Whole model' }] : []), ...scopes.chapters.map(c => ({ id: c.chapterId, name: c.name }))];
  const ticked = (scopeOf(picked).chapters || []).map(id => options.find(o => o.id === id)?.name).filter(Boolean);
  const label = ticked.length ? ticked[0] + (ticked.length > 1 ? ` + ${ticked.length - 1} more` : '')
    : (options.find(o => o.id === (picked || '')) || options[0])?.name || '';
  return { scope: picked, scopes, slice, options, label, showButton: options.length >= 2, showSearch: options.length > 8 };
}
