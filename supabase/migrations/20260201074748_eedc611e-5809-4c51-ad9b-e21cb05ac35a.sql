-- Add missing columns to surprise_ideas
ALTER TABLE public.surprise_ideas ADD COLUMN IF NOT EXISTS surprise_key TEXT;
ALTER TABLE public.surprise_ideas ADD COLUMN IF NOT EXISTS title_az TEXT;
ALTER TABLE public.surprise_ideas ADD COLUMN IF NOT EXISTS description_az TEXT;

-- Update existing rows with unique surprise_key based on id
UPDATE public.surprise_ideas SET surprise_key = id::text WHERE surprise_key IS NULL;

-- Add unique constraint if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'surprise_ideas_surprise_key_key'
  ) THEN
    ALTER TABLE public.surprise_ideas ADD CONSTRAINT surprise_ideas_surprise_key_key UNIQUE (surprise_key);
  END IF;
END $$;

-- Insert default surprise ideas only if table is empty or ideas don't exist
INSERT INTO public.surprise_ideas (surprise_key, title, title_az, description, description_az, emoji, category, difficulty, points, sort_order) 
SELECT * FROM (VALUES
  ('breakfast_in_bed', 'Breakfast in Bed', 'Yataqda səhər yeməyi', 'Prepare a lovely breakfast and serve it in bed', 'Gözəl bir səhər yeməyi hazırla və yataqda ver', '🍳', 'romantic', 'easy', 15, 1),
  ('love_letter', 'Love Letter', 'Sevgi məktubu', 'Write a heartfelt letter expressing your love', 'Sevgini ifadə edən ürəkdən bir məktub yaz', '💌', 'romantic', 'easy', 10, 2),
  ('surprise_date', 'Surprise Date Night', 'Sürpriz Görüş Gecəsi', 'Plan a romantic dinner at her favorite restaurant', 'Sevimli restoranında romantik bir şam yeməyi planla', '🌹', 'romantic', 'medium', 25, 3),
  ('foot_massage', 'Relaxing Massage', 'Rahatladıcı Masaj', 'Give her a relaxing foot or back massage', 'Ayaq və ya kürək masajı et', '💆', 'care', 'easy', 15, 4),
  ('house_cleaning', 'Deep House Cleaning', 'Ev Təmizliyi', 'Clean the entire house while she rests', 'O istirahət edərkən bütün evi təmizlə', '🧹', 'care', 'medium', 20, 5),
  ('baby_shopping', 'Baby Shopping Spree', 'Körpə Alış-verişi', 'Go shopping for cute baby items together', 'Birlikdə şirin körpə əşyaları al', '🛍️', 'gift', 'medium', 20, 6),
  ('photo_session', 'Maternity Photo Session', 'Hamiləlik Foto Çəkilişi', 'Book a professional maternity photoshoot', 'Peşəkar hamiləlik foto çəkilişi planla', '📸', 'adventure', 'hard', 35, 7),
  ('cook_dinner', 'Cook Her Favorite Meal', 'Sevimli Yeməyini Bişir', 'Prepare her favorite dinner from scratch', 'Sevdiyi yeməyi özün hazırla', '👨‍🍳', 'care', 'medium', 20, 8),
  ('flower_surprise', 'Flower Delivery', 'Gül Sürprizi', 'Send beautiful flowers to brighten her day', 'Gününü işıqlandırmaq üçün gözəl güllər göndər', '💐', 'romantic', 'easy', 10, 9),
  ('spa_day', 'Home Spa Day', 'Evdə Spa Günü', 'Create a relaxing spa experience at home', 'Evdə rahatladıcı spa təcrübəsi yarat', '🧖', 'care', 'hard', 30, 10)
) AS v(surprise_key, title, title_az, description, description_az, emoji, category, difficulty, points, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.surprise_ideas LIMIT 1);