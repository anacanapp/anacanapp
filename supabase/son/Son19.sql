-- Baby Names AI axtarış açarları (ru/tr/en) — idempotent
INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('babynames_ai_search', 'ru', 'Искать с AI: {name}', 'common'),
  ('babynames_ai_search', 'tr', 'AI ile ara: {name}', 'common'),
  ('babynames_ai_search', 'en', 'Search with AI: {name}', 'common'),
  ('babynames_ai_searching', 'ru', 'AI ищет...', 'common'),
  ('babynames_ai_searching', 'tr', 'AI arıyor...', 'common'),
  ('babynames_ai_searching', 'en', 'AI is searching...', 'common'),
  ('babynames_ai_notfound', 'ru', 'AI не распознал это имя — проверьте написание', 'common'),
  ('babynames_ai_notfound', 'tr', 'AI bu adı tanımadı — yazımı kontrol edin', 'common'),
  ('babynames_ai_notfound', 'en', 'AI didn''t recognize this name — check the spelling', 'common'),
  ('babynames_ai_error', 'ru', 'AI-поиск не удался — попробуйте ещё раз', 'common'),
  ('babynames_ai_error', 'tr', 'AI araması başarısız — tekrar deneyin', 'common'),
  ('babynames_ai_error', 'en', 'AI search failed — try again', 'common')
ON CONFLICT (key, lang) DO NOTHING;
