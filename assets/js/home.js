// Главная страница
import { loadSiteData } from './api.js';
import { icon } from './icons.js';
import {
  esc, paragraphs, lines, sized, coverOf, guestsWord, priceLabel, contactButtons, telHref,
  renderHeader, renderFooter, initReveal, setMeta, reducedMotion, addSwipe
} from './ui.js';

const $ = (id) => document.getElementById(id);

function heroHTML(s, props) {
  const maxGuests = props.reduce((m, p) => Math.max(m, Number(p.capacity) || 0), 0);
  return `
    <div class="hero-bg" id="hero-bg"><img src="${esc(sized(s.hero_image, 1920))}" alt="" fetchpriority="high"></div>
    <div class="hero-shade"></div>
    <div class="container hero-content">
      <p class="eyebrow hero-anim" style="--d:.05s">${esc(s.site_name)} · ${esc(s.tagline)}</p>
      <h1 class="hero-anim" style="--d:.15s">${esc(s.hero_title)}</h1>
      <p class="hero-sub hero-anim" style="--d:.3s">${esc(s.hero_subtitle)}</p>
      <div class="hero-actions hero-anim" style="--d:.45s">
        <a class="btn btn-light" href="#objects">Выбрать, где отдохнуть</a>
        <a class="btn btn-ghost" href="#contacts">Связаться с нами</a>
      </div>
      <ul class="hero-facts hero-anim" style="--d:.6s">
        <li><b>${props.length}</b><span>${props.length === 1 ? 'объект' : props.length < 5 ? 'объекта' : 'объектов'}</span></li>
        ${maxGuests ? `<li><b>до ${maxGuests}</b><span>${guestsWord(maxGuests)}</span></li>` : ''}
        <li><b>${esc(s.checkin_time || '15:00')}</b><span>заезд</span></li>
      </ul>
    </div>
    <a class="scroll-cue" href="#objects" aria-label="Листать вниз"><span></span></a>`;
}

function cardHTML(p, i) {
  const photos = (p.photos || []).slice(0, 4);
  if (!photos.length) photos.push({ url: '' });
  const kind = p.kind === 'bath' ? 'Баня' : 'Дом';
  return `
    <a class="card reveal" style="--d:${i * 0.08}s" href="./object.html?id=${encodeURIComponent(p.id)}">
      <div class="card-media" data-count="${photos.length}">
        ${photos.map((ph, k) => `<img class="${k === 0 ? 'active' : ''}" src="${esc(sized(ph.url, 900))}" alt="${esc(p.title)}" loading="lazy" decoding="async">`).join('')}
        <span class="badge">${kind}</span>
        ${photos.length > 1 ? `<span class="dots">${photos.map((_, k) => `<i class="${k === 0 ? 'on' : ''}"></i>`).join('')}</span>` : ''}
      </div>
      <div class="card-body">
        <h3>${esc(p.title)}</h3>
        <p class="muted">${esc(p.subtitle)}</p>
        <div class="card-meta">
          ${p.capacity ? `<span>${icon('users')}до ${esc(p.capacity)} ${guestsWord(p.capacity)}</span>` : ''}
          ${p.area ? `<span>${icon('area')}${esc(p.area)} м²</span>` : ''}
        </div>
        <div class="card-foot">
          <div class="price">${priceLabel(p)}</div>
          <span class="card-more">Подробнее ${icon('arrowR')}</span>
        </div>
      </div>
    </a>`;
}

function objectsHTML(props) {
  if (!props.length) return '<p class="muted center">Скоро здесь появятся объекты.</p>';
  return `<div class="cards">${props.map(cardHTML).join('')}</div>`;
}

function aboutHTML(s) {
  const adv = s.advantages || [];
  return `
    <div class="container">
      <div class="section-head reveal">
        <p class="eyebrow">Почему у нас</p>
        <h2>${esc(s.about_title)}</h2>
        <div class="lead">${paragraphs(s.about_text)}</div>
      </div>
      <div class="adv-grid">
        ${adv.map((a, i) => `
          <div class="adv reveal" style="--d:${i * 0.08}s">
            <div class="adv-ico">${icon(a.icon)}</div>
            <h3>${esc(a.title)}</h3>
            <p class="muted">${esc(a.text)}</p>
          </div>`).join('')}
      </div>
    </div>`;
}

