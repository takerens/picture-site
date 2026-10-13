import '@fontsource-variable/geist';
import './style.css';
import { trips } from './trips.js';
import arrowDown from '@phosphor-icons/core/assets/light/arrow-down-light.svg?raw';

const app = document.getElementById('app');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
let lastSlug = null;
let io;
let clockTimer;

// Shown in the intro's top bar
const HANDLE = '@teckren';
const HOME = { city: 'Singapore', timeZone: 'Asia/Singapore' };
const clockFormat = new Intl.DateTimeFormat('en-GB', { timeZone: HOME.timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit' });

function renderTimeline() {
  document.title = 'Travels';
  if (!trips.length) {
    app.innerHTML = `<main class="page empty"><h1>No trips yet</h1>
      <p>Add a trip with <code>npm run add-trip</code>. See the README.</p></main>`;
    return;
  }
  app.innerHTML = `
    <main class="timeline">
      <section class="intro" id="intro">
        <header class="intro-bar">
          <span>${HANDLE}</span>
          <span>${HOME.city} <time class="clock"></time></span>
        </header>
        <div class="intro-copy">
          <h1>Welcome to my gallery</h1>
          <p>Trips abroad, shot on a Fujifilm X100VI</p>
        </div>
        <div class="prints" style="--n:${trips.length}">
          ${trips.map((t, i) => `
            <a class="print" href="#/${esc(t.slug)}" style="--i:${i}" aria-label="${esc(`${t.location} ${t.year}`)}">
              <img src="${esc(t.coverSmall)}" alt="" decoding="async">
              <span>${esc(t.location)}, ${esc(t.year)}</span>
            </a>`).join('')}
        </div>
        <button type="button" class="down" data-slug="${esc(trips[0].slug)}" aria-label="Scroll to the first trip">${arrowDown}</button>
      </section>
      ${trips.map((t, i) => `
        <a class="trip" id="${esc(t.slug)}" href="#/${esc(t.slug)}">
          <img src="${esc(t.cover)}" alt="" ${i > 1 ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async">
          <h2><span>${esc(t.location)}</span> <span class="year">${esc(t.year)}</span></h2>
          <span class="count">${t.photos.length} photos</span>
        </a>`).join('')}
    </main>
    <nav class="rail away" aria-label="Trips">
      ${trips.map((t) => `
        <button type="button" data-slug="${esc(t.slug)}" aria-label="${esc(`${t.location} ${t.year}`)}">
          <span class="rail-name">${esc(t.location)}</span><span>${esc(t.year)}</span>
        </button>`).join('')}
    </nav>
`;

  const clock = app.querySelector('.clock');
  const tick = () => (clock.textContent = clockFormat.format(new Date()));
  tick();
  clockTimer = setInterval(tick, 1000);

  const rail = app.querySelector('.rail');
  app.querySelector('.timeline').parentNode.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-slug]');
    if (b) document.getElementById(b.dataset.slug).scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      e.target.classList.toggle('active', e.isIntersecting);
      if (e.isIntersecting) {
        rail.classList.toggle('away', e.target.id === 'intro');
        for (const b of rail.children) b.setAttribute('aria-current', b.dataset.slug === e.target.id);
      }
    }
  }, { threshold: 0.55 });
  app.querySelectorAll(".trip, .intro").forEach((el) => io.observe(el));

  if (lastSlug) document.getElementById(lastSlug)?.scrollIntoView();
}

function renderTrip(trip) {
  lastSlug = trip.slug;
  document.title = `${trip.location} ${trip.year}`;
  app.innerHTML = `
    <div class="page">
      <header class="trip-head"><a class="back" href="#/">Back to all trips</a></header>
      <div class="title">
        <h1>${esc(trip.location)} <span class="year">${esc(trip.year)}</span></h1>
        <p>${trip.photos.length} photos</p>
      </div>
      <div class="grid">
        ${trip.photos.map((p, i) => `
          <button class="shot" type="button" data-i="${i}" aria-label="Open photo ${i + 1}">
            <img src="${esc(p.grid)}" width="${p.w}" height="${p.h}" alt="" loading="${i < 6 ? 'eager' : 'lazy'}" decoding="async">
          </button>`).join('')}
      </div>
    </div>`;
  scrollTo(0, 0);

  const grid = app.querySelector('.grid');
  // Fade each photo in once loaded; cached ones are already complete.
  grid.addEventListener('load', (e) => e.target.classList.add('in'), true);
  grid.querySelectorAll('img').forEach((img) => img.complete && img.naturalWidth && img.classList.add('in'));
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('.shot');
    if (b) openLightbox(trip.photos.map((p) => p.full), +b.dataset.i);
  });
}

function renderMissing() {
  document.title = 'Trip not found';
  app.innerHTML = `<main class="page empty"><h1>Trip not found</h1><p><a class="back" href="#/">Back to all trips</a></p></main>`;
}

// Lightbox
const lb = document.querySelector('.lb');
const lbImg = lb.querySelector('img');
let shots = [];
let idx = 0;

function show(i) {
  idx = (i + shots.length) % shots.length;
  lbImg.src = shots[idx];
}
function openLightbox(photos, i) {
  shots = photos;
  show(i);
  lb.showModal();
}
lb.querySelector('.lb-close').onclick = () => lb.close();
lb.querySelector('.lb-prev').onclick = () => show(idx - 1);
lb.querySelector('.lb-next').onclick = () => show(idx + 1);
// Tap left/right half of the photo to move, like a phone gallery.
lbImg.onclick = (e) => show(e.offsetX < lbImg.clientWidth / 2 ? idx - 1 : idx + 1);
lb.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') show(idx - 1);
  if (e.key === 'ArrowRight') show(idx + 1);
});
lb.addEventListener('close', () => lbImg.removeAttribute('src'));

// Router: "#/" = timeline, "#/<folder>" = trip
function route() {
  io?.disconnect();
  clearInterval(clockTimer);
  if (lb.open) lb.close();
  const slug = decodeURIComponent(location.hash.slice(2));
  const trip = trips.find((t) => t.slug === slug);
  if (trip) renderTrip(trip);
  else if (slug) renderMissing();
  else renderTimeline();
}
addEventListener('hashchange', route);
route();
