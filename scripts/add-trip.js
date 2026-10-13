// Usage: npm run add-trip -- "<source folder>" <YYYY-MM-location> [cover photo filename]
// Makes two copies of each photo (never cropped or recoloured, location data stripped),
// uploads them to Cloudflare R2, and records the trip in src/photos.json.
import sharp from 'sharp';
import { AwsClient } from 'aws4fetch';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, parse } from 'node:path';
import { parseTrip } from '../src/parse.js';

const SIZES = {
  full: { edge: 3840, quality: 92 }, // full-screen viewer and timeline backgrounds
  grid: { edge: 1200, quality: 85 }, // trip grid and landing-page prints
};
const MANIFEST = 'src/photos.json';

const [src, slug, coverFile] = process.argv.slice(2);
if (!src || !slug || !parseTrip(slug)) {
  console.error('Usage: npm run add-trip -- "<source folder>" <YYYY-MM-location> [cover photo filename]\n  e.g. npm run add-trip -- ~/Pictures/Japan 2024-05-tokyo DSCF0412.JPG');
  process.exit(1);
}

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
  console.error('Missing R2 settings. Copy .env.local.example to .env.local and fill it in (see README).');
  process.exit(1);
}
const endpoint = process.env.R2_ENDPOINT ?? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const r2 = new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto' });

// Hard stop before the R2 free tier (10GB). Override with R2_STORAGE_LIMIT_GB in .env.local.
const limitBytes = Number(process.env.R2_STORAGE_LIMIT_GB ?? 9.5) * 1e9;
async function bucketBytes() {
  let total = 0;
  let token = '';
  do {
    const res = await r2.fetch(`${endpoint}/${R2_BUCKET}?list-type=2${token && `&continuation-token=${encodeURIComponent(token)}`}`);
    if (!res.ok) throw new Error(`Could not read bucket size (${res.status}): ${await res.text()}`);
    const xml = await res.text();
    for (const [, size] of xml.matchAll(/<Size>(\d+)<\/Size>/g)) total += Number(size);
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? xml.match(/<NextContinuationToken>([^<]+)</)?.[1] ?? '' : '';
  } while (token);
  return total;
}
let used = await bucketBytes();
const gb = (b) => (b / 1e9).toFixed(2);
console.log(`Bucket uses ${gb(used)} GB of your ${gb(limitBytes)} GB limit.`);

const files = (await readdir(src))
  .filter((f) => /\.(jpe?g|png|tiff?|webp)$/i.test(f))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
if (!files.length) {
  console.error(`No JPEG/PNG/TIFF/WebP photos found in ${src}. Export RAF/HEIF files to JPEG first.`);
  process.exit(1);
}

const photos = [];
// shortcut: one photo at a time, fine for a few hundred per trip; add a small concurrency pool if uploads feel slow.
for (const [i, f] of files.entries()) {
  const name = parse(f).name;
  let dims;
  for (const [size, { edge, quality }] of Object.entries(SIZES)) {
    const { data, info } = await sharp(join(src, f))
      .rotate() // bake in camera orientation (portrait stays portrait) before metadata is dropped
      .resize(edge, edge, { fit: 'inside', withoutEnlargement: true })
      .withIccProfile('srgb') // only a colour profile is kept: EXIF, GPS and the rest are stripped
      .jpeg({ quality, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    if (size === 'full') dims = { w: info.width, h: info.height };
    if (used + data.length > limitBytes) {
      console.error(`\nStopped at ${f}: uploading it would pass your ${gb(limitBytes)} GB storage limit (${gb(used)} GB used).`);
      console.error('Nothing was added to the site. Free up space in R2 or raise R2_STORAGE_LIMIT_GB in .env.local.');
      process.exit(1);
    }
    used += data.length;
    const res = await r2.fetch(`${endpoint}/${R2_BUCKET}/${slug}/${size}/${encodeURIComponent(name)}.jpg`, {
      method: 'PUT',
      body: data,
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000' },
    });
    if (!res.ok) {
      console.error(`Upload failed for ${f} (${res.status}): ${await res.text()}`);
      process.exit(1); // manifest untouched, so the site never points at missing files
    }
  }
  photos.push({ name, ...dims });
  console.log(`${i + 1}/${files.length}  ${f}`);
}

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
manifest[slug] = { cover: coverFile ? parse(coverFile).name : photos[0].name, photos };
await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
console.log(`\nUploaded ${photos.length} photos for ${slug} and updated ${MANIFEST}.`);
