// ===========================================
// LITERATURE - Votes Download (SV: Votes Download)
// The tally as a Markdown file: its name (the book's, slugged) and its text.
// ===========================================

import { tallyMarkdown } from './votes.js';

const slug = t => String(t || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60);

export const votesDownload = state => ({ file: `${slug(state.modelName) || 'book'}-votes.md`, markdown: tallyMarkdown(state) });
