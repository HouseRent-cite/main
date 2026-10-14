// =====================================================================
//  НАСТРОЙКИ ПОДКЛЮЧЕНИЯ К SUPABASE
//  Замените два значения ниже на свои (см. ИНСТРУКЦИЯ.md, шаг 2.5).
//  Здесь можно хранить ТОЛЬКО публичный ключ "anon" / "publishable".
//  Секретный ключ service_role / secret сюда вставлять НЕЛЬЗЯ!
// =====================================================================

export const SUPABASE_URL = 'https://jfesgkdgugbyklvgongh.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_MPJwxkSxQy99CvMH7qIHhw_EnawoReT';

// Имя хранилища для фотографий (создаётся SQL-скриптом, менять не нужно)
export const STORAGE_BUCKET = 'photos';

// Сколько миллисекунд ждать ответа базы, прежде чем показать резервные данные
export const REQUEST_TIMEOUT = 7000;
