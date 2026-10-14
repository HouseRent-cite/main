// =====================================================================
//  Админка: вход, редактирование объектов, фото, отзывов и настроек
// =====================================================================
import { getClient, isConfigured } from './api.js';
import { STORAGE_BUCKET } from './config.js';
import { icon, ICON_CHOICES } from './icons.js';

const app = document.getElementById('app');
let sb = null;          // клиент Supabase
let user = null;        // текущий пользователь
let currentTab = 'objects';
let dirty = false;      // есть несохранённые изменения

// ---------- Мелкие помощники ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function toast(text, type = 'ok') {
  const el = h(`<div class="toast toast-${type}">${esc(text)}</div>`);
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.classList.add('hide'), type === 'error' ? 6000 : 2800);
  setTimeout(() => el.remove(), type === 'error' ? 6500 : 3300);
}

function humanError(err) {
  const m = String((err && (err.message || err.error_description)) || err || '');
  if (/Invalid login credentials/i.test(m)) return 'Неверный email или пароль';
  if (/Email not confirmed/i.test(m)) return 'Email не подтверждён. В Supabase откройте пользователя и подтвердите его (см. инструкцию).';
  if (/row-level security|permission denied|not authorized|Unauthorized/i.test(m)) return 'Нет прав на изменение. Проверьте, что ваш email добавлен в администраторы (файл 02_add_admin.sql).';
  if (/Failed to fetch|NetworkError|Load failed|fetch/i.test(m)) return 'Нет связи с сервером. Проверьте интернет (или попробуйте включить/выключить VPN).';
  if (/Password should be at least/i.test(m)) return 'Пароль слишком короткий';
  if (/same.*password|different from the old/i.test(m)) return 'Новый пароль должен отличаться от старого';
  if (/payload too large|exceeded the maximum/i.test(m)) return 'Файл слишком большой (максимум 10 МБ)';
  if (/mime type/i.test(m)) return 'Этот формат фото не поддерживается. Используйте JPG, PNG или WebP.';
  return m || 'Неизвестная ошибка';
}

async function run(promise, okText) {
  const { data, error } = await promise;
  if (error) { toast(humanError(error), 'error'); throw error; }
  if (okText) toast(okText);
  return data;
}

function setBusy(btn, busy, text) {
  if (!btn) return;
  if (busy) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spinner sm"></span>${text || 'Сохраняю…'}`; }
  else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
}

function markDirty() { dirty = true; }
function confirmLeave() { return !dirty || confirm('Есть несохранённые изменения. Уйти без сохранения?'); }
window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

// =====================================================================
//  СТАРТ
// =====================================================================
async function start() {
  if (!isConfigured()) {
    app.innerHTML = `<div class="center-box"><div class="panel">
      <h1>Админка ещё не подключена</h1>
      <p>Откройте в GitHub файл <code>assets/js/config.js</code> и вставьте адрес проекта Supabase и публичный ключ — см. ИНСТРУКЦИЯ.md, шаг 2.5.</p>
      <a class="btn" href="../">Открыть сайт</a></div></div>`;
    return;
  }
  try {
    sb = await getClient();
  } catch (e) {
    app.innerHTML = `<div class="center-box"><div class="panel"><h1>Не удалось загрузить админку</h1>
      <p>Проверьте подключение к интернету и обновите страницу. Если вы в России и проблема повторяется — попробуйте включить VPN.</p>
      <button class="btn" onclick="location.reload()">Обновить</button></div></div>`;
    return;
  }

  sb.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') showRecovery();
  });

  // Ссылка из письма «восстановление пароля»
  if (/type=recovery/.test(location.hash)) { showRecovery(); return; }

  const { data } = await sb.auth.getSession();
  if (data.session) { user = data.session.user; await enter(); }
  else showLogin();
}

async function enter() {
  const { data: ok, error } = await sb.rpc('is_admin');
  if (error || !ok) {
    showLogin(error ? humanError(error) : `Аккаунт ${user.email} не является администратором. Добавьте его email через файл 02_add_admin.sql.`);
    await sb.auth.signOut();
    return;
  }
  showApp();
}

