// Страница отдельного объекта
import { loadSiteData } from './api.js';
import { icon } from './icons.js';
import {
  esc, paragraphs, sized, coverOf, guestsWord, priceLabel, contactButtons, formatPrice,
  renderHeader, renderFooter, initReveal, setMeta, openLightbox, addSwipe, reducedMotion, PLACEHOLDER
} from './ui.js';

const root = document.getElementById('object-root');

function galleryHTML(p) {
  const photos = p.photos && p.photos.length ? p.photos : [{ url: PLACEHOLDER }];
  return `
    <div class="gallery" id="gallery">
      <div class="g-stage">
        <div class="g-track" id="g-track">
          ${photos.map((ph, i) => `<div class="g-slide"><img src="${esc(sized(ph.url, 1600))}" alt="${esc(p.title)} — фото ${i + 1}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async"></div>`).join('')}
        </div>
        ${photos.length > 1 ? `
          <button class="g-btn g-prev" aria-label="Предыдущее фото">${icon('arrowL')}</button>
          <button class="g-btn g-next" aria-label="Следующее фото">${icon('arrowR')}</button>` : ''}
        <button class="g-full" aria-label="Открыть на весь экран">${icon('expand')}<span class="g-count" id="g-count">1 / ${photos.length}</span></button>
      </div>
      ${photos.length > 1 ? `<div class="g-thumbs" id="g-thumbs">
        ${photos.map((ph, i) => `<button class="g-thumb ${i === 0 ? 'on' : ''}" data-i="${i}" aria-label="Фото ${i + 1}"><img src="${esc(sized(ph.url, 300))}" alt="" loading="lazy"></button>`).join('')}
      </div>` : ''}
    </div>`;
}

function pageHTML(p, s, others) {
  const isBath = p.kind === 'bath';
  const msg = `Здравствуйте! Хочу забронировать «${p.title}». Даты: `;
  return `
    <div class="container obj-top">
      <a class="back-link" href="./index.html#objects">${icon('arrowL')}Все объекты</a>
    </div>
    <div class="container">${galleryHTML(p)}</div>
    <div class="container obj-layout">
      <article class="obj-main">
        <p class="eyebrow">${isBath ? 'Баня' : 'Дом'}</p>
        <h1>${esc(p.title)}</h1>
        <p class="obj-sub">${esc(p.subtitle)}</p>
        <div class="chips">
          ${p.capacity ? `<span class="chip">${icon('users')}до ${esc(p.capacity)} ${guestsWord(p.capacity)}</span>` : ''}
          ${p.area ? `<span class="chip">${icon('area')}${esc(p.area)} м²</span>` : ''}
          ${!isBath ? `<span class="chip">${icon('clock')}заезд ${esc(s.checkin_time)} · выезд ${esc(s.checkout_time)}</span>` : ''}
        </div>
        <section class="obj-block reveal"><h2>Описание</h2><div class="prose">${paragraphs(p.description)}</div></section>
        ${(p.amenities || []).length ? `
        <section class="obj-block reveal"><h2>Удобства</h2>
          <ul class="amenities">${p.amenities.map((a) => `<li>${icon(a.icon)}<span>${esc(a.label)}</span></li>`).join('')}</ul>
        </section>` : ''}
        ${(p.rules || []).length ? `
        <section class="obj-block reveal"><h2>Правила</h2>
          <ul class="rules">${p.rules.map((r) => `<li>${icon('check')}<span>${esc(r)}</span></li>`).join('')}</ul>
        </section>` : ''}
        ${s.booking_terms ? `<section class="obj-block reveal"><h2>Условия бронирования</h2><div class="prose">${paragraphs(s.booking_terms)}</div></section>` : ''}
      </article>
      <aside class="obj-aside">
        <div class="book-card" id="book">
          <div class="price price-lg">${priceLabel(p)}</div>
          ${p.price_note ? `<p class="price-note">${esc(p.price_note)}</p>` : ''}
          <div class="book-buttons">${contactButtons(s, msg, 'btn-block')}</div>
          <p class="book-hint">Сообщите даты и количество гостей — подтвердим бронь и пришлём реквизиты для предоплаты.</p>
        </div>
      </aside>
    </div>
    ${others.length ? `
    <section class="section others">
      <div class="container">
        <h2 class="reveal">Другие объекты</h2>
        <div class="others-grid">
          ${others.map((o, i) => `
            <a class="mini-card reveal" style="--d:${i * 0.08}s" href="./object.html?id=${encodeURIComponent(o.id)}">
              <div class="mini-media"><img src="${esc(sized(coverOf(o), 700))}" alt="${esc(o.title)}" loading="lazy"></div>
              <div><h3>${esc(o.title)}</h3><p class="price">${priceLabel(o)}</p></div>
            </a>`).join('')}
        </div>
      </div>
    </section>` : ''}
    <div class="mobile-bar">
      <div class="price">${formatPrice(p.price)}<span> / ${esc(p.price_unit || 'сутки')}</span></div>
      <a class="btn btn-primary" href="#book">Забронировать</a>
    </div>`;
}

function initGallery(p) {
  const photos = p.photos && p.photos.length ? p.photos : [{ url: PLACEHOLDER }];
  const track = document.getElementById('g-track');
  const count = document.getElementById('g-count');
  const thumbs = document.querySelectorAll('.g-thumb');
  let i = 0;
  const go = (n) => {
    i = (n + photos.length) % photos.length;
    track.style.transform = `translate3d(${-i * 100}%,0,0)`;
    count.textContent = `${i + 1} / ${photos.length}`;
    thumbs.forEach((t, k) => t.classList.toggle('on', k === i));
    const active = thumbs[i];
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
  };
  const prev = document.querySelector('.g-prev');
  const next = document.querySelector('.g-next');
  prev && prev.addEventListener('click', () => go(i - 1));
  next && next.addEventListener('click', () => go(i + 1));
  thumbs.forEach((t) => t.addEventListener('click', () => go(Number(t.dataset.i))));
  const stage = document.querySelector('.g-stage');
  addSwipe(stage, () => go(i + 1), () => go(i - 1));
  track.addEventListener('click', () => openLightbox(photos, i, p.title));
  document.querySelector('.g-full').addEventListener('click', () => openLightbox(photos, i, p.title));
  document.addEventListener('keydown', (e) => {
    if (document.querySelector('.lightbox')) return;
    if (e.key === 'ArrowLeft') go(i - 1);
    if (e.key === 'ArrowRight') go(i + 1);
  });
}

async function main() {
  const { settings: s, properties } = await loadSiteData();
  renderHeader(s, false);
  renderFooter(s);
  const id = new URLSearchParams(location.search).get('id');
  const p = properties.find((x) => String(x.id) === id) || (!id ? properties[0] : null);
  if (!p) {
    setMeta(`Объект не найден — ${s.site_name}`);
    root.innerHTML = `<div class="container empty-state"><h1>Объект не найден</h1><p class="muted">Возможно, он временно скрыт или ссылка устарела.</p><a class="btn btn-primary" href="./index.html#objects">Смотреть все объекты</a></div>`;
    document.body.classList.add('ready');
    return;
  }
  setMeta(`${p.title} — ${s.site_name}`, p.subtitle || s.seo_description);
  const others = properties.filter((x) => x.id !== p.id);
  root.innerHTML = pageHTML(p, s, others);
  document.body.classList.add('ready');
  initGallery(p);
  initReveal();
}

main();
