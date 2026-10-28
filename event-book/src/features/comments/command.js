// ===========================================
// COMMENTS - Commands
// SC: Set Nickname — kept on this device, not in the book; asked before the first comment.
// SC: Add Comment — on a slice, or on one of its scenarios (part: given | when | then).
// SC: Resolve Comment — anyone who can comment. SC: Delete Comment — only from the device that wrote it.
// Comments are talk, not changes: they go onto read-only and published books too, and they
// never clear Refined or Done (eventStore and the refined rule leave them alone).
// Each command returns the reason it was refused, or null.
// ===========================================

import { appendEvent, EventTypes } from '../../core/eventStore.js';
import { projectState } from '../../core/projections.js';

const NICKNAME_KEY = 'eventpad_nickname';
const DEVICE_KEY = 'eventpad_comment_device';
export const MAX_NICKNAME = 24;
export const PARTS = ['given', 'when', 'then'];

const read = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* this time only */ } };

// Signed in, a comment carries the account's name (its email before the @) unless a
// nickname was picked; signed out, the nickname picked on this device
const signedIn = () => { try { return JSON.parse(read('eventpad_account') || 'null'); } catch (e) { return null; } };
const accountName = a => { const n = (a?.email || '').split('@')[0]; return n ? n[0].toUpperCase() + n.slice(1) : null; };
export const nickname = () => read(NICKNAME_KEY) || accountName(signedIn()) || null;

// Who wrote a comment, on this device: what lets its writer delete it
export function commentDeviceId() {
  let id = read(DEVICE_KEY);
  if (!id) { id = 'cd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); write(DEVICE_KEY, id); }
  return id;
}

export function setNickname(name) {
  const n = String(name || '').trim();
  if (!n) return 'Pick a nickname';
  if (n.length > MAX_NICKNAME) return `Keep it to ${MAX_NICKNAME} characters`;
  write(NICKNAME_KEY, n);
  return null;
}

const commentId = () => 'cm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);

export function addComment({ sliceId, scenarioId = null, part = null, text }) {
  const nick = nickname();
  if (!nick) return 'Pick a nickname first';
  const body = String(text || '').trim();
  if (!body) return 'Write something first';
  const state = projectState();
  if (!state.slices[sliceId]) return 'No such slice';
  if (scenarioId && state.scenarios[scenarioId]?.sliceId !== sliceId) return 'No such scenario';
  if (part && !PARTS.includes(part)) return 'A comment is on the given, the when or the then';
  appendEvent(EventTypes.CommentAdded, {
    commentId: commentId(), sliceId, ...(scenarioId ? { scenarioId } : {}), ...(scenarioId && part ? { part } : {}),
    text: body, nickname: nick, deviceId: commentDeviceId(), ...(signedIn()?.accountId ? { accountId: signedIn().accountId } : {}), at: new Date().toISOString()
  });
  return null;
}

export function resolveComment(commentId) {
  const c = projectState().comments[commentId];
  if (!c || c.deleted) return 'No such comment';
  if (c.resolved) return 'Already resolved';
  appendEvent(EventTypes.CommentResolved, { commentId, resolvedBy: nickname() || 'someone' });
  return null;
}

export function deleteComment(commentId) {
  const c = projectState().comments[commentId];
  if (!c || c.deleted) return 'No such comment';
  if (c.deviceId !== commentDeviceId()) return 'Only the one who wrote it can delete it';
  appendEvent(EventTypes.CommentDeleted, { commentId });
  return null;
}
