// Общие функции для публичных страниц: шапка, подвал, анимации, ссылки для связи.
import { icon } from './icons.js';

export const PLACEHOLDER = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9c6ad"/><stop offset="1" stop-color="#8f6b4c"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><g fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="6" stroke-linejoin="round"><path d="M300 330 400 250l100 80"/><path d="M325 315v85h150v-85"/><path d="M385 400v-45h30v45"/></g></svg>`
);

// Если какая-то картинка не загрузилась — подставляем аккуратную заглушку
document.addEventListener('error', (e) => {
  const el = e.target;
  if (el && el.tagName === 'IMG' && !el.dataset.fb) { el.dataset.fb = '1'; el.src = PLACEHOLDER; }
}, true);

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const paragraphs = (text) => String(text || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');

export const lines = (text) => String(text || '').split('\n').map((s) => s.trim()).filter(Boolean);

export const formatPrice = (n) => Number(n || 0).toLocaleString('ru-RU') + ' ₽';

// Подбор ширины картинки (для фото с Unsplash; фото из Supabase уже сжаты при загрузке)
export function sized(url, w) {
  if (!url) return PLACEHOLDER;
  if (url.includes('images.unsplash.com')) return url.replace(/([?&])w=\d+/, `$1w=${w}`);
  return url;
}

export const coverOf = (p) => (p.photos && p.photos[0] && p.photos[0].url) || '';

export const guestsWord = (n) => {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return 'гостей';
  if (b === 1) return 'гость';
  if (b >= 2 && b <= 4) return 'гостя';
  return 'гостей';
};

export const priceLabel = (p) => `${formatPrice(p.price)} <span>/ ${esc(p.price_unit || 'сутки')}</span>`;

// ---------- Ссылки для связи ----------
export const telHref = (phone) => 'tel:' + String(phone || '').replace(/[^\d+]/g, '');
export const waHref = (wa, text = '') => {
  const digits = String(wa || '').replace(/\D/g, '');
  return `https://wa.me/${digits}${text ? '?text=' + encodeURIComponent(text) : ''}`;
};
export const tgHref = (tg) => {
  const v = String(tg || '').trim();
  if (/^https?:\/\//.test(v)) return v;
  return 'https://t.me/' + v.replace(/^@/, '');
};

export function contactButtons(s, message = '', cls = '') {
  const out = [];
  if (s.phone) out.push(`<a class="btn btn-primary ${cls}" href="${telHref(s.phone)}">${icon('phone')}<span>Позвонить</span></a>`);
  if (s.whatsapp) out.push(`<a class="btn btn-wa ${cls}" href="${waHref(s.whatsapp, message)}" target="_blank" rel="noopener">${icon('whatsapp')}<span>WhatsApp</span></a>`);
  if (s.telegram) out.push(`<a class="btn btn-tg ${cls}" href="${tgHref(s.telegram)}" target="_blank" rel="noopener">${icon('telegram')}<span>Telegram</span></a>`);
  return out.join('');
}

// ---------- Шапка и подвал ----------
export function renderHeader(s, onHome) {
  const base = onHome ? '' : './index.html';
  const el = document.getElementById('site-header');
  el.innerHTML = `
    <div class="container header-inner">
      <a class="logo" href="./index.html" aria-label="${esc(s.site_name)} — на главную">
        <span class="logo-mark">${icon('tree')}</span>
        <span class="logo-text">${esc(s.site_name)}<small>${esc(s.tagline)}</small></span>
      </a>
      <nav class="nav" id="nav" aria-label="Меню">
        <a href="${base}#objects">Объекты</a>
        <a href="${base}#booking">Как забронировать</a>
        <a href="${base}#reviews">Отзывы</a>
        <a href="${base}#location">Как добраться</a>
        <a href="${base}#contacts">Контакты</a>
      </nav>
      ${s.phone ? `<a class="header-phone" href="${telHref(s.phone)}">${icon('phone')}<span>${esc(s.phone)}</span></a>` : ''}
      <button class="burger" id="burger" aria-label="Открыть меню" aria-expanded="false"><span></span><span></span></button>
    </div>`;
  const burger = el.querySelector('#burger');
  const nav = el.querySelector('#nav');
  burger.addEventListener('click', () => {
    const open = document.body.classList.toggle('menu-open');
    burger.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') { document.body.classList.remove('menu-open'); burger.setAttribute('aria-expanded', 'false'); }
  });
  const onScroll = () => el.classList.toggle('scrolled', window.scrollY > 30);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

export function renderFooter(s) {
  const el = document.getElementById('site-footer');
  const year = new Date().getFullYear();
  el.innerHTML = `
    <div class="container footer-inner">
      <div>
        <div class="logo logo-footer"><span class="logo-mark">${icon('tree')}</span><span class="logo-text">${esc(s.site_name)}<small>${esc(s.tagline)}</small></span></div>
        <p class="muted">${esc(s.address)}</p>
      </div>
      <div class="footer-links">
        ${s.phone ? `<a href="${telHref(s.phone)}">${esc(s.phone)}</a>` : ''}
        ${s.email ? `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : ''}
        ${s.whatsapp ? `<a href="${waHref(s.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
        ${s.telegram ? `<a href="${tgHref(s.telegram)}" target="_blank" rel="noopener">Telegram</a>` : ''}
      </div>
    </div>
    <div class="container footer-bottom">
      <span>© ${year} ${esc(s.site_name)}</span>
      <a href="./admin/" class="footer-admin">Вход для владельца</a>
    </div>`;
}

// ---------- Анимации ----------
export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initReveal(root = document) {
  const items = root.querySelectorAll('.reveal:not(.is-visible)');
  if (reducedMotion() || !('IntersectionObserver' in window)) {
    items.forEach((i) => i.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  items.forEach((i) => io.observe(i));
}

export function setMeta(title, description) {
  if (title) document.title = title;
  if (description) {
    const m = document.querySelector('meta[name="description"]');
    if (m) m.setAttribute('content', description);
  }
}

// ---------- Полноэкранный просмотр фото ----------
export function openLightbox(photos, start = 0, title = '') {
  let idx = start;
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'Просмотр фото');
  box.innerHTML = `
    <div class="lb-top"><span class="lb-count"></span><button class="lb-btn lb-close" aria-label="Закрыть">${icon('close')}</button></div>
    <div class="lb-stage"><img alt=""></div>
    <button class="lb-btn lb-prev" aria-label="Предыдущее фото">${icon('arrowL')}</button>
    <button class="lb-btn lb-next" aria-label="Следующее фото">${icon('arrowR')}</button>`;
  document.body.appendChild(box);
  document.body.classList.add('no-scroll');
  const img = box.querySelector('img');
  const count = box.querySelector('.lb-count');
  const show = () => {
    img.classList.remove('lb-in');
    void img.offsetWidth;
    img.src = sized(photos[idx].url, 2000);
    img.alt = `${title} — фото ${idx + 1}`;
    img.classList.add('lb-in');
    count.textContent = `${idx + 1} / ${photos.length}`;
  };
  const go = (d) => { idx = (idx + d + photos.length) % photos.length; show(); };
  const close = () => {
    box.classList.add('lb-out');
    document.body.classList.remove('no-scroll');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => box.remove(), 250);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') go(-1);
    if (e.key === 'ArrowRight') go(1);
  };
  box.querySelector('.lb-close').onclick = close;
  box.querySelector('.lb-prev').onclick = () => go(-1);
  box.querySelector('.lb-next').onclick = () => go(1);
  box.querySelector('.lb-stage').addEventListener('click', (e) => { if (e.target === e.currentTarget) close(); });
  document.addEventListener('keydown', onKey);
  addSwipe(box, () => go(1), () => go(-1));
  if (photos.length < 2) box.classList.add('single');
  show();
  box.querySelector('.lb-close').focus();
}

export function addSwipe(el, onLeft, onRight) {
  let x0 = null, y0 = null;
  el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? onLeft : onRight)();
    x0 = y0 = null;
  }, { passive: true });
}
