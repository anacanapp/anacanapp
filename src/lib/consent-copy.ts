import { tr, formatTr } from '@/lib/tr';

/**
 * Consent gate + Privacy "Razılıqlar" section — every UI string with its Azerbaijani source text.
 * Translations live in src/locales/{az,en}.json and scripts/i18n/<lang>.seed.json under the same keys.
 */
export const CONSENT_COPY = {
  consent_eyebrow: 'Başlamazdan əvvəl',
  consent_title: 'Məlumatlarınız sizindir',
  consent_intro: 'Davam etmək üçün aşağıdakıları oxuyub təsdiq edin. Heç bir xana əvvəlcədən işarələnməyib.',
  consent_terms_label: 'İstifadə Şərtləri və Məxfilik Siyasəti ilə tanış oldum və qəbul edirəm',
  consent_terms_link: 'İstifadə Şərtləri',
  consent_privacy_link: 'Məxfilik Siyasəti',
  consent_health_label: 'Sağlamlıq məlumatlarımın emalına açıq razılıq verirəm',
  consent_health_desc: 'Tsikl, hamiləlik, körpə və sağlamlıq qeydləriniz yalnız izləmə, xatırlatmalar və sizə uyğun tövsiyələr üçün emal olunur. Bu razılığı istənilən vaxt Məxfilik ayarlarında geri götürə bilərsiniz.',
  consent_age_label: '16 yaşdan böyükəm',
  consent_marketing_label: 'Təkliflər və yeniliklər (push və e-poçt) almaq istəyirəm',
  consent_marketing_desc: 'İstəyə bağlıdır, istənilən vaxt söndürə bilərsiniz.',
  consent_required: 'Məcburi',
  consent_optional: 'İstəyə bağlı',
  consent_medical_note: 'Anacan tibbi xidmət deyil; məlumatlar həkim məsləhətini əvəz etmir.',
  consent_disclaimer_link: 'Tibbi xəbərdarlıq',
  consent_continue: 'Davam et',
  consent_sign_out: 'Çıxış et',
  consent_saving: 'Yadda saxlanılır…',
  consent_saved_offline: 'Seçiminiz cihazda saxlanıldı, internet olanda göndəriləcək.',
  consent_section_title: 'Razılıqlar',
  consent_section_desc: 'Sağlamlıq məlumatı və marketinq razılıqlarınızı burada idarə edin. Hər dəyişiklik tarix və sənəd versiyası ilə qeydə alınır.',
  consent_health_toggle: 'Sağlamlıq məlumatlarının emalı',
  consent_health_toggle_desc: 'Tsikl, hamiləlik, körpə və sağlamlıq qeydləri',
  consent_marketing_toggle: 'Marketinq təklifləri',
  consent_marketing_toggle_desc: 'Push bildirişləri və e-poçt ilə təkliflər',
  consent_terms_accepted: 'İstifadə Şərtləri qəbul edilib: {date} · versiya {version}',
  consent_terms_unknown: 'İstifadə Şərtlərinin qəbulu hələ qeydə alınmayıb.',
  consent_withdraw_title: 'Sağlamlıq məlumatı razılığını geri götürürsünüz?',
  consent_withdraw_text: 'Razılığı geri götürsəniz, tsikl, hamiləlik, körpə və sağlamlıq izləmə funksiyaları məlumatları sinxronlaşdırmağı dayandıracaq. Mövcud məlumatlarınız silinmir. Razılığı istənilən vaxt yenidən verə bilərsiniz.',
  consent_withdraw_confirm: 'Geri götür',
  consent_cancel: 'Ləğv et',
  consent_withdrawn_note: 'Sağlamlıq məlumatı razılığı geri götürülüb. İzləmə funksiyaları sinxronlaşmır.',
  consent_updated: 'Razılıq yeniləndi',
  consent_update_failed: 'Yadda saxlanılmadı — internet bağlantısını yoxlayıb yenidən cəhd edin.',
  consent_unavailable: 'Razılıq məlumatı hazırda yüklənmədi.',
  consent_ai_toggle: 'Anacan.AI köməkçi',
  consent_ai_toggle_desc: 'Mesajlarınız cavab üçün Google Gemini-yə ötürülür',
  consent_child_toggle: 'Uşaq məlumatlarının emalı',
  consent_child_toggle_desc: 'Boy, çəki, qidalanma, yuxu, peyvənd, inkişaf və fotolar',
  consent_marketing_email: 'E-poçt',
  consent_marketing_push: 'Push bildirişləri',
  consent_marketing_sms: 'SMS',
  ai_consent_title: 'Anacan.AI istifadəsinə razılıq',
  ai_consent_text: 'Anacan.AI-yə yazdıqlarınız və cavabı dəqiqləşdirmək üçün seçdiyiniz kontekst (məs. hamiləlik həftəsi) cavab yaratmaq üçün Google-un Gemini xidmətinə ötürülür. Google bu məlumatlarla öz modellərini öyrətmir. AI həkim deyil və diaqnoz qoymur.',
  ai_consent_accept: 'Razıyam',
  ai_consent_decline: 'İndi yox',
  ai_consent_declined: 'Anacan.AI razılıq olmadan açılmır. Fikrinizi Məxfilik ayarlarında dəyişə bilərsiniz.',
} as const;

