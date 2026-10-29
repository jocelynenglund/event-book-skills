// Lists of books and references read alphabetically: by name, any case, numbers in number
// order ("Build 9" before "Build 10")
export const byName = (a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { numeric: true, sensitivity: 'base' });
