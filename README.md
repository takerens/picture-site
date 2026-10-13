# picture-site

A timeline of overseas trips. Each scroll is one trip, and clicking a trip opens a VSCO-style grid of its photos.

## Photo storage (one-time setup)

Photos live in Cloudflare R2, not in this repo. The repo only keeps `src/photos.json`, a list of trips and photo sizes.

1. Create a free Cloudflare account, open **R2**, and create a bucket (e.g. `teckren-photos`).
2. In the bucket's **Settings > Public access**, enable the **r2.dev** URL (or connect your own domain). You'll need that URL in steps 4 and 5.
3. In **R2 > Manage API tokens**, create a token with **Object Read & Write** on that bucket.
4. Copy `.env.local.example` to `.env.local` and fill in the public URL, your account ID, the token's access key ID and secret, and the bucket name. `.env.local` is never committed or deployed.
5. On GitHub, open the repo's **Settings > Secrets and variables > Actions > Variables** and add a variable `VITE_PHOTO_BASE` with the public URL, so the deployed site knows where the photos are.

## Add a trip

```bash
npm run add-trip -- "/path/to/your/photos" 2024-05-tokyo DSCF0412.JPG
```

- Reads every JPEG/PNG/TIFF/WebP in the folder. Your original files are never modified. RAF/HEIF need exporting to JPEG first.
- Makes two copies of each photo, never cropped or recoloured, so your film simulation and portrait/landscape orientation stay exactly as shot:
  - a 3840px copy for the full-screen viewer;
  - a 1200px copy for the grid.
- Strips all metadata from the copies, including GPS location. Only a standard sRGB colour profile is kept.
- Uploads both copies to R2 and adds the trip to `src/photos.json`. Commit that file to publish the trip.
- `2024-05-tokyo` shows as **Tokyo 2024**. The month is optional and only used for ordering. Multi-word places use hyphens: `2023-new-york`.
- The last argument (optional) picks the cover photo; otherwise the first photo is used. You can also change `cover` in `src/photos.json` later.
- Running it again for the same trip replaces that trip's photo list.
- To remove a trip, delete its entry from `src/photos.json`. Its files stay in R2 until you delete them in the Cloudflare dashboard.

If `src/photos.json` is empty, sample trips are shown instead.

### Staying inside the free tier

R2 has no built-in spending cap, so:
- `add-trip` checks the bucket's size first and refuses to upload past 9.5 GB (set `R2_STORAGE_LIMIT_GB` in `.env.local` to change it). If it stops partway through a trip, the site is unchanged, but the photos it already uploaded stay in R2.
- Create the bucket with **Standard** storage. Infrequent Access has no free allowance.
- Add a billing alert in Cloudflare: **Notifications > Add > Billing usage alert**. It emails you; it doesn't block anything.

## Run

```bash
npm install
npm run dev
```

`npm run build` writes a static site to `dist/` that you can host anywhere (GitHub Pages, Netlify, Vercel).

## Deploy

Pushing to `main` publishes the site to GitHub Pages via `.github/workflows/deploy.yml`.
One-time setup: on GitHub, go to the repo's Settings > Pages and set Source to **GitHub Actions**.
The site then lives at https://takerens.github.io/picture-site/
