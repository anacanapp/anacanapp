
-- Legal documents table for Terms, Privacy, GDPR, etc.
CREATE TABLE public.legal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  title_az TEXT,
  content TEXT NOT NULL,
  content_az TEXT,
  version TEXT DEFAULT '1.0',
  effective_date DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

-- Everyone can read active legal documents
CREATE POLICY "Anyone can read active legal documents"
  ON public.legal_documents FOR SELECT
  USING (is_active = true);

-- Only admins can manage legal documents
CREATE POLICY "Admins can manage legal documents"
  ON public.legal_documents FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Scheduled notifications table
CREATE TABLE public.scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_audience TEXT NOT NULL DEFAULT 'all', -- 'all', 'flow', 'bump', 'mommy', 'partner'
  notification_type TEXT DEFAULT 'daily_tip',
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- Only admins can manage scheduled notifications
CREATE POLICY "Admins can manage scheduled notifications"
  ON public.scheduled_notifications FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Notification send log to track what was sent
CREATE TABLE public.notification_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  notification_id UUID REFERENCES public.scheduled_notifications(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'sent'
);

-- Enable RLS
ALTER TABLE public.notification_send_log ENABLE ROW LEVEL SECURITY;

-- Users can see their own notification logs
CREATE POLICY "Users can view own notification logs"
  ON public.notification_send_log FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert logs (for edge function)
CREATE POLICY "Service can insert notification logs"
  ON public.notification_send_log FOR INSERT
  WITH CHECK (true);

-- Push notification settings per user
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS daily_push_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_push_sent_at TIMESTAMPTZ;

-- Insert default legal documents
INSERT INTO public.legal_documents (document_type, title, title_az, content, content_az, version) VALUES
('terms_of_service', 'Terms of Service', 'İstifadə Şərtləri', 
'Terms of Service content...', 
'## İstifadə Şərtləri

### 1. Giriş
Bu İstifadə Şərtləri ("Şərtlər") Anacan mobil tətbiqi ("Tətbiq") ilə bağlı sizinlə aramızda hüquqi müqaviləni təşkil edir.

### 2. Xidmətlərin Təsviri
Anacan hamiləlik, menstruasiya dövrü və analıq dövrü üçün sağlamlıq izləmə tətbiqidir. Tətbiq aşağıdakı xidmətləri təqdim edir:
- Menstruasiya dövrünün izlənməsi
- Hamiləlik müddətinin izlənməsi
- Sağlamlıq göstəricilərinin qeydiyyatı
- AI əsaslı məsləhət sistemi
- İcma funksiyaları

### 3. Hesab Yaradılması
- 18 yaşdan yuxarı olmalısınız
- Doğru məlumat təqdim etməlisiniz
- Hesabınızın təhlükəsizliyinə cavabdehsiniz

### 4. İstifadə Qaydaları
- Tətbiqi qanuni məqsədlər üçün istifadə edin
- Başqalarının hüquqlarına hörmət edin
- Saxta məlumat yaymayın

### 5. Tibbi Məsuliyyətin İstisna Edilməsi
Bu tətbiq tibbi məsləhət əvəzinə deyil. Həmişə peşəkar tibbi yardım alın.

### 6. Əlaqə
Suallarınız üçün: support@anacan.az',
'1.0'),

('privacy_policy', 'Privacy Policy', 'Məxfilik Siyasəti',
'Privacy Policy content...',
'## Məxfilik Siyasəti

### 1. Məlumatların Toplanması
Biz aşağıdakı məlumatları toplayırıq:
- **Şəxsi məlumatlar**: Ad, e-poçt, doğum tarixi
- **Sağlamlıq məlumatları**: Menstruasiya dövrləri, hamiləlik məlumatları, əhval-ruhiyyə, simptomlar
- **Cihaz məlumatları**: Cihaz növü, əməliyyat sistemi

### 2. Məlumatların İstifadəsi
Məlumatlarınız aşağıdakı məqsədlərlə istifadə olunur:
- Xidmətlərin təqdim edilməsi
- Fərdiləşdirilmiş tövsiyələr
- Tətbiqin təkmilləşdirilməsi
- Müştəri dəstəyi

### 3. Məlumatların Paylaşılması
Məlumatlarınızı üçüncü tərəflərlə **satmırıq**. Yalnız aşağıdakı hallarda paylaşırıq:
- Qanuni tələblər
- Sizin razılığınızla

### 4. Məlumatların Qorunması
- SSL şifrələmə
- Təhlükəsiz verilənlər bazası
- Müntəzəm təhlükəsizlik yoxlamaları

### 5. Sizin Hüquqlarınız
- Məlumatlarınıza giriş
- Məlumatların düzəldilməsi
- Məlumatların silinməsi
- Məlumatların ixracı

### 6. Əlaqə
privacy@anacan.az',
'1.0'),