// =====================================================================
//  ВХОД
// =====================================================================
function showLogin(message = '') {
  app.innerHTML = '';
  const el = h(`
    <div class="center-box">
      <form class="panel login" novalidate>
        <div class="login-logo">${icon('tree')}</div>
        <h1>Вход для владельца</h1>
        <p class="muted">Управление сайтом: объекты, фото, цены и контакты.</p>
        ${message ? `<p class="alert">${esc(message)}</p>` : ''}
        <label class="field"><span>Email</span><input type="email" name="email" autocomplete="username" required inputmode="email"></label>
        <label class="field"><span>Пароль</span>
          <div class="pass-wrap"><input type="password" name="password" autocomplete="current-password" required><button type="button" class="pass-eye" aria-label="Показать пароль">👁</button></div>
        </label>
        <button class="btn btn-block" type="submit">Войти</button>
        <button class="link-btn" type="button" data-forgot>Забыли пароль?</button>
        <a class="link-btn" href="../">← Вернуться на сайт</a>
      </form>
    </div>`);
  app.appendChild(el);
  const form = $('form', el);
  $('.pass-eye', el).onclick = () => { const i = form.password; i.type = i.type === 'password' ? 'text' : 'password'; };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', form);
    const email = form.email.value.trim();
    const password = form.password.value;
    if (!email || !password) return toast('Введите email и пароль', 'error');
    setBusy(btn, true, 'Вход…');
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    setBusy(btn, false);
    if (error) return toast(humanError(error), 'error');
    user = data.user;
    await enter();
  });
  $('[data-forgot]', el).onclick = async () => {
    const email = form.email.value.trim();
    if (!email) return toast('Сначала впишите email в поле выше', 'error');
    const redirectTo = location.origin + location.pathname;
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return toast(humanError(error), 'error');
    toast('Письмо со ссылкой для смены пароля отправлено. Проверьте почту (и папку «Спам»).');
  };
}

function showRecovery() {
  app.innerHTML = '';
  const el = h(`
    <div class="center-box">
      <form class="panel login">
        <h1>Новый пароль</h1>
        <p class="muted">Придумайте новый пароль (не короче 8 символов).</p>
        <label class="field"><span>Новый пароль</span><input type="password" name="p1" autocomplete="new-password" minlength="8" required></label>
        <label class="field"><span>Повторите пароль</span><input type="password" name="p2" autocomplete="new-password" minlength="8" required></label>
        <button class="btn btn-block" type="submit">Сохранить пароль</button>
      </form>
    </div>`);
  app.appendChild(el);
  $('form', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.p1.value.length < 8) return toast('Пароль должен быть не короче 8 символов', 'error');
    if (f.p1.value !== f.p2.value) return toast('Пароли не совпадают', 'error');
    const { error } = await sb.auth.updateUser({ password: f.p1.value });
    if (error) return toast(humanError(error), 'error');
    toast('Пароль изменён');
    history.replaceState(null, '', location.pathname);
    const { data } = await sb.auth.getSession();
    user = data.session && data.session.user;
    if (user) enter(); else showLogin();
  });
}

// =====================================================================
//  ОСНОВНОЙ ЭКРАН
// =====================================================================
const TABS = [
  ['objects', 'Объекты', 'home'],
  ['reviews', 'Отзывы', 'star'],
  ['settings', 'Главная и контакты', 'phone'],
  ['account', 'Аккаунт', 'key']
];

function showApp() {
  app.innerHTML = '';
  const el = h(`
    <div class="shell">
      <header class="topbar">
        <div class="topbar-title">${icon('tree')}<span>Управление сайтом</span></div>
        <a class="btn btn-light btn-sm" href="../" target="_blank" rel="noopener">Открыть сайт ↗</a>
      </header>
      <nav class="tabs">${TABS.map(([k, label, ic]) => `<button data-tab="${k}">${icon(ic)}<span>${label}</span></button>`).join('')}</nav>
      <main class="content" id="content"></main>
    </div>`);
  app.appendChild(el);
  $$('.tabs button', el).forEach((b) => b.addEventListener('click', () => {
    if (!confirmLeave()) return;
    dirty = false;
    openTab(b.dataset.tab);
  }));
  openTab(currentTab);
}

function openTab(tab) {
  currentTab = tab;
  $$('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  const content = $('#content');
  content.innerHTML = '<div class="boot"><div class="spinner"></div></div>';
  window.scrollTo(0, 0);
  ({ objects: renderObjects, reviews: renderReviews, settings: renderSettings, account: renderAccount })[tab](content);
}

// =====================================================================
//  ОБЪЕКТЫ — список
// =====================================================================
async function renderObjects(content) {
  let list;
  try { list = await run(sb.from('properties').select('*').order('sort_order').order('created_at')); } catch { content.innerHTML = '<p class="alert">Не удалось загрузить объекты.</p>'; return; }
  content.innerHTML = '';
  const el = h(`
    <section>
      <div class="section-title"><h2>Объекты</h2><button class="btn" data-add>+ Добавить объект</button></div>
      <p class="hint">Нажмите «Изменить», чтобы поменять текст, цену или фото. Стрелками меняется порядок на сайте.</p>
      <div class="obj-list"></div>
    </section>`);
  content.appendChild(el);
  const box = $('.obj-list', el);
  if (!list.length) box.innerHTML = '<p class="muted">Пока нет ни одного объекта.</p>';
  list.forEach((p, i) => {
    const cover = p.photos && p.photos[0] && p.photos[0].url;
    const row = h(`
      <div class="obj-row ${p.visible ? '' : 'is-hidden'}">
        <div class="obj-thumb">${cover ? `<img src="${esc(cover)}" alt="">` : icon('home')}</div>
        <div class="obj-info">
          <b>${esc(p.title)}</b>
          <span>${Number(p.price || 0).toLocaleString('ru-RU')} ₽ / ${esc(p.price_unit)} · ${p.photos ? p.photos.length : 0} фото</span>
          <span class="pill ${p.visible ? 'pill-on' : 'pill-off'}">${p.visible ? 'Показан на сайте' : 'Скрыт'}</span>
        </div>
        <div class="obj-actions">
          <button class="icon-btn" data-up title="Выше" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="icon-btn" data-down title="Ниже" ${i === list.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="btn btn-light btn-sm" data-toggle>${p.visible ? 'Скрыть' : 'Показать'}</button>
          <button class="btn btn-sm" data-edit>Изменить</button>
        </div>
      </div>`);
    $('[data-edit]', row).onclick = () => editObject(p.id);
    $('[data-toggle]', row).onclick = async () => {
      await run(sb.from('properties').update({ visible: !p.visible }).eq('id', p.id), p.visible ? 'Объект скрыт' : 'Объект показан на сайте');
      renderObjects(content);
    };
    const swap = async (j) => {
      const other = list[j];
      await run(sb.from('properties').update({ sort_order: j }).eq('id', p.id));
      await run(sb.from('properties').update({ sort_order: i }).eq('id', other.id));
      // нормализуем порядок для всех
      await Promise.all(list.map((x, k) => (x.id !== p.id && x.id !== other.id && x.sort_order !== k)
        ? sb.from('properties').update({ sort_order: k }).eq('id', x.id) : null));
      renderObjects(content);
    };
    $('[data-up]', row).onclick = () => swap(i - 1);
    $('[data-down]', row).onclick = () => swap(i + 1);
    box.appendChild(row);
  });
  $('[data-add]', el).onclick = async (e) => {
    setBusy(e.currentTarget, true, 'Создаю…');
    const maxOrder = list.reduce((m, x) => Math.max(m, x.sort_order || 0), 0);
    try {
      const created = await run(sb.from('properties').insert({ title: 'Новый объект', visible: false, sort_order: maxOrder + 1 }).select().single(), 'Объект создан. Он скрыт, пока вы не включите «Показывать на сайте».');
      editObject(created.id);
    } catch { setBusy(e.currentTarget, false); }
  };
}

// =====================================================================
//  ОБЪЕКТ — редактор
// =====================================================================
async function editObject(id) {
  const content = $('#content');
  content.innerHTML = '<div class="boot"><div class="spinner"></div></div>';
  window.scrollTo(0, 0);
  let p;
  try { p = await run(sb.from('properties').select('*').eq('id', id).single()); } catch { renderObjects(content); return; }
  dirty = false;
  p.amenities = p.amenities || [];
  p.rules = p.rules || [];
  p.photos = p.photos || [];

  content.innerHTML = '';
  const el = h(`
    <section class="editor">
      <button class="link-btn back" data-back>← Ко всем объектам</button>
      <h2>${esc(p.title)}</h2>

      <div class="card">
        <h3>Основное</h3>
        <label class="field"><span>Название</span><input name="title" maxlength="80"></label>
        <div class="field"><span>Тип</span>
          <div class="seg">
            <label><input type="radio" name="kind" value="house"><span>Дом</span></label>
            <label><input type="radio" name="kind" value="bath"><span>Баня</span></label>
          </div>
        </div>
        <label class="field"><span>Короткое описание <small>(видно в карточке на главной)</small></span><input name="subtitle" maxlength="140"></label>
        <label class="field"><span>Подробное описание <small>(пустая строка — новый абзац)</small></span><textarea name="description" rows="8"></textarea></label>
        <label class="switch"><input type="checkbox" name="visible"><span></span>Показывать на сайте</label>
      </div>

      <div class="card">
        <h3>Цена и вместимость</h3>
        <div class="grid-2">
          <label class="field"><span>Цена, ₽</span><input name="price" type="number" min="0" step="100" inputmode="numeric"></label>
          <label class="field"><span>За</span>
            <select name="price_unit"><option value="сутки">сутки</option><option value="час">час</option><option value="ночь">ночь</option><option value="неделю">неделю</option></select>
          </label>
          <label class="field"><span>Вместимость, гостей</span><input name="capacity" type="number" min="0" inputmode="numeric"></label>
          <label class="field"><span>Площадь, м²</span><input name="area" type="number" min="0" inputmode="numeric"></label>
        </div>
        <label class="field"><span>Примечание к цене <small>(выходные, сезон, минимальный срок)</small></span><textarea name="price_note" rows="2"></textarea></label>
      </div>

      <div class="card">
        <h3>Фотографии</h3>
        <p class="hint">Первое фото — обложка. Стрелками меняйте порядок. Изменения фото сохраняются сразу.</p>
        <div class="photos" id="photos"></div>
        <label class="upload">
          <input type="file" accept="image/*" multiple id="photo-input">
          <span>${icon('expand')} Загрузить фото</span>
        </label>
        <p class="hint" id="upload-status"></p>
      </div>

      <div class="card">
        <h3>Удобства</h3>
        <p class="hint">Выберите значок и напишите короткую подпись.</p>
        <div id="amenities"></div>
      </div>

      <div class="card">
        <h3>Правила</h3>
        <label class="field"><span>Каждое правило — с новой строки</span><textarea name="rules" rows="6"></textarea></label>
      </div>

      <div class="card danger-zone">
        <h3>Удаление</h3>
        <p class="hint">Удаление нельзя отменить. Если объект временно не сдаётся — лучше просто скройте его.</p>
        <button class="btn btn-danger" data-delete>Удалить объект навсегда</button>
      </div>

      <div class="savebar"><span class="savebar-note" id="save-note">Все изменения сохранены</span><button class="btn" data-save>Сохранить</button></div>
    </section>`);
  content.appendChild(el);

  const f = (n) => el.querySelector(`[name="${n}"]`);
  f('title').value = p.title || '';
  el.querySelector(`[name=kind][value="${p.kind === 'bath' ? 'bath' : 'house'}"]`).checked = true;
  f('subtitle').value = p.subtitle || '';
  f('description').value = p.description || '';
  f('visible').checked = !!p.visible;
  f('price').value = p.price ?? '';
  if (![...f('price_unit').options].some((o) => o.value === p.price_unit)) f('price_unit').add(new Option(p.price_unit, p.price_unit));
  f('price_unit').value = p.price_unit || 'сутки';
  f('capacity').value = p.capacity ?? '';
  f('area').value = p.area ?? '';
  f('price_note').value = p.price_note || '';
  f('rules').value = (p.rules || []).join('\n');

  const amen = rowsEditor($('#amenities', el), p.amenities, [
    { key: 'icon', type: 'icon' },
    { key: 'label', type: 'text', placeholder: 'Например: Камин' }
  ], '+ Добавить удобство', { icon: 'check', label: '' });

  const note = $('#save-note', el);
  el.addEventListener('input', () => { markDirty(); note.textContent = 'Есть несохранённые изменения'; note.classList.add('warn'); });
  el.querySelectorAll('[name=kind]').forEach((r) => r.addEventListener('change', () => {
    if (r.checked) f('price_unit').value = r.value === 'bath' ? 'час' : 'сутки';
  }));

  // ---- фото ----
  const photosBox = $('#photos', el);
  const renderPhotos = () => {
    photosBox.innerHTML = '';
    if (!p.photos.length) photosBox.innerHTML = '<p class="muted">Фото пока нет.</p>';
    p.photos.forEach((ph, i) => {
      const tile = h(`
        <div class="photo">
          <img src="${esc(ph.url)}" alt="" loading="lazy">
          ${i === 0 ? '<span class="cover-badge">Обложка</span>' : `<span class="num-badge">${i + 1}</span>`}
          <div class="photo-actions">
            <button type="button" class="icon-btn" data-l title="Левее" ${i === 0 ? 'disabled' : ''}>←</button>
            <button type="button" class="icon-btn danger" data-del title="Удалить">✕</button>
            <button type="button" class="icon-btn" data-r title="Правее" ${i === p.photos.length - 1 ? 'disabled' : ''}>→</button>
          </div>
        </div>`);
      $('[data-l]', tile).onclick = () => movePhoto(i, -1);
      $('[data-r]', tile).onclick = () => movePhoto(i, 1);
      $('[data-del]', tile).onclick = () => deletePhoto(i);
      photosBox.appendChild(tile);
    });
  };
  const savePhotos = async (msg) => {
    await run(sb.from('properties').update({ photos: p.photos }).eq('id', p.id), msg);
    renderPhotos();
  };
  const movePhoto = async (i, d) => {
    const j = i + d;
    [p.photos[i], p.photos[j]] = [p.photos[j], p.photos[i]];
    renderPhotos();
    await savePhotos();
  };
  const deletePhoto = async (i) => {
    if (!confirm('Удалить это фото?')) return;
    const [removed] = p.photos.splice(i, 1);
    await savePhotos('Фото удалено');
    if (removed && removed.path) await sb.storage.from(STORAGE_BUCKET).remove([removed.path]);
  };
  renderPhotos();

  $('#photo-input', el).addEventListener('change', async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    const status = $('#upload-status', el);
    let done = 0;
    for (const file of files) {
      status.innerHTML = `<span class="spinner sm"></span> Загружаю ${done + 1} из ${files.length}…`;
      try {
        const uploaded = await uploadImage(file, p.id);
        p.photos.push(uploaded);
        await savePhotos();
        done++;
      } catch (err) {
        toast(`«${file.name}»: ${humanError(err)}`, 'error');
      }
    }
    status.textContent = done ? `Загружено фото: ${done}` : '';
    if (done) toast('Фото загружены');
  });

  // ---- сохранение ----
  $('[data-save]', el).onclick = async (e) => {
    const btn = e.currentTarget;
    const num = (v) => (v === '' || v == null ? null : Number(v));
    const payload = {
      title: f('title').value.trim() || 'Без названия',
      kind: el.querySelector('[name=kind]:checked').value,
      subtitle: f('subtitle').value.trim(),
      description: f('description').value.trim(),
      visible: f('visible').checked,
      price: num(f('price').value) || 0,
      price_unit: f('price_unit').value,
      capacity: num(f('capacity').value),
      area: num(f('area').value),
      price_note: f('price_note').value.trim(),
      amenities: amen.get().filter((a) => a.label.trim()),
      rules: f('rules').value.split('\n').map((s) => s.trim()).filter(Boolean)
    };
    setBusy(btn, true);
    try {
      await run(sb.from('properties').update(payload).eq('id', p.id), 'Сохранено! Изменения уже на сайте.');
      dirty = false;
      note.textContent = 'Все изменения сохранены';
      note.classList.remove('warn');
      $('h2', el).textContent = payload.title;
    } catch { /* ошибка уже показана */ }
    setBusy(btn, false);
  };

  $('[data-delete]', el).onclick = async () => {
    if (!confirm(`Удалить «${p.title}» навсегда вместе с фотографиями?`)) return;
    const paths = p.photos.map((x) => x.path).filter(Boolean);
    await run(sb.from('properties').delete().eq('id', p.id), 'Объект удалён');
    if (paths.length) await sb.storage.from(STORAGE_BUCKET).remove(paths);
    dirty = false;
    renderObjects(content);
  };

  $('[data-back]', el).onclick = () => { if (confirmLeave()) { dirty = false; renderObjects(content); } };
}

