// PROPERTIES - Property Suggestions (SV): property names on stickies connected to this one that it doesn't have yet,
// A to Z, each saying where it comes from (generated ones are never suggested)
import { byName } from '../../core/constants.js';

export function propertySuggestions(book, elementId) {
  const element = book.elements[elementId];
  if (!element) return [];
  const have = new Set(element.properties.map(p => p.name.toLowerCase()));
  const seen = new Set();
  const out = [];
  book.connections
    .filter(c => c.from === elementId || c.to === elementId)
    .map(c => book.elements[c.from === elementId ? c.to : c.from])
    .filter(Boolean)
    .forEach(other => other.properties.filter(p => !p.generated).forEach(p => {
      const key = p.name.toLowerCase();
      if (have.has(key) || seen.has(key)) return;
      seen.add(key);
      out.push({ name: p.name, type: p.type || 'string', from: other.name });
    }));
  return out.sort(byName);
}