('gdpr_ccpa', 'GDPR & CCPA Compliance', 'GDPR və CCPA Uyğunluğu',
'GDPR & CCPA content...',
'## GDPR və CCPA Uyğunluğu

### Ümumi Məlumat Qoruma Qaydası (GDPR)

#### Sizin Hüquqlarınız
1. **Məlumatlılıq hüququ** - Məlumatlarınızın necə istifadə edildiyini bilmək
2. **Giriş hüququ** - Məlumatlarınızın surətini almaq
3. **Düzəliş hüququ** - Yanlış məlumatları düzəltmək
4. **Silmə hüququ** ("Unudulmaq hüququ") - Məlumatlarınızın silinməsini tələb etmək
5. **Etiraz hüququ** - Müəyyən emal növlərinə etiraz etmək
6. **Məlumat daşınması hüququ** - Məlumatlarınızı başqa xidmətə köçürmək

#### Hüquqi Əsas
Məlumatlarınızı aşağıdakı əsaslarla emal edirik:
- Sizin razılığınız
- Müqavilənin icrası
- Qanuni öhdəliklər

### Kaliforniya İstehlakçı Məxfilik Aktı (CCPA)

#### Kaliforniya Sakinləri üçün Əlavə Hüquqlar
1. Toplanmış məlumatlar haqqında məlumat almaq
2. Şəxsi məlumatların satışından imtina etmək
3. Ayrı-seçkiliyə məruz qalmamaq

#### Məlumatların Satışı
Biz şəxsi məlumatlarınızı **SATMIRIK**.

### Əlaqə
GDPR/CCPA sorğuları: legal@anacan.az',
'1.0'),

('disclaimer', 'Medical Disclaimer', 'Tibbi Məsuliyyətin İstisna Edilməsi',
'Medical Disclaimer content...',
'## Tibbi Məsuliyyətin İstisna Edilməsi

### Vacib Xəbərdarlıq

**Bu tətbiq tibbi cihaz və ya tibbi xidmət deyil.**

### 1. Ümumi Məlumat
Anacan tətbiqində təqdim olunan bütün məlumatlar yalnız məlumatlandırma məqsədi daşıyır və heç bir halda:
- Peşəkar tibbi məsləhəti əvəz etmir
- Diaqnoz qoymaq üçün istifadə edilə bilməz
- Müalicə planı təyin etmək üçün istifadə edilə bilməz

### 2. AI Məsləhətçisi Haqqında
Anacan.AI süni intellekt əsaslı köməkçidir və:
- Tibbi mütəxəssis deyil
- Fərdi tibbi vəziyyətinizi qiymətləndirə bilməz
- Təcili tibbi vəziyyətlərdə istifadə edilməməlidir

### 3. Təcili Hallarda
Aşağıdakı hallarda **dərhal həkimə müraciət edin**:
- Şiddətli ağrı
- Qanaxma
- Baş gicəllənməsi və ya huşunu itirmə
- Hər hansı narahatedici simptom

### 4. Məsuliyyət
Tətbiqdən istifadə nəticəsində yaranan hər hansı zərər üçün məsuliyyət daşımırıq.

### 5. Tövsiyə
Həmişə mütəxəssis həkimlə məsləhətləşin.',
'1.0'),

('refund_policy', 'Refund Policy', 'Geri Ödəmə Siyasəti',
'Refund Policy content...',
'## Geri Ödəmə Siyasəti

### 1. Premium Abunəlik

#### Sınaq Dövrü
- 7 günlük pulsuz sınaq dövrü
- Sınaq dövründə istənilən vaxt ləğv edə bilərsiniz
- Sınaq dövründə ödəniş tutulmur

#### Geri Ödəmə Şərtləri
- **14 gün ərzində**: Tam geri ödəmə
- **14-30 gün**: Proporsional geri ödəmə
- **30 gündən sonra**: Geri ödəmə yoxdur

### 2. Geri Ödəmə Tələbi
Geri ödəmə tələb etmək üçün:
1. Tətbiqdən Dəstək bölməsinə daxil olun
2. "Geri ödəmə" mövzusunda bilet açın
3. Abunəlik tarixinizi və səbəbini qeyd edin

### 3. İstisna Hallar
Aşağıdakı hallarda geri ödəmə edilmir:
- Xidmətin sui-istifadəsi
- İstifadə şərtlərinin pozulması
- 30 gündən sonrakı müraciətlər

### 4. İşlənmə Müddəti
Geri ödəmələr 5-10 iş günü ərzində işlənir.

### 5. Əlaqə
billing@anacan.az',
'1.0'),