function bookingHTML(s) {
  const steps = s.steps || [];
  return `
    <div class="container">
      <div class="section-head reveal">
        <p class="eyebrow">Бронирование</p>
        <h2>Как забронировать</h2>
      </div>
      <ol class="steps">
        ${steps.map((st, i) => `
          <li class="step reveal" style="--d:${i * 0.1}s">
            <span class="step-num">${String(i + 1).padStart(2, '0')}</span>
            <h3>${esc(st.title)}</h3>
            <p class="muted">${esc(st.text)}</p>
          </li>`).join('')}
      </ol>
      <div class="terms reveal">
        <div class="terms-times">
          <div>${icon('clock')}<span>Заезд<br><b>с ${esc(s.checkin_time)}</b></span></div>
          <div>${icon('clock')}<span>Выезд<br><b>до ${esc(s.checkout_time)}</b></span></div>
        </div>
        <div class="terms-text">${paragraphs(s.booking_terms)}</div>
      </div>
    </div>`;
}

function stars(n) {
  const r = Math.max(0, Math.min(5, Number(n) || 5));
  return `<span class="stars" aria-label="Оценка ${r} из 5">${'★'.repeat(r)}<i>${'★'.repeat(5 - r)}</i></span>`;
}

function reviewsHTML(reviews) {
  if (!reviews.length) return '';
  return `
    <div class="container">
      <div class="section-head section-head-row reveal">
        <div><p class="eyebrow">Отзывы</p><h2>Что говорят гости</h2></div>
        <div class="slider-arrows">
          <button class="round-btn" data-dir="-1.20" aria-label="Назад">${icon('arrowL')}</button>
          <button class="round-btn" data-dir="1.20" aria-label="Вперёд">${icon('arrowR')}</button>
        </div>
      </div>
    </div>
    <div class="reviews-track" id="reviews-track">
      ${reviews.map((r) => `
        <figure class="review">
          ${stars(r.rating)}
          <blockquote>${esc(r.text)}</blockquote>
          <figcaption><b>${esc(r.author)}</b><span>${esc([r.property_name, r.review_date].filter(Boolean).join(' · '))}</span></figcaption>
        </figure>`).join('')}
    </div>`;
}

function locationHTML(s) {
  const lat = Number(s.map_lat), lng = Number(s.map_lng), z = Number(s.map_zoom) || 13;
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng);
  const yandex = hasCoords ? `https://yandex.ru/maps/?ll=${lng},${lat}&z=${z}&pt=${lng},${lat},pm2rdm` : `https://yandex.ru/maps/?text=${encodeURIComponent(s.address || '')}`;
  const google = hasCoords ? `https://www.google.com/maps?q=${lat},${lng}` : `https://www.google.com/maps?q=${encodeURIComponent(s.address || '')}`;
  return `
    <div class="container location-grid">
      <div class="location-text reveal">
        <p class="eyebrow">Как добраться</p>
        <h2>Мы находимся здесь</h2>
        <p class="address">${icon('pin')}<span>${esc(s.address)}</span></p>
        <ul class="directions">${lines(s.directions).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
        <div class="btn-row">
          <a class="btn btn-outline" href="${yandex}" target="_blank" rel="noopener">Яндекс Карты</a>
          <a class="btn btn-outline" href="${google}" target="_blank" rel="noopener">Google Maps</a>
        </div>
      </div>
      <div class="map reveal" style="--d:.1s" id="map-box">
        ${hasCoords
          ? `<button class="map-load" type="button" data-src="https://yandex.ru/map-widget/v1/?ll=${lng},${lat}&z=${z}&pt=${lng},${lat},pm2rdm">${icon('pin')}<span>Показать карту</span></button>`
          : '<p class="muted">Координаты пока не указаны</p>'}
      </div>
    </div>`;
}