// ---------- Сжатие и загрузка фото ----------
async function compressImage(file, maxSide = 1920, quality = 0.82) {
  if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) throw new Error('Это не изображение');
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    bitmap = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Не удалось прочитать фото. Сохраните его как JPG и попробуйте снова.'));
      img.src = URL.createObjectURL(file);
    });
  }
  const w = bitmap.width, hgt = bitmap.height;
  const scale = Math.min(1, maxSide / Math.max(w, hgt));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(hgt * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
  if (!blob) throw new Error('Не удалось обработать фото');
  return blob;
}

async function uploadImage(file, folder) {
  const blob = await compressImage(file);
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
  if (error) throw error;
  const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

// ---------- Универсальный редактор списков (удобства, преимущества, шаги) ----------
function rowsEditor(container, items, fields, addLabel, emptyItem) {
  const list = h('<div class="rows"></div>');
  const addBtn = h(`<button type="button" class="btn btn-light btn-sm">${esc(addLabel)}</button>`);
  container.append(list, addBtn);

  const iconOptions = ICON_CHOICES.map((c) => `<option value="${c.key}">${esc(c.label)}</option>`).join('');

  const addRow = (item) => {
    const row = h('<div class="row-item"></div>');
    fields.forEach((fd) => {
      if (fd.type === 'icon') {
        const wrap = h(`<div class="icon-pick"><span class="icon-preview"></span><select data-key="${fd.key}" aria-label="Значок">${iconOptions}</select></div>`);
        const sel = $('select', wrap);
        sel.value = ICON_CHOICES.some((c) => c.key === item[fd.key]) ? item[fd.key] : 'check';
        const upd = () => { $('.icon-preview', wrap).innerHTML = icon(sel.value); };
        sel.addEventListener('change', upd);
        upd();
        row.appendChild(wrap);
      } else if (fd.type === 'textarea') {
        const t = h(`<textarea data-key="${fd.key}" rows="2" placeholder="${esc(fd.placeholder || '')}"></textarea>`);
        t.value = item[fd.key] || '';
        row.appendChild(t);
      } else {
        const inp = h(`<input data-key="${fd.key}" placeholder="${esc(fd.placeholder || '')}">`);
        inp.value = item[fd.key] || '';
        row.appendChild(inp);
      }
    });
    const ctr = h(`<div class="row-ctrl">
      <button type="button" class="icon-btn" data-up title="Выше">↑</button>
      <button type="button" class="icon-btn danger" data-rm title="Удалить">✕</button></div>`);
    $('[data-up]', ctr).onclick = () => { if (row.previousElementSibling) { list.insertBefore(row, row.previousElementSibling); markDirty(); container.dispatchEvent(new Event('input', { bubbles: true })); } };
    $('[data-rm]', ctr).onclick = () => { row.remove(); container.dispatchEvent(new Event('input', { bubbles: true })); };
    row.appendChild(ctr);
    list.appendChild(row);
  };

  (items || []).forEach(addRow);
  addBtn.onclick = () => {
    addRow({ ...emptyItem });
    const last = list.lastElementChild.querySelector('input,textarea');
    last && last.focus();
    container.dispatchEvent(new Event('input', { bubbles: true }));
  };

  return {
    get: () => $$('.row-item', list).map((row) => {
      const o = {};
      $$('[data-key]', row).forEach((inp) => { o[inp.dataset.key] = inp.value.trim(); });
      return o;
    })
  };
}

// =====================================================================
//  ОТЗЫВЫ
// =====================================================================
async function renderReviews(content) {
  let list;
  try { list = await run(sb.from('reviews').select('*').order('sort_order').order('created_at')); } catch { content.innerHTML = '<p class="alert">Не удалось загрузить отзывы.</p>'; return; }
  content.innerHTML = '';
  const el = h(`
    <section>
      <div class="section-title"><h2>Отзывы</h2><button class="btn" data-add>+ Добавить отзыв</button></div>
      <p class="hint">Каждый отзыв сохраняется своей кнопкой «Сохранить».</p>
      <div class="review-list"></div>
    </section>`);
  content.appendChild(el);
  const box = $('.review-list', el);
  if (!list.length) box.innerHTML = '<p class="muted">Отзывов пока нет.</p>';

  list.forEach((r, i) => {
    const card = h(`
      <div class="card review-card ${r.visible ? '' : 'is-hidden'}">
        <div class="grid-2">
          <label class="field"><span>Имя гостя</span><input name="author"></label>
          <label class="field"><span>Объект</span><input name="property_name" placeholder="Например: Русская баня"></label>
          <label class="field"><span>Дата</span><input name="review_date" placeholder="Например: Август 2026"></label>
          <label class="field"><span>Оценка</span><select name="rating"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select></label>
        </div>
        <label class="field"><span>Текст отзыва</span><textarea name="text" rows="4"></textarea></label>
        <label class="switch"><input type="checkbox" name="visible"><span></span>Показывать на сайте</label>
        <div class="card-actions">
          <button class="icon-btn" data-up title="Выше" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="icon-btn" data-down title="Ниже" ${i === list.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="btn btn-danger-light btn-sm" data-del>Удалить</button>
          <button class="btn btn-sm" data-save>Сохранить</button>
        </div>
      </div>`);
    const f = (n) => card.querySelector(`[name="${n}"]`);
    f('author').value = r.author || '';
    f('property_name').value = r.property_name || '';
    f('review_date').value = r.review_date || '';
    f('rating').value = String(r.rating || 5);
    f('text').value = r.text || '';
    f('visible').checked = !!r.visible;
    card.addEventListener('input', () => card.classList.add('changed'));
    $('[data-save]', card).onclick = async (e) => {
      const btn = e.currentTarget;
      setBusy(btn, true);
      try {
        await run(sb.from('reviews').update({
          author: f('author').value.trim() || 'Гость',
          property_name: f('property_name').value.trim(),
          review_date: f('review_date').value.trim(),
          rating: Number(f('rating').value),
          text: f('text').value.trim(),
          visible: f('visible').checked
        }).eq('id', r.id), 'Отзыв сохранён');
        card.classList.remove('changed');
        card.classList.toggle('is-hidden', !f('visible').checked);
      } catch { /* показано */ }
      setBusy(btn, false);
    };
    $('[data-del]', card).onclick = async () => {
      if (!confirm('Удалить этот отзыв?')) return;
      await run(sb.from('reviews').delete().eq('id', r.id), 'Отзыв удалён');
      renderReviews(content);
    };
    const swap = async (j) => {
      if (card.classList.contains('changed') && !confirm('В отзыве есть несохранённые изменения. Продолжить?')) return;
      const reordered = [...list];
      [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
      await Promise.all(reordered.map((x, k) => sb.from('reviews').update({ sort_order: k }).eq('id', x.id)));
      renderReviews(content);
    };
    $('[data-up]', card).onclick = () => swap(i - 1);
    $('[data-down]', card).onclick = () => swap(i + 1);
    box.appendChild(card);
  });

  $('[data-add]', el).onclick = async () => {
    const maxOrder = list.reduce((m, x) => Math.max(m, x.sort_order || 0), 0);
    await run(sb.from('reviews').insert({ author: 'Новый гость', text: 'Текст отзыва', rating: 5, visible: false, sort_order: maxOrder + 1 }), 'Отзыв добавлен в конец списка. Заполните его и включите «Показывать на сайте».');
    await renderReviews(content);
    const last = $$('.review-card', content).pop();
    if (last) last.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
}

// =====================================================================
//  ГЛАВНАЯ И КОНТАКТЫ
// =====================================================================
const SETTINGS_GROUPS = [
  ['Контакты', [
    ['phone', 'Телефон', 'text', '+7 (900) 000-00-00'],
    ['whatsapp', 'WhatsApp — номер только цифрами, с 7 в начале', 'text', '79000000000'],
    ['telegram', 'Telegram — имя пользователя без @ или ссылка', 'text', 'username'],
    ['email', 'Email', 'email', 'mail@example.ru']
  ], 'Если поле оставить пустым — кнопка этого мессенджера на сайте не появится.'],
  ['Адрес и карта', [
    ['address', 'Адрес', 'text'],
    ['map_lat', 'Широта (первое число)', 'number', '56.838'],
    ['map_lng', 'Долгота (второе число)', 'number', '60.597'],
    ['map_zoom', 'Масштаб карты (10 — район, 15 — улица)', 'number', '13'],
    ['directions', 'Как добраться (каждый пункт — с новой строки)', 'textarea']
  ], 'Как узнать координаты: откройте Яндекс Карты, нажмите на нужное место — внизу появятся два числа вида 56.838, 60.597. Можно вставить их целиком в поле «Широта» — оно само разделит.'],
  ['Первый экран', [
    ['site_name', 'Название (в логотипе)', 'text'],
    ['tagline', 'Подпись под названием', 'text'],
    ['hero_title', 'Большой заголовок', 'textarea'],
    ['hero_subtitle', 'Текст под заголовком', 'textarea'],
    ['hero_image', 'Фоновое фото', 'image']
  ]],
  ['О нас и преимущества', [
    ['about_title', 'Заголовок блока', 'text'],
    ['about_text', 'Текст', 'textarea'],
    ['advantages', 'Преимущества', 'rows-adv']
  ]],
  ['Бронирование', [
    ['checkin_time', 'Время заезда', 'text', '15:00'],
    ['checkout_time', 'Время выезда', 'text', '12:00'],
    ['booking_terms', 'Условия бронирования и оплаты', 'textarea'],
    ['steps', 'Шаги «Как забронировать»', 'rows-steps']
  ]],
  ['Поисковики', [
    ['seo_title', 'Заголовок вкладки браузера', 'text'],
    ['seo_description', 'Краткое описание сайта', 'textarea']
  ], 'Превью ссылки в мессенджерах берётся из файла index.html — его меняют один раз через GitHub (см. инструкцию, раздел 7).']
];

async function renderSettings(content) {
  let s;
  try {
    const rows = await run(sb.from('site_settings').select('*').eq('id', 1));
    s = rows[0] || { id: 1 };
  } catch { content.innerHTML = '<p class="alert">Не удалось загрузить настройки.</p>'; return; }
  dirty = false;
  content.innerHTML = '';
  const el = h('<section class="editor"><h2>Главная и контакты</h2></section>');
  const editors = {};
  let heroUrl = s.hero_image || '';

  SETTINGS_GROUPS.forEach(([title, fields, hint]) => {
    const card = h(`<div class="card"><h3>${esc(title)}</h3>${hint ? `<p class="hint">${esc(hint)}</p>` : ''}</div>`);
    const gridFor = () => {
      const last = card.lastElementChild;
      if (last && last.classList.contains('grid-2')) return last;
      const g = h('<div class="grid-2"></div>');
      card.appendChild(g);
      return g;
    };
    fields.forEach(([key, label, type, ph]) => {
      if (type === 'rows-adv') {
        const box = h(`<div class="field"><span>${esc(label)}</span><div></div></div>`);
        card.appendChild(box);
        editors[key] = rowsEditor(box.lastElementChild, s[key] || [], [
          { key: 'icon', type: 'icon' }, { key: 'title', type: 'text', placeholder: 'Заголовок' }, { key: 'text', type: 'textarea', placeholder: 'Пояснение' }
        ], '+ Добавить преимущество', { icon: 'check', title: '', text: '' });
        return;
      }
      if (type === 'rows-steps') {
        const box = h(`<div class="field"><span>${esc(label)}</span><div></div></div>`);
        card.appendChild(box);
        editors[key] = rowsEditor(box.lastElementChild, s[key] || [], [
          { key: 'title', type: 'text', placeholder: 'Название шага' }, { key: 'text', type: 'textarea', placeholder: 'Пояснение' }
        ], '+ Добавить шаг', { title: '', text: '' });
        return;
      }
      if (type === 'image') {
        const box = h(`<div class="field"><span>${esc(label)}</span>
          <div class="hero-pick"><img alt="" ${heroUrl ? `src="${esc(heroUrl)}"` : ''}><label class="upload upload-sm"><input type="file" accept="image/*"><span>Заменить фото</span></label></div></div>`);
        $('input', box).addEventListener('change', async (e) => {
          const file = e.target.files[0];
          e.target.value = '';
          if (!file) return;
          toast('Загружаю фото…');
          try {
            const up = await uploadImage(file, 'site');
            heroUrl = up.url;
            $('img', box).src = heroUrl;
            markDirty();
            el.dispatchEvent(new Event('input'));
            toast('Фото загружено. Нажмите «Сохранить».');
          } catch (err) { toast(humanError(err), 'error'); }
        });
        card.appendChild(box);
        return;
      }
      const input = type === 'textarea'
        ? h(`<textarea name="${key}" rows="3"></textarea>`)
        : h(`<input name="${key}" type="${type === 'number' ? 'text' : type}" ${type === 'number' ? 'inputmode="decimal"' : ''} placeholder="${esc(ph || '')}">`);
      input.value = s[key] ?? '';
      const field = h(`<label class="field ${type === 'textarea' ? 'span-2' : ''}"><span>${esc(label)}</span></label>`);
      field.appendChild(input);
      gridFor().appendChild(field);
    });
    el.appendChild(card);
  });

  el.appendChild(h('<div class="savebar"><span class="savebar-note" id="save-note">Все изменения сохранены</span><button class="btn" data-save>Сохранить</button></div>'));
  content.appendChild(el);

  // Вставка координат одной строкой «56.838, 60.597»
  const lat = $('[name=map_lat]', el), lng = $('[name=map_lng]', el);
  lat.addEventListener('input', () => {
    const m = lat.value.match(/(-?\d+[.,]\d+)\s*[,; ]\s*(-?\d+[.,]\d+)/);
    if (m) { lat.value = m[1].replace(',', '.'); lng.value = m[2].replace(',', '.'); }
  });

  const note = $('#save-note', el);
  el.addEventListener('input', () => { markDirty(); note.textContent = 'Есть несохранённые изменения'; note.classList.add('warn'); });

  $('[data-save]', el).onclick = async (e) => {
    const btn = e.currentTarget;
    const payload = { id: 1, hero_image: heroUrl };
    SETTINGS_GROUPS.forEach(([, fields]) => fields.forEach(([key, , type]) => {
      if (type === 'rows-adv') payload[key] = editors[key].get().filter((x) => x.title);
      else if (type === 'rows-steps') payload[key] = editors[key].get().filter((x) => x.title);
      else if (type === 'image') { /* уже в payload */ }
      else {
        const v = $(`[name="${key}"]`, el).value.trim();
        if (type === 'number') {
          const n = Number(v.replace(',', '.'));
          payload[key] = v === '' || Number.isNaN(n) ? null : n;
        } else payload[key] = v;
      }
    }));
    if (payload.map_zoom != null) payload.map_zoom = Math.round(payload.map_zoom);
    setBusy(btn, true);
    try {
      await run(sb.from('site_settings').upsert(payload), 'Сохранено! Изменения уже на сайте.');
      dirty = false;
      note.textContent = 'Все изменения сохранены';
      note.classList.remove('warn');
    } catch { /* показано */ }
    setBusy(btn, false);
  };
}

// =====================================================================
//  АККАУНТ
// =====================================================================
function renderAccount(content) {
  content.innerHTML = '';
  const el = h(`
    <section class="editor">
      <h2>Аккаунт</h2>
      <div class="card">
        <h3>Вы вошли как</h3>
        <p><b>${esc(user && user.email)}</b></p>
        <button class="btn btn-light" data-logout>Выйти</button>
      </div>
      <form class="card" data-pass>
        <h3>Сменить пароль</h3>
        <div class="grid-2">
          <label class="field"><span>Новый пароль</span><input type="password" name="p1" autocomplete="new-password" minlength="8"></label>
          <label class="field"><span>Повторите пароль</span><input type="password" name="p2" autocomplete="new-password" minlength="8"></label>
        </div>
        <button class="btn" type="submit">Сменить пароль</button>
      </form>
      <div class="card">
        <h3>Резервная копия</h3>
        <p class="hint">Скачайте файл <b>fallback.js</b> и замените им одноимённый файл в GitHub (папка assets/js). Тогда даже при временной недоступности базы посетители увидят актуальные цены и контакты, а не демо-данные. Делайте это после крупных изменений.</p>
        <button class="btn btn-light" data-export>Скачать резервную копию</button>
      </div>
    </section>`);
  content.appendChild(el);

  $('[data-logout]', el).onclick = async () => { await sb.auth.signOut(); user = null; showLogin(); };

  $('[data-pass]', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.p1.value.length < 8) return toast('Пароль должен быть не короче 8 символов', 'error');
    if (f.p1.value !== f.p2.value) return toast('Пароли не совпадают', 'error');
    const btn = $('button[type=submit]', f);
    setBusy(btn, true);
    const { error } = await sb.auth.updateUser({ password: f.p1.value });
    setBusy(btn, false);
    if (error) return toast(humanError(error), 'error');
    f.reset();
    toast('Пароль изменён. Используйте новый пароль при следующем входе.');
  });

  $('[data-export]', el).onclick = async (e) => {
    const btn = e.currentTarget;
    setBusy(btn, true, 'Готовлю…');
    try {
      const [settingsRows, properties, reviews] = await Promise.all([
        run(sb.from('site_settings').select('*').eq('id', 1)),
        run(sb.from('properties').select('*').order('sort_order')),
        run(sb.from('reviews').select('*').order('sort_order'))
      ]);
      const clean = (o) => { const c = { ...o }; delete c.created_at; delete c.updated_at; return c; };
      const data = { settings: clean(settingsRows[0] || {}), properties: properties.map(clean), reviews: reviews.map(clean) };
      delete data.settings.id;
      const text = `// Резервные данные. Создано в админке ${new Date().toLocaleString('ru-RU')}.\n// Замените этим файлом assets/js/fallback.js в репозитории GitHub.\n\nexport const FALLBACK = ${JSON.stringify(data, null, 2)};\n`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
      a.download = 'fallback.js';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast('Файл fallback.js скачан');
    } catch { /* показано */ }
    setBusy(btn, false);
  };
}

start();
