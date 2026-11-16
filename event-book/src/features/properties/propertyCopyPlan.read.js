// PROPERTIES - Property Copy Plan (SV): what Copy all / Replace theirs would do. Generated properties never travel:
// the source's aren't copied, and Replace keeps the target's own. Copy updates a property of the same name; Replace
// removes the target's own first. null when the source or every target is gone.
export function propertyCopyPlan(book, sourceId, targetIds, replace) {
  const source = book.elements[sourceId];
  const targets = [...targetIds].map(id => book.elements[id]).filter(Boolean);
  if (!source || !targets.length) return null;
  const copyable = source.properties.filter(p => !p.generated).map(p => ({ name: p.name, type: p.type || 'string', items: p.items || null }));
  return {
    names: targets.map(t => t.name), copyable,
    targets: targets.map(t => ({
      id: t.id,
      remove: replace ? t.properties.filter(p => !p.generated).map(p => p.id) : [],
      // for each property to copy: the target's property of that name to update, or null to add one
      sameAs: copyable.map(p => (replace ? null : t.properties.find(tp => tp.name.toLowerCase() === p.name.toLowerCase())?.id || null))
    }))
  };
}