function contactsHTML(s) {
  return `
    <div class="container">
      <div class="cta reveal">
        <div class="cta-text">
          <p class="eyebrow">Контакты</p>
          <h2>Забронируйте даты прямо сейчас</h2>
          <p>Ответим на вопросы, подскажем свободные даты и поможем выбрать дом. Обычно отвечаем в течение 15 минут.</p>
          <div class="cta-lines">
            ${s.phone ? `<a href="${telHref(s.phone)}">${icon('phone')}${esc(s.phone)}</a>` : ''}
            ${s.email ? `<a href="mailto:${esc(s.email)}">${icon('mail')}${esc(s.email)}</a>` : ''}
          </div>
        </div>
        <div class="cta-buttons">${contactButtons(s, 'Здравствуйте! Хочу узнать о свободных датах.', 'btn-lg')}</div>
      </div>
    </div>`;
}

// ---------- Поведение ----------
function initParallax() {
  const bg = $('hero-bg');
  if (!bg || reducedMotion()) return;
  let ticking = false;
  const update = () => {
    const y = window.scrollY;
    if (y < window.innerHeight * 1.2) bg.style.transform = `translate3d(0, ${y * 0.35}px, 0) scale(1.08)`;
    ticking = false;
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

function initCardSlides() {
  document.querySelectorAll('.card-media[data-count]').forEach((media) => {
    const imgs = media.querySelectorAll('img');
    const dots = media.querySelectorAll('.dots i');
    if (imgs.length < 2) return;
    let i = 0, timer = null;
    const set = (n) => {
      imgs[i].classList.remove('active'); dots[i] && dots[i].classList.remove('on');
      i = (n + imgs.length) % imgs.length;
      imgs[i].classList.add('active'); dots[i] && dots[i].classList.add('on');
    };
    const card = media.closest('.card');
    card.addEventListener('mouseenter', () => {
      if (reducedMotion()) return;
      set(i + 1);
      timer = setInterval(() => set(i + 1), 1400);
    });
    card.addEventListener('mouseleave', () => { clearInterval(timer); set(0); });
    addSwipe(media, () => set(i + 1), () => set(i - 1));
  });
}

function initReviews() {
  const track = $('reviews-track');
  if (!track) return;
  document.querySelectorAll('.slider-arrows .round-btn').forEach((b) => {
    b.addEventListener('click', () => {
      const card = track.querySelector('.review');
      const step = card ? card.getBoundingClientRect().width + 20 : 320;
      track.scrollBy({ left: step * Number(b.dataset.dir), behavior: reducedMotion() ? 'auto' : 'smooth' });
    });
  });
}

function initMap() {
  const btn = document.querySelector('.map-load');
  if (!btn) return;
  const load = () => {
    const f = document.createElement('iframe');
    f.src = btn.dataset.src;
    f.title = 'Карта проезда';
    f.loading = 'lazy';
    f.setAttribute('allowfullscreen', '');
    btn.replaceWith(f);
  };
  btn.addEventListener('click', load);
  // Карта подгружается сама, когда пользователь до неё долистал
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) { io.disconnect(); load(); } }, { rootMargin: '200px' });
    io.observe(btn);
  }
}

async function main() {
  const { settings: s, properties, reviews } = await loadSiteData();
  setMeta(s.seo_title, s.seo_description);
  renderHeader(s, true);
  $('hero').innerHTML = heroHTML(s, properties);
  $('objects-list').innerHTML = objectsHTML(properties);
  $('about').innerHTML = aboutHTML(s);
  $('booking').innerHTML = bookingHTML(s);
  const rv = reviewsHTML(reviews);
  $('reviews').innerHTML = rv;
  $('reviews').hidden = !rv;
  $('location').innerHTML = locationHTML(s);
  $('contacts').innerHTML = contactsHTML(s);
  renderFooter(s);
  document.body.classList.add('ready');
  initParallax();
  initCardSlides();
  initReviews();
  initMap();
  initReveal();
  if (location.hash) {
    const t = document.querySelector(location.hash);
    if (t) setTimeout(() => t.scrollIntoView(), 50);
  }
}

main();
