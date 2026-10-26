-- Add lock, premium, and editable fields to tool_configs
ALTER TABLE public.tool_configs
ADD COLUMN IF NOT EXISTS flow_locked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS bump_locked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS mommy_locked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS premium_type text DEFAULT 'none' CHECK (premium_type IN ('none', 'limited_total', 'limited_monthly', 'premium_only')),
ADD COLUMN IF NOT EXISTS premium_limit integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS display_name text,
ADD COLUMN IF NOT EXISTS display_name_az text,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS description_az text;

-- Update existing tools with display names (Azerbaijani)
UPDATE public.tool_configs SET 
  display_name_az = CASE tool_id
    WHEN 'kick-counter' THEN 'Təpik Sayğacı'
    WHEN 'contraction-timer' THEN 'Sancı Sayğacı'
    WHEN 'weight-tracker' THEN 'Çəki İzləyici'
    WHEN 'hospital-bag' THEN 'Xəstəxana Çantası'
    WHEN 'baby-names' THEN 'Körpə Adları'
    WHEN 'exercises' THEN 'Məşqlər'
    WHEN 'nutrition' THEN 'Qidalanma'
    WHEN 'recipes' THEN 'Reseptlər'
    WHEN 'vitamins' THEN 'Vitaminlər'
    WHEN 'white-noise' THEN 'Ağ Səs'
    WHEN 'baby-photoshoot' THEN 'Körpə Fotosessiya'
    WHEN 'horoscope' THEN 'Ulduz Falı'
    WHEN 'safety-lookup' THEN 'Təhlükəsizlik'
    WHEN 'shopping-list' THEN 'Alış-veriş Siyahısı'
    WHEN 'weather-clothing' THEN 'Hava & Geyim'
    WHEN 'affiliate-products' THEN 'Tövsiyə Məhsullar'
    WHEN 'blood-sugar' THEN 'Qan Şəkəri'
    WHEN 'mood-diary' THEN 'Əhval Gündəliyi'
    WHEN 'cry-translator' THEN 'Ağlama Tərcüməçisi'
    WHEN 'poop-scanner' THEN 'Bez Skaneri'
    WHEN 'noise-meter' THEN 'Səs Ölçən'
    WHEN 'mom-friendly-map' THEN 'Ana Dostu Məkanlar'
    WHEN 'smart-play' THEN 'Ağıllı Oyun Qutusu'
    WHEN 'mental-health' THEN 'Sən Necəsən, Ana?'
    WHEN 'first-aid' THEN 'Həyat Qurtaran SOS'
    WHEN 'fairy-tales' THEN 'Sehrli Nağılçı'
    WHEN 'second-hand-market' THEN 'İkinci Əl Bazarı'
    ELSE tool_id
  END,
  description_az = CASE tool_id
    WHEN 'kick-counter' THEN 'Körpənizin hərəkətlərini izləyin'
    WHEN 'contraction-timer' THEN 'Sancıları ölçün və izləyin'
    WHEN 'weight-tracker' THEN 'Hamiləlik çəkinizi qeyd edin'
    WHEN 'hospital-bag' THEN 'Xəstəxana çantası hazırlığı'
    WHEN 'baby-names' THEN 'Körpəniz üçün ad seçin'
    WHEN 'exercises' THEN 'Hamiləlik məşqləri'
    WHEN 'nutrition' THEN 'Sağlam qidalanma planı'
    WHEN 'recipes' THEN 'Sağlam reseptlər'
    WHEN 'vitamins' THEN 'Vitamin və əlavələr'
    WHEN 'white-noise' THEN 'Körpəni sakitləşdirin'
    WHEN 'baby-photoshoot' THEN 'AI ilə körpə şəkilləri'
    WHEN 'horoscope' THEN 'Astroloji uyğunluq analizi'
    WHEN 'safety-lookup' THEN 'Məhsul təhlükəsizliyi yoxlayın'
    WHEN 'shopping-list' THEN 'Alış-veriş siyahısı yaradın'
    WHEN 'weather-clothing' THEN 'Hava və geyim tövsiyələri'
    WHEN 'affiliate-products' THEN 'Tövsiyə olunan məhsullar'
    WHEN 'blood-sugar' THEN 'Qan şəkəri izləyicisi'
    WHEN 'mood-diary' THEN 'Əhval-ruhiyyə gündəliyi'
    WHEN 'cry-translator' THEN 'Körpə ağlamasını anlayın'
    WHEN 'poop-scanner' THEN 'Bez vəziyyətini yoxlayın'
    WHEN 'noise-meter' THEN 'Ətraf səs səviyyəsini ölçün'
    WHEN 'mom-friendly-map' THEN 'Körpə dostu məkanları tapın'
    WHEN 'smart-play' THEN 'Yaşa uyğun oyunlar'
    WHEN 'mental-health' THEN 'Psixi sağlamlıq dəstəyi'
    WHEN 'first-aid' THEN 'Təcili yardım bələdçisi'
    WHEN 'fairy-tales' THEN 'AI ilə nağıl yaradın'
    WHEN 'second-hand-market' THEN 'İkinci əl məhsullar'
    ELSE NULL
  END
WHERE display_name_az IS NULL;