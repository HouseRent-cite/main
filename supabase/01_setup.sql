-- =====================================================================
--  ТИХИЙ БЕРЕГ — настройка базы данных Supabase
--  Как запустить: Supabase → SQL Editor → New query → вставить ВЕСЬ
--  этот текст → кнопка Run. Скрипт можно запускать повторно:
--  существующие данные он не удаляет и не дублирует.
-- =====================================================================

-- ---------- 1. Список администраторов ----------
create table if not exists public.admins (
  email text primary key,
  created_at timestamptz not null default now()
);

-- Проверка «текущий пользователь — администратор?»
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------- 2. Общие настройки сайта (одна строка) ----------
create table if not exists public.site_settings (
  id              int primary key default 1 check (id = 1),
  site_name       text,
  tagline         text,
  hero_title      text,
  hero_subtitle   text,
  hero_image      text,
  about_title     text,
  about_text      text,
  phone           text,
  whatsapp        text,
  telegram        text,
  email           text,
  address         text,
  map_lat         double precision,
  map_lng         double precision,
  map_zoom        int default 13,
  directions      text,
  checkin_time    text,
  checkout_time   text,
  booking_terms   text,
  advantages      jsonb not null default '[]'::jsonb,
  steps           jsonb not null default '[]'::jsonb,
  seo_title       text,
  seo_description text,
  updated_at      timestamptz not null default now()
);

