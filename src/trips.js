import { parseTrip } from './parse.js';
import manifest from './photos.json';

// photos.json is written by `npm run add-trip`; the files themselves live in Cloudflare R2.
const base = (import.meta.env.VITE_PHOTO_BASE ?? '').trim().replace(/\/$/, ''); // tolerate pasted spaces / trailing slash
const url = (slug, size, name) => `${base}/${slug}/${size}/${encodeURIComponent(name)}.jpg`;

export const trips = Object.keys(manifest).length
  ? Object.entries(manifest)
      .reverse() // photos.json is in upload order, so same-month ties end up latest-uploaded first
      .map(([folder, t]) => {
        const trip = parseTrip(folder);
        if (!trip || !t.photos.length) return null;
        const cover = t.photos.find((p) => p.name === t.cover) ?? t.photos[0];
        return {
          ...trip,
          cover: url(folder, 'full', cover.name),
          coverSmall: url(folder, 'grid', cover.name),
          photos: t.photos.map((p) => ({ grid: url(folder, 'grid', p.name), full: url(folder, 'full', p.name), w: p.w, h: p.h })),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.sortKey.localeCompare(a.sortKey)) // newest month first; sort is stable, so ties keep the order above
  : demoTrips();

// Sample trips so the layout is visible before any photos are added.
function demoTrips() {
  const sizes = [[1200, 1600], [1600, 1067], [1200, 1500], [1600, 1200], [1200, 1800]];
  return [
    '2025-03-kyoto', '2024-09-reykjavik', '2023-06-lisbon', '2022-12-hanoi',
    '2022-04-seoul', '2021-08-melbourne', '2019-11-marrakech', '2019-04-istanbul',
  ].map((folder) => ({
    ...parseTrip(folder),
    cover: `https://picsum.photos/seed/${folder}-cover/2000/1300`,
    coverSmall: `https://picsum.photos/seed/${folder}-cover/1000/650`,
    photos: Array.from({ length: 14 }, (_, i) => {
      const [w, h] = sizes[i % sizes.length];
      return { grid: `https://picsum.photos/seed/${folder}-${i}/${w / 2}/${h / 2}`, full: `https://picsum.photos/seed/${folder}-${i}/${w}/${h}`, w, h };
    }),
  }));
}