('data_usage', 'Data Usage Policy', 'Məlumatların İstifadəsi',
'Data Usage Policy content...',
'## Məlumatların İstifadəsi Siyasəti

### 1. Hansı Məlumatları Toplayırıq

#### Şəxsi Məlumatlar
- Ad və soyad
- E-poçt ünvanı
- Doğum tarixi
- Profil şəkli (könüllü)

#### Sağlamlıq Məlumatları
- Menstruasiya dövrü tarixləri
- Hamiləlik məlumatları
- Simptomlar və əhval-ruhiyyə
- Çəki və digər ölçülər
- Qidalanma qeydləri

#### Texniki Məlumatlar
- Cihaz növü və modeli
- Əməliyyat sistemi versiyası
- Tətbiq versiyası
- IP ünvanı

### 2. Məlumatların Saxlanması
- Məlumatlar təhlükəsiz serverlərdə saxlanır
- Şifrələmə tətbiq olunur
- Müntəzəm ehtiyat nüsxələri alınır

### 3. Məlumatların Saxlanma Müddəti
- Aktiv hesablar: Hesab aktiv olduğu müddətdə
- Silinmiş hesablar: 30 gün sonra tamamilə silinir
- Qanuni tələblər: Lazım olan müddətdə

### 4. Üçüncü Tərəf Xidmətləri
Aşağıdakı xidmətlərdən istifadə edirik:
- Firebase (bildirişlər)
- Supabase (verilənlər bazası)
- AI xidmətləri (anonim sorğular)

### 5. Məlumatların Silinməsi
Hesabınızı silmək üçün:
1. Parametrlər > Hesab > Hesabı Sil
2. Və ya support@anacan.az ünvanına yazın',
'1.0');

-- Create trigger for updated_at
CREATE TRIGGER update_legal_documents_updated_at
  BEFORE UPDATE ON public.legal_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scheduled_notifications_updated_at
  BEFORE UPDATE ON public.scheduled_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample scheduled notifications
INSERT INTO public.scheduled_notifications (title, body, target_audience, notification_type, priority) VALUES
('Günün Xatırlatması 💧', 'Su içməyi unutma! Sağlamlığın üçün gündə 8 stəkan su için.', 'all', 'daily_tip', 1),
('Sabah Xoş Keçsin ☀️', 'Gününüz xeyirli olsun! Bugün özünüzə vaxt ayırın.', 'all', 'morning_greeting', 2),
('Vitamin Vaxtı 💊', 'Gündəlik vitaminlərinizi almağı unutmayın!', 'bump', 'vitamin_reminder', 1),
('Hərəkət Vaxtı 🚶‍♀️', 'Bir az gəzintiyə çıxmaq sağlamlığınız üçün faydalıdır.', 'bump', 'exercise_reminder', 3),
('Körpənin Təpikləri 👶', 'Bugün körpənizin hərəkətlərini qeyd etməyi unutmayın!', 'bump', 'kick_counter', 2),
('Özünüzə Qulluq ❤️', 'Hamiləlik dövründə istirahət çox vacibdir. Bir az dincəlin.', 'bump', 'self_care', 4),
('Sağlamlıq Günlüyü 📝', 'Bugünkü əhval-ruhiyyənizi və simptomlarınızı qeyd edin.', 'flow', 'daily_log', 1),
('Dövr Xatırlatması 🌸', 'Növbəti dövr tarixiniz yaxınlaşır. Hazırlıqlı olun!', 'flow', 'period_reminder', 2),
('Ana Olmaq Gözəldir 🤱', 'Körpənizlə hər an qiymətlidir. Bu anları dəyərləndirin!', 'mommy', 'mommy_tip', 1),
('Partnyor Dəstəyi 💑', 'Həyat yoldaşınıza bu gün dəstək olmağı unutmayın!', 'partner', 'partner_tip', 1);
