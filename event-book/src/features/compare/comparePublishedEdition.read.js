// ===========================================
// COMPARE - Compare Published Edition: what the open book's edition is called once Compare published it
// ("3rd edition").
// ===========================================

import { projectState } from '../../core/projections.js';
import { ordinal } from '../editions/rules.js';

export const comparePublishedEdition = () => `${ordinal(projectState().edition.edition)} edition`;
