// Folder name -> trip info. "2024-05-new-york" or "2024-new-york" -> { location: "New York", year: "2024" }
export function parseTrip(folder) {
  const m = folder.match(/^(\d{4})(?:-(\d{2}))?-(.+)$/);
  if (!m) return null;
  const [, year, month = '00', rest] = m;
  const location = rest.split('-').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  return { slug: folder, year, sortKey: `${year}-${month}`, location };
}
