// ===========================================
// REVIEW LINKS - Client (docs/server-sync-plan.md → "Review links")
// The owner sends a library book out for review: a link for someone without an account,
// for feedback on the plan or for testing an edition, that ends on a date or when revoked.
// The reviewer opens it (?review=<token>), picks a nickname and gets the book on their
// device; only comments (and scenarios, if the link allows; test verdicts on a test link)
// can change, and those go straight to the owner's book on the server.
// ===========================================

import { api, serverIdOfModel } from '../sync/client.js';
import { readModelEvents, replaceModelEvents, createModel, listModels, setTypeGuard, onAppend, getCurrentModelId } from '../../core/eventStore.js';
import { commentEventTypes } from '../../core/constants.js';
import { canAddScenariosShared } from '../shared/client.js';

export const APP_URL = 'https://eventpad.itsybit.se/';
export const reviewUrl = token => `${APP_URL}?review=${encodeURIComponent(token)}`;

const TOKENS_KEY = 'eventpad_review_tokens';   // owner: reviewId → token (the server shows it only once)
const BOOKS_KEY = 'eventpad_reviewing';        // reviewer: local model id → { token, reviewerId, modelId, name, purpose, canAddScenarios, expiresAt, position, synced, ended }
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full: next time */ } };

// ---------- The owner ----------

const reviewsPath = modelId => `/models/${encodeURIComponent(serverIdOfModel(modelId))}/reviews`;

export async function createReview(modelId, { purpose = 'feedback', canAddScenarios = false, days = 14, edition = null } = {}) {
  const r = await api('POST', reviewsPath(modelId), { purpose, canAddScenarios, days, ...(edition != null ? { edition } : {}) });
  write(TOKENS_KEY, { ...read(TOKENS_KEY, {}), [r.reviewId]: r.token });
  return { ...r, url: reviewUrl(r.token) };
}

// Each review link of a book; the link itself when this device made it
export async function listReviews(modelId) {
  const tokens = read(TOKENS_KEY, {});
  return (await api('GET', reviewsPath(modelId))).map(r => ({ ...r, url: tokens[r.reviewId] ? reviewUrl(tokens[r.reviewId]) : null }));
}

export const revokeReview = (modelId, reviewId) => api('POST', `${reviewsPath(modelId)}/${encodeURIComponent(reviewId)}/revoke`);

// ---------- The reviewer ----------

const tokenPath = token => `/reviews/${encodeURIComponent(token)}`;
export const reviewBooks = () => read(BOOKS_KEY, {});
export const reviewOf = id => reviewBooks()[id] || null;
const setReview = (id, r) => { const all = reviewBooks(); if (r) all[id] = r; else delete all[id]; write(BOOKS_KEY, all); };

// What a link is for (404 unknown, 410 ended: thrown with .status)
export const peekReview = token => api('GET', tokenPath(token));

// A link opened again on this device goes to the same book
export const bookForToken = token => Object.entries(reviewBooks()).find(([id, r]) => r.token === token && listModels().some(m => m.id === id))?.[0] || null;

// Join under a nickname, then fetch the book onto this device. Returns its local id.
export async function joinReview(token, nickname, info) {
  const { reviewerId } = await api('POST', `${tokenPath(token)}/join`, { nickname });
  const r = await api('GET', `${tokenPath(token)}/events?after=0`);
  const undone = new Set(r.undone || []);
  const events = (r.events || []).filter(e => !undone.has(e.batch));
  const id = createModel(events);
  setReview(id, { token, reviewerId, modelId: info.modelId, name: info.name, purpose: info.purpose, canAddScenarios: !!info.canAddScenarios,
    edition: info.edition ?? null, expiresAt: info.expiresAt, position: r.position, synced: (r.events || []).map(e => e.id), ended: false });
  return id;
}

// What a review link lets its reviewer change
const scenarioTypes = new Set(['ScenarioAdded', 'ScenarioDeleted', 'ScenarioRenamed', 'ScenarioMustHaveSet', 'GivenSet', 'WhenSet',
  'ThenEventSet', 'ThenRejectionSet', 'ThenReadModelSet', 'SliceRefinedCleared', 'SliceBuiltCleared', 'SliceReadyCleared']);
export function reviewAllows(r, type) {
  if (!r || r.ended) return false;
  if (commentEventTypes.has(type)) return true;
  if (type === 'ScenarioTested') return r.purpose === 'test';
  return !!r.canAddScenarios && scenarioTypes.has(type);
}
// A review link's book, or a book shared with this account, that lets scenarios be added
export const canAddScenariosHere = () => { const r = reviewOf(getCurrentModelId()); return !!(r && !r.ended && r.canAddScenarios) || canAddScenariosShared(); };

// Up what the server lacks, down what this device lacks (like a library book's sync)
const running = new Map();
export function syncReview(id) {
  const r = reviewOf(id);
  if (!r || r.ended) return Promise.resolve();
  if (running.has(id)) return running.get(id);
  const job = (async () => {
    const local = readModelEvents(id);
    const synced = new Set(r.synced);
    const fresh = local.filter(e => !synced.has(e.id) && reviewAllows(r, e.type));
    let res;
    try {
      res = fresh.length
        ? await api('POST', `${tokenPath(r.token)}/events`, { reviewerId: r.reviewerId, after: r.position, events: fresh })
        : await api('GET', `${tokenPath(r.token)}/events?after=${r.position}`);
    } catch (e) {
      if (e.status === 410) setReview(id, { ...r, ended: true });
      throw e;
    }
    const have = new Set(local.map(e => e.id));
    const incoming = (res.events || []).filter(e => !have.has(e.id));
    const undone = new Set(res.undone || []);
    if (incoming.length || undone.size) {
      const merged = [...local, ...incoming].sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || ''))).filter(e => !undone.has(e.batch));
      replaceModelEvents(id, merged);
    }
    setReview(id, { ...reviewOf(id), position: res.position, synced: [...new Set([...r.synced, ...fresh.map(e => e.id), ...incoming.map(e => e.id)])] });
    return { up: fresh.length, down: incoming.length };
  })().finally(() => running.delete(id));
  running.set(id, job);
  return job;
}

export function initReviewClient() {
  // On a review book only what the link allows; elsewhere the usual rules (null)
  setTypeGuard((id, type) => {
    const r = reviewOf(id);
    if (!r) return null;
    return type === null ? false : reviewAllows(r, type);
  });
  let timer = null;
  onAppend(() => {
    const id = getCurrentModelId();
    if (!reviewOf(id)) return;
    clearTimeout(timer);
    timer = setTimeout(() => syncReview(id).catch(() => {}), 2000);
  });
  document.addEventListener('visibilitychange', () => {
    const id = getCurrentModelId();
    if (document.visibilityState === 'visible' && reviewOf(id)) syncReview(id).catch(() => {});
  });
}
