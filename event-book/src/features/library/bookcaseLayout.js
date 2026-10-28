// ===========================================
// LIBRARY - Bookcase layout (pure): which books stand on which row
// ===========================================

// Slot widths in reading order → rows of indices, each row as full as it can be without
// going past rowWidth (a book wider than the row still gets a row of its own)
export function layoutRows(widths, rowWidth) {
  const rows = [];
  let row = [], used = 0;
  widths.forEach((w, i) => {
    if (row.length && used + w > rowWidth) { rows.push(row); row = []; used = 0; }
    row.push(i);
    used += w;
  });
  if (row.length) rows.push(row);
  return rows;
}