-- ---------- 3. Объекты (дома, бани) ----------
create table if not exists public.properties (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default 'Новый объект',
  kind        text not null default 'house' check (kind in ('house', 'bath')),
  subtitle    text default '',
  description text default '',
  price       numeric not null default 0,
  price_unit  text not null default 'сутки',
  price_note  text default '',
  capacity    int,
  area        int,
  amenities   jsonb not null default '[]'::jsonb,  -- [{ "icon": "wifi", "label": "Wi-Fi" }]
  rules       jsonb not null default '[]'::jsonb,  -- ["Не курить", ...]
  photos      jsonb not null default '[]'::jsonb,  -- [{ "url": "...", "path": "..." }]
  visible     boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- 4. Отзывы ----------
create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  author        text not null default 'Гость',
  text          text not null default '',
  rating        int not null default 5 check (rating between 1 and 5),
  property_name text default '',
  review_date   text default '',
  visible       boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

-- ---------- 5. Автообновление поля updated_at ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_settings_touch on public.site_settings;
create trigger trg_settings_touch before update on public.site_settings
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_properties_touch on public.properties;
create trigger trg_properties_touch before update on public.properties
  for each row execute function public.touch_updated_at();

-- ---------- 6. Права доступа (Row Level Security) ----------
alter table public.admins        enable row level security;
alter table public.site_settings enable row level security;
alter table public.properties    enable row level security;
alter table public.reviews       enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.site_settings, public.properties, public.reviews to anon, authenticated;
grant insert, update, delete on public.site_settings, public.properties, public.reviews to authenticated;
grant select on public.admins to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- admins: пользователь видит только свою запись (чтобы админка поняла, что он админ)
drop policy if exists "admins_self_read" on public.admins;
create policy "admins_self_read" on public.admins
  for select to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

-- site_settings: читают все, меняет только админ
drop policy if exists "settings_read_all" on public.site_settings;
create policy "settings_read_all" on public.site_settings
  for select using (true);
drop policy if exists "settings_admin_insert" on public.site_settings;
create policy "settings_admin_insert" on public.site_settings
  for insert to authenticated with check (public.is_admin());
drop policy if exists "settings_admin_update" on public.site_settings;
create policy "settings_admin_update" on public.site_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- properties: посетители видят только видимые, админ — все
drop policy if exists "properties_read" on public.properties;
create policy "properties_read" on public.properties
  for select using (visible or public.is_admin());
drop policy if exists "properties_admin_insert" on public.properties;
create policy "properties_admin_insert" on public.properties
  for insert to authenticated with check (public.is_admin());
drop policy if exists "properties_admin_update" on public.properties;
create policy "properties_admin_update" on public.properties
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "properties_admin_delete" on public.properties;
create policy "properties_admin_delete" on public.properties
  for delete to authenticated using (public.is_admin());

-- reviews: то же самое
drop policy if exists "reviews_read" on public.reviews;
create policy "reviews_read" on public.reviews
  for select using (visible or public.is_admin());
drop policy if exists "reviews_admin_insert" on public.reviews;
create policy "reviews_admin_insert" on public.reviews
  for insert to authenticated with check (public.is_admin());
drop policy if exists "reviews_admin_update" on public.reviews;
create policy "reviews_admin_update" on public.reviews
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "reviews_admin_delete" on public.reviews;
create policy "reviews_admin_delete" on public.reviews
  for delete to authenticated using (public.is_admin());

-- ---------- 7. Хранилище фотографий ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "photos_public_read" on storage.objects;
create policy "photos_public_read" on storage.objects
  for select using (bucket_id = 'photos');
drop policy if exists "photos_admin_insert" on storage.objects;
create policy "photos_admin_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos' and public.is_admin());
drop policy if exists "photos_admin_update" on storage.objects;
create policy "photos_admin_update" on storage.objects
  for update to authenticated using (bucket_id = 'photos' and public.is_admin());
drop policy if exists "photos_admin_delete" on storage.objects;
create policy "photos_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'photos' and public.is_admin());

-- ---------- 8. Начальные данные-заглушки ----------
-- (добавляются только если таких записей ещё нет)

insert into public.site_settings (id, site_name, tagline, hero_title, hero_subtitle, hero_image, about_title, about_text, phone, whatsapp, telegram, email, address, map_lat, map_lng, map_zoom, directions, checkin_time, checkout_time, booking_terms, advantages, steps, seo_title, seo_description)
select 1, site_name, tagline, hero_title, hero_subtitle, hero_image, about_title, about_text, phone, whatsapp, telegram, email, address, map_lat, map_lng, map_zoom, directions, checkin_time, checkout_time, booking_terms, advantages, steps, seo_title, seo_description
from jsonb_populate_record(null::public.site_settings, $json${
  "site_name": "Тихий берег",
  "tagline": "Загородные дома и баня",
  "hero_title": "Тишина, сосны и тёплый дом у воды",
  "hero_subtitle": "Два уютных дома и настоящая русская баня на дровах в часе езды от города. Приезжайте отдыхать — всё остальное мы уже подготовили.",
  "hero_image": "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1600&q=75",
  "about_title": "Отдых, который хочется повторить",
  "about_text": "Мы построили эти дома для себя и друзей, а теперь открыли их для гостей. Живое дерево, панорамные окна, камин и звёздное небо — без городского шума.",
  "phone": "+7 (900) 000-00-00",
  "whatsapp": "79000000000",
  "telegram": "tihiy_bereg",
  "email": "hello@example.ru",
  "address": "Свердловская область, д. Сосновка, ул. Лесная, 12",
  "map_lat": 56.838,
  "map_lng": 60.597,
  "map_zoom": 13,
  "directions": "На машине: 60 км по трассе, после указателя «Сосновка» — 3 км по асфальту. Парковка у каждого дома.\nНа электричке: до станции «Сосновка», далее 10 минут на такси — встретим, если предупредите заранее.",
  "checkin_time": "15:00",
  "checkout_time": "12:00",
  "booking_terms": "Предоплата 30% для подтверждения брони. Остаток — при заезде. Залог 5 000 ₽ возвращается при выезде.",
  "advantages": [
    {
      "icon": "tree",
      "title": "Сосновый лес вокруг",
      "text": "Чистый воздух, тропинки для прогулок и грибные места в пяти минутах."
    },
    {
      "icon": "fire",
      "title": "Камин и мангал",
      "text": "Дрова, угли и решётки уже ждут — просто приезжайте."
    },
    {
      "icon": "water",
      "title": "Озеро рядом",
      "text": "Песчаный пляж в 300 метрах, сапборды и лодка по запросу."
    },
    {
      "icon": "key",
      "title": "Заселение без хлопот",
      "text": "Встретим лично или оставим ключ в сейфе — как вам удобнее."
    }
  ],
  "steps": [
    {
      "title": "Выберите дом или баню",
      "text": "Посмотрите фото, удобства и цены на странице объекта."
    },
    {
      "title": "Напишите или позвоните",
      "text": "Сообщите даты и число гостей — ответим в течение 15 минут."
    },
    {
      "title": "Внесите предоплату",
      "text": "Пришлём реквизиты. После оплаты даты закрепляются за вами."
    },
    {
      "title": "Приезжайте отдыхать",
      "text": "Накануне пришлём точку на карте и инструкцию по заселению."
    }
  ],
  "seo_title": "Тихий берег — аренда загородных домов и бани",
  "seo_description": "Два уютных дома и русская баня на дровах в сосновом лесу у озера."
}$json$::jsonb)
on conflict (id) do nothing;

insert into public.properties (id, title, kind, subtitle, description, price, price_unit, price_note, capacity, area, amenities, rules, photos, visible, sort_order)
select id, title, kind, subtitle, description, price, price_unit, price_note, capacity, area, amenities, rules, photos, visible, sort_order
from jsonb_populate_recordset(null::public.properties, $json$[
  {
    "id": "11111111-1111-4111-8111-111111111111",
    "title": "Дом «Сосновый»",
    "kind": "house",
    "subtitle": "Большой дом из бруса для компании и семьи",
    "description": "Просторный двухэтажный дом из клеёного бруса посреди соснового леса. На первом этаже — гостиная с камином и панорамными окнами, полностью оборудованная кухня и обеденный стол на 10 человек.\n\nНа втором этаже — три спальни и мансарда с видом на лес. Вокруг дома — огороженная территория, терраса с мебелью, мангальная зона и гамаки.",
    "price": 9500,
    "price_unit": "сутки",
    "price_note": "В пятницу и субботу — 12 000 ₽. Минимум 2 суток в выходные.",
    "capacity": 8,
    "area": 140,
    "amenities": [
      {
        "icon": "bed",
        "label": "3 спальни, 4 кровати"
      },
      {
        "icon": "fire",
        "label": "Камин"
      },
      {
        "icon": "kitchen",
        "label": "Кухня с посудой"
      },
      {
        "icon": "wifi",
        "label": "Wi‑Fi"
      },
      {
        "icon": "bbq",
        "label": "Мангал и барбекю"
      },
      {
        "icon": "car",
        "label": "Парковка на 3 авто"
      },
      {
        "icon": "shower",
        "label": "2 санузла"
      },
      {
        "icon": "tv",
        "label": "Smart TV"
      },
      {
        "icon": "washer",
        "label": "Стиральная машина"
      },
      {
        "icon": "towel",
        "label": "Бельё и полотенца"
      }
    ],
    "rules": [
      "Заезд с 15:00, выезд до 12:00",
      "Тишина после 23:00",
      "Не курить в доме",
      "Можно с питомцами по согласованию",
      "Вечеринки и мероприятия — только по договорённости"
    ],
    "photos": [
      {
        "url": "https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?auto=format&fit=crop&w=1600&q=75"
      },
      {
        "url": "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1600&q=75"
      },
      {
        "url": "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1600&q=75"
      },
      {
        "url": "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1600&q=75"
      },
      {
        "url": "https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=1600&q=75"
      }
    ],
    "visible": true,
    "sort_order": 1
  },
  {
    "id": "22222222-2222-4222-8222-222222222222",
    "title": "Дом «У озера»",
    "kind": "house",
    "subtitle": "Уютный дом для пары или небольшой семьи",
    "description": "Светлый каркасный дом в скандинавском стиле в 300 метрах от озера. Большая кровать у панорамного окна, гостиная-студия с кухней и печкой-камином, просторная терраса для завтраков на свежем воздухе.\n\nИдеально для романтических выходных или тихой работы на природе.",
    "price": 7000,
    "price_unit": "сутки",
    "price_note": "В выходные — 8 500 ₽. Скидка 10% при бронировании от 5 суток.",
    "capacity": 4,
    "area": 70,
    "amenities": [
      {
        "icon": "bed",
        "label": "2 спальни"
      },
      {
        "icon": "water",
        "label": "Озеро в 300 м"
      },
      {
        "icon": "fire",
        "label": "Печь‑камин"
      },
      {
        "icon": "kitchen",
        "label": "Кухня‑гостиная"
      },
      {
        "icon": "wifi",
        "label": "Wi‑Fi"
      },
      {
        "icon": "coffee",
        "label": "Кофемашина"
      },
      {
        "icon": "car",
        "label": "Парковка"
      },
      {
        "icon": "snow",
        "label": "Кондиционер"
      }
    ],
    "rules": [
      "Заезд с 15:00, выезд до 12:00",
      "Не курить в доме",
      "Без животных",
      "Тишина после 23:00"
    ],
    "photos": [
      {
        "url": "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1600&q=75"
      },
      {
        "url": "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1600&q=75"
      },
      {
        "url": "https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=1600&q=75"
      },
      {
        "url": "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1600&q=75"
      },
      {
        "url": "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1600&q=75"
      }
    ],
    "visible": true,
    "sort_order": 2
  },
  {
    "id": "33333333-3333-4333-8333-333333333333",
    "title": "Русская баня на дровах",
    "kind": "bath",
    "subtitle": "Настоящий пар, купель и комната отдыха",
    "description": "Баня из кедрового сруба с дровяной печью и закрытой каменкой — пар мягкий и густой. Парная до 6 человек, помывочная, купель с холодной водой на улице и комната отдыха с самоваром.\n\nВеники (берёзовые и дубовые), травяной чай и полотенца входят в стоимость. Баню топим заранее — к вашему приезду она уже готова.",
    "price": 2000,
    "price_unit": "час",
    "price_note": "Минимум 3 часа. Растопка включена. Гостям домов — скидка 20%.",
    "capacity": 6,
    "area": 45,
    "amenities": [
      {
        "icon": "steam",
        "label": "Дровяная печь"
      },
      {
        "icon": "water",
        "label": "Купель на улице"
      },
      {
        "icon": "leaf",
        "label": "Веники и травы"
      },
      {
        "icon": "coffee",
        "label": "Самовар и чай"
      },
      {
        "icon": "towel",
        "label": "Простыни и полотенца"
      },
      {
        "icon": "music",
        "label": "Музыка"
      },
      {
        "icon": "shower",
        "label": "Душ"
      },
      {
        "icon": "users",
        "label": "Комната отдыха"
      }
    ],
    "rules": [
      "Бронирование минимум за сутки",
      "Без алкоголя в парной",
      "Дети — только со взрослыми",
      "Время включает растопку и уборку"
    ],
    "photos": [
      {
        "url": "https://images.unsplash.com/photo-1542718610-a1d656d1884c?auto=format&fit=crop&w=1600&q=75"
      },
      {
        "url": "https://images.unsplash.com/photo-1600334129128-685c5582fd35?auto=format&fit=crop&w=1600&q=75"
      },
      {
        "url": "https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1600&q=75"
      },
      {
        "url": "https://images.unsplash.com/photo-1475855581690-80accde3ae2b?auto=format&fit=crop&w=1600&q=75"
      }
    ],
    "visible": true,
    "sort_order": 3
  }
]$json$::jsonb)
on conflict (id) do nothing;

insert into public.reviews (id, author, text, rating, property_name, review_date, visible, sort_order)
select id, author, text, rating, property_name, review_date, visible, sort_order
from jsonb_populate_recordset(null::public.reviews, $json$[
  {
    "id": "aaaaaaa1-0000-4000-8000-000000000001",
    "author": "Анна и Сергей",
    "property_name": "Дом «У озера»",
    "review_date": "Август 2026",
    "rating": 5,
    "text": "Провели здесь годовщину — тишина, озеро и закат из окна спальни. Дом чистый и очень продуманный, вернёмся зимой.",
    "visible": true,
    "sort_order": 1
  },
  {
    "id": "aaaaaaa1-0000-4000-8000-000000000002",
    "author": "Дмитрий",
    "property_name": "Русская баня",
    "review_date": "Июль 2026",
    "rating": 5,
    "text": "Лучшая баня, в которой был за последние годы. Пар лёгкий, купель ледяная, хозяева встретили и всё показали.",
    "visible": true,
    "sort_order": 2
  },
  {
    "id": "aaaaaaa1-0000-4000-8000-000000000003",
    "author": "Семья Ивановых",
    "property_name": "Дом «Сосновый»",
    "review_date": "Июнь 2026",
    "rating": 5,
    "text": "Приезжали большой компанией с детьми. Места хватило всем, вечером камин, утром — прогулка в лес. Спасибо!",
    "visible": true,
    "sort_order": 3
  },
  {
    "id": "aaaaaaa1-0000-4000-8000-000000000004",
    "author": "Ольга",
    "property_name": "Дом «Сосновый»",
    "review_date": "Май 2026",
    "rating": 5,
    "text": "Красиво как на фото, даже лучше. Кухня оснащена всем необходимым, постель свежая. Рекомендую!",
    "visible": true,
    "sort_order": 4
  }
]$json$::jsonb)
on conflict (id) do nothing;

-- =====================================================================
--  ГОТОВО. Следующий шаг — добавить email администратора.
--  Откройте файл supabase/02_add_admin.sql (см. ИНСТРУКЦИЯ.md, шаг 3).
-- =====================================================================
