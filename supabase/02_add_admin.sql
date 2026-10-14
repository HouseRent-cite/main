-- =====================================================================
--  ДОБАВИТЬ АДМИНИСТРАТОРА
--  1) Замените owner@example.com на email владельца (тот же, что вы
--     указали при создании пользователя в Authentication → Users).
--  2) Supabase → SQL Editor → New query → вставить → Run.
--  Добавить второго администратора — запустите ещё раз с другим email.
-- =====================================================================

insert into public.admins (email)
values (lower('owner@example.com'))
on conflict (email) do nothing;

-- Проверка: должен появиться ваш email
select * from public.admins;

-- Удалить администратора (если нужно) — уберите два минуса в начале строки:
-- delete from public.admins where email = lower('old@example.com');