/**
 * Türkiye users (profile country TR or app language tr): the owner's KVKK Açık Rıza / 6563 İYS texts, shown
 * verbatim in Turkish whatever the app language (legal wording, never machine-translated or localised).
 */
export const KVKK_TEXTS = {
  notice_link: "KVKK Aydınlatma Metni'ni okuyun",
  notice_url: 'https://anacan.az/kvkk',
  health_data: "Anacan Aydınlatma Metni'ni okudum ve anladım. Gebelik, adet döngüsü, semptom, tahlil, ilaç ve benzeri sağlık verilerimin; gebelik, döngü ve bebek takvimlerinin oluşturulması, hatırlatmaların gönderilmesi ve içeriğin gebelik haftama göre kişiselleştirilmesi amacıyla ″ANACAN″ Mahdud Mesuliyyetli Cemiyyeti tarafından işlenmesine açık rıza veriyorum.",
  child_data: 'Çocuğumun velisi veya yasal temsilcisi olduğumu beyan ederim. Çocuğumun boy, kilo, beslenme, uyku, aşı ve gelişim bilgileri ile fotoğraflarının bebek günlüğü, gelişim takvimi ve aşı hatırlatmaları amacıyla işlenmesine açık rıza veriyorum.',
  marketing: "6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun ve ilgili yönetmelik kapsamında; Anacan'ın kampanya, kurs ve ürün tanıtımlarına ilişkin ticari elektronik iletileri aşağıda seçtiğim kanallardan göndermesine onay veriyorum. Onayımı her iletideki ret bağlantısından, uygulamada Ayarlar → Bildirimler bölümünden veya İleti Yönetim Sistemi (İYS) üzerinden ücretsiz olarak istediğim zaman geri alabilirim.",
  marketing_email: 'E-posta',
  marketing_push: 'Anlık bildirim (push)',
  marketing_sms: 'SMS',
  ai_assistant: "AI asistanına yazdığım mesajların ve cevabın daha doğru olması için seçtiğim sağlık bilgilerinin (örneğin gebelik haftası), yanıt üretilmesi amacıyla işlenmesine ve bu amaçla hizmet sağlayıcı Google LLC'ye (Gemini) iletilmesine açık rıza veriyorum. AI asistanının tıbbi teşhis koymadığını ve hekim tavsiyesinin yerini tutmadığını biliyorum.",
} as const;

export type ConsentCopyKey = keyof typeof CONSENT_COPY;
export const ct = (key: ConsentCopyKey) => tr(key, CONSENT_COPY[key]);
export const ctf = (key: ConsentCopyKey, values: Record<string, unknown>) => formatTr(key, CONSENT_COPY[key], values);
