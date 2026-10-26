import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore } from '@/store/userStore';
import { useShallow } from 'zustand/react/shallow';
import { Check, Search, ChevronLeft, Globe } from 'lucide-react';
import { ensureLanguageReady, loadTranslations, fetchActiveLanguages } from '@/lib/i18n';
import { isRtlLang, rtlX } from '@/lib/rtl';
import logoImage from '@/assets/brand-mark.png';
import { useState, useMemo, useEffect } from 'react';
import countriesData from '../../countries.json';
import { APP_LANGUAGES, NEW_LANGUAGE_CODES, localizedCountryName } from '@/lib/app-languages';
import { startupText, type StartupKey } from '@/lib/startup-i18n';

// flagcdn ölkə kodu xəritəsi (dil kodu → bayraq kodu)
const FLAG_BY_CODE: Record<string, string> = Object.fromEntries(APP_LANGUAGES.map(language => [language.code, language.flag]));
const FLAG_IMAGES: Record<string, string> = Object.fromEntries(countriesData.map(country => [country.isoAlpha2.toLowerCase(),
  country.flag.startsWith('data:') ? country.flag : `data:image/png;base64,${country.flag}`]));

/**
 * Cihazın/brauzerin dil-regionundan ("ar-SA", "ru-RU", "de-DE" və s.) ölkə kodunu
 * təxmin edir ki, ölkə seçimi ekranında istifadəçinin öz ölkəsi ƏVVƏLCƏDƏN
 * qeyd olunsun (dəyişdirilə bilər, sadəcə default). Uyğun gəlməzsə/API yoxdursa null.
 */
function guessCountryFromLocale(countries: { isoAlpha2: string }[]): string | null {
  try {
    const locales = typeof navigator !== 'undefined' && navigator.languages?.length ?
    navigator.languages : [typeof navigator !== 'undefined' ? navigator.language : ''];
    for (const loc of locales) {
      if (!loc) continue;
      let region: string | null = null;
      // Intl.Locale bütün brauzerlərdə yoxdur (məs. bəzi köhnə WebView-lar) — səssizcə keç
      if (typeof (Intl as any).Locale === 'function') {
        try {
          const l = new (Intl as any).Locale(loc);
          region = (l.maximize ? l.maximize() : l).region || l.region || null;
        } catch {/* bu locale parse olunmadı, növbətiyə keç */}
      }
      if (!region) {
        // Fallback: "ru-RU", "en-US" kimi teqin özündən regionu çıxar
        const m = /-([A-Za-z]{2})(?:-|$)/.exec(loc);
        if (m) region = m[1].toUpperCase();
      }
      if (region && countries.some((c) => c.isoAlpha2 === region)) return region;
    }
  } catch {/* naviqator/Intl əlçatan deyil (SSR və s.) */}
  return null;
}

// İlkin/fallback siyahı — app_languages sorğusu gələnə qədər və ya offline halda.
const FALLBACK_LANGS = APP_LANGUAGES.map(language => ({ code: language.code as string,
  label: language.native_name as string, nativeLabel: language.native_name as string, subLabel: language.name as string, flag: language.flag as string }));

export default function InitialLanguageScreen() {
  const { setLanguage, setHasSelectedLanguage, setCountryCode } = useUserStore(
    useShallow((s) => ({ setLanguage: s.setLanguage, setHasSelectedLanguage: s.setHasSelectedLanguage, setCountryCode: s.setCountryCode }))
  );
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedLang, setSelectedLang] = useState<string>(useUserStore.getState().language || 'az');
  const [isSwitching, setIsSwitching] = useState(false);
  const [languageError, setLanguageError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [langs, setLangs] = useState(FALLBACK_LANGS);
  // Cihaz dil-regionundan təxmin edilən ölkə — siyahının başında göstərilir və işarələnir,
  // istifadəçi hələ toxunmasa da default kimi qeyd olunur (istənilən vaxt dəyişdirilə bilər).
  const [guessedCountry] = useState<string | null>(() => guessCountryFromLocale(countriesData));

  // Aktiv dillər DB-dən (app_languages.is_active) — ru/tr açılışı app release tələb etmir.
  useEffect(() => {
    fetchActiveLanguages()
      .then((list) => {
        const mapped = list.map((l) => ({
            code: l.code,
            label: l.native_name,
            nativeLabel: l.native_name,
            subLabel: l.name,
            flag: FLAG_BY_CODE[l.code] || 'az',
        }));
        // AZ universal fallback-dır; remote siyahı natamam olsa belə itirmə.
        if (!mapped.some((l) => l.code === 'az')) mapped.unshift(FALLBACK_LANGS[0]);
        setLangs(mapped);
      })
      .catch(() => {});
  }, []);

  const handleLangSelect = (code: string) => {
    if (isSwitching) return;
    setSelectedLang(code);
    setLanguageError(false);
  };

  const handleContinue = async () => {
    if (isSwitching || !selectedLang) return;
    setIsSwitching(true);
    setLanguageError(false);
    try {
      if (selectedLang !== 'az') {
      // Lokal seed dərhal (şəbəkəsiz); DB overlay arxa planda gəlir —
      // zəif internetdə "Davam et" düyməsi saniyələrlə asılı qalmır.
        await ensureLanguageReady(selectedLang);
        void loadTranslations(selectedLang);
      }
      setLanguage(selectedLang);
      await new Promise(resolve => setTimeout(resolve, 300));
      setStep(2);
    } catch { setLanguageError(true); }
    finally { setIsSwitching(false); }
  };

  const handleCountrySelect = (code: string) => {
    setCountryCode(code);
    setHasSelectedLanguage(true);
    // KRİTİK: qeyri-az dillərdə BİR DƏFƏ reload — main-chunk modul konstantları
    // (onboarding sual mətnləri, flow seçimləri və s.) import anında tr() ilə
    // hesablanır; reload-suz ilk quraşdırmada AZ donub qalırdılar.
    // Keş artıq localStorage-a yazılıb → reload-dan sonra zero-flash işləyir.
    if (selectedLang && selectedLang !== 'az') {
      setTimeout(() => window.location.reload(), 80);
    }
  };

  const filteredCountries = useMemo(() => {
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      return countriesData.filter(c => c.name.toLowerCase().includes(lowerQuery)
        || localizedCountryName(c.isoAlpha2, selectedLang, c.name).toLowerCase().includes(lowerQuery));
    }
    // Axtarış yoxdursa təxmin edilən ölkəni siyahının başına çıxarırıq (görünən ilk seçim olsun).
    if (guessedCountry) {
      const idx = countriesData.findIndex(c => c.isoAlpha2 === guessedCountry);
      if (idx > 0) {
        const arr = [...countriesData];
        const [guessed] = arr.splice(idx, 1);
        arr.unshift(guessed);
        return arr;
      }
    }
    return countriesData;
  }, [searchQuery, guessedCountry, selectedLang]);

  // Seçilmiş dilə görə addım keçidi istiqaməti (store/dir asinxron yenilənməzdən əvvəl
  // dərhal məlumdur, çünki selectedLang lokal state-dir).
  const isRtl = isRtlLang(selectedLang);

  // Bu ekran tərcümə yüklənməzdən ƏVVƏL göstərilir — mətnlər inline saxlanır.
  const L = (key: StartupKey, m: Record<string, string>) => startupText(selectedLang, key, m[selectedLang] ?? m.az);
  const expandedLanguage = (NEW_LANGUAGE_CODES as readonly string[]).includes(selectedLang);
  const t = {
    selectCountry: L('selectCountry', { az: 'Ölkə seçin', en: 'Select Country', ru: 'Выберите страну', tr: 'Ülke seçin', kk: 'Елді таңдаңыз', uz: 'Mamlakatni tanlang', ka: 'აირჩიეთ ქვეყანა', de: 'Land auswählen', ar: 'اختاري الدولة' }),
    selectCountryCap: expandedLanguage ? 'ANACAN' : 'SELECT COUNTRY',
    searchPlaceholder: L('searchPlaceholder', { az: 'Axtar', en: 'Search', ru: 'Поиск', tr: 'Ara', kk: 'Іздеу', uz: 'Qidirish', ka: 'ძებნა', de: 'Suchen', ar: 'بحث' }),
    noneFound: L('noneFound', { az: 'Ölkə tapılmadı', en: 'No countries found', ru: 'Страны не найдены', tr: 'Ülke bulunamadı', kk: 'Ел табылмады', uz: 'Mamlakat topilmadi', ka: 'ქვეყანა ვერ მოიძებნა', de: 'Kein Land gefunden', ar: 'لم يتم العثور على دولة' }),
    selectLanguage: L('selectLanguage', { az: 'Dil seçin', en: 'Select Language', ru: 'Выберите язык', tr: 'Dil seçin', kk: 'Тілді таңдаңыз', uz: 'Tilni tanlang', ka: 'აირჩიეთ ენა', de: 'Sprache auswählen', ar: 'اختاري اللغة' }),
    selectLanguageCap: expandedLanguage ? 'ANACAN' : 'SELECT LANGUAGE',
    continue: L('continue', { az: 'Davam et', en: 'Continue', ru: 'Продолжить', tr: 'Devam et', kk: 'Жалғастыру', uz: 'Davom etish', ka: 'გაგრძელება', de: 'Weiter', ar: 'متابعة' }),
    continueEn: 'Continue',
  };

  return (
    <div
      className="a-scope h-[100dvh] flex flex-col relative overflow-hidden"
      style={{
        background: 'var(--a-bg)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Watercolor sky */}
      <div className="a-sky" aria-hidden>
        <span className="a-cloud c1" />
        <span className="a-cloud c2" />
        <span className="a-cloud c3" />
        <span className="a-cloud c4" />
      </div>

      <div className="flex-1 min-h-0 flex flex-col px-6 py-8 relative z-10 w-full max-w-md mx-auto h-full">
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: rtlX(-30, isRtl) }}
              transition={{ duration: 0.35 }}
              className="flex-1 min-h-0 flex flex-col"
            >
              {/* Compact brand — sabit hissə, heç vaxt scroll olunmur */}
              <div className="flex flex-col items-center shrink-0 mb-5">
                <div className="w-14 h-14 flex items-center justify-center mb-4 overflow-hidden"
                style={{ borderRadius: 18, background: 'var(--a-grad-peach)', boxShadow: '0 14px 28px -12px rgba(217, 108, 74, 0.5)' }}>
                  <img src={logoImage} alt="Anacan" className="w-9 h-9 object-contain" />
                </div>
                <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.2, color: 'var(--a-ink)' }}>
                  {t.selectLanguage}
                </h1>
                <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--a-on-bg-soft)', marginTop: 4 }}>
                  {t.selectLanguageCap}
                </p>
              </div>

              {/* 2-column language grid — YALNIZ bura scroll olunur (kiçik ekranda 9 dil sığmaya bilər);
                  başlıq və Davam et düyməsi bundan asılı olmadan HƏMİŞƏ görünür (menyu kimi sabit). */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-1 px-1">
                <div className="grid grid-cols-2 gap-3 w-full pb-1">
                  {langs.map((lang, idx) => {
                    const isSelected = selectedLang === lang.code;
                    return (
                      <motion.button
                        key={lang.code}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(0.08 + idx * 0.035, 0.35), duration: 0.3 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleLangSelect(lang.code)}
                        disabled={isSwitching}
                        className="relative flex flex-col items-center transition-all cursor-pointer disabled:cursor-not-allowed"
                        style={{
                          padding: 16,
                          borderRadius: 20,
                          background: 'var(--a-surface)',
                          border: isSelected ? '2px solid var(--a-peach-2)' : '2px solid transparent',
                          boxShadow: 'var(--a-card-shadow)'
                        }}
                      >
                        <div className="mb-2.5 rounded-md overflow-hidden" style={{ border: '1px solid var(--a-line)', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}>
                          <img
                            src={FLAG_IMAGES[lang.flag]}
                            alt={lang.code}
                            className="w-9 h-6 object-cover"
                          />
                        </div>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--a-ink)' }}>
                          {lang.nativeLabel}
                        </span>
                        <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--a-ink-soft)', marginTop: 2 }}>
                          {lang.subLabel}
                        </span>
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                            className="absolute top-2 end-2 w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ background: 'var(--a-peach-2)' }}
                          >
                            <Check className="w-3 h-3 text-white" strokeWidth={3.5} />
                          </motion.div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Continue — sabit alt zolaq (menyu kimi), grid scroll olunsa belə HƏMİŞƏ görünür */}
               <div className="shrink-0 pt-4">
                 {languageError && <p role="alert" className="mb-2 text-sm text-center">{startupText(selectedLang, 'connectionPending', 'Bağlantı hazırlanır. Bir qədər sonra yenidən cəhd edin.')}</p>}
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.3 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleContinue}
                  disabled={isSwitching || !selectedLang}
                  className="w-full py-4 rounded-full text-white transition-all disabled:opacity-70"
                  style={{ background: 'var(--a-peach-2)', fontSize: 14, fontWeight: 700, boxShadow: '0 16px 32px -12px rgba(217, 108, 74, 0.6)' }}
                >
                  {t.continue}
                   {!expandedLanguage && <><span className="font-normal opacity-70 mx-1.5">·</span>
                   <span className="font-medium opacity-90">{t.continueEn}</span></>}
                </motion.button>

                <p className="text-center mt-3 leading-relaxed" style={{ fontSize: 11, color: 'var(--a-on-bg-soft)' }}>
                   {L('languageHint', {
                    az: 'Dili sonradan tənzimləmələrdən dəyişə bilərsiniz',
                    en: 'You can change the language later in settings',
                    ru: 'Язык можно изменить позже в настройках',
                    tr: 'Dili daha sonra ayarlardan değiştirebilirsiniz',
                    kk: 'Тілді кейін баптаулардан өзгерте аласыз',
                    uz: 'Tilni keyinroq sozlamalardan oʻzgartira olasiz',
                    ka: 'ენის შეცვლა მოგვიანებით პარამეტრებში შეგიძლიათ',
                    de: 'Du kannst die Sprache später in den Einstellungen ändern',
                    ar: 'يمكنكِ تغيير اللغة لاحقًا من الإعدادات',
                  })}
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: rtlX(30, isRtl) }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: rtlX(-30, isRtl) }}
              transition={{ duration: 0.35 }}
              className="flex-1 min-h-0 flex flex-col h-full"
            >
              {/* Header — sabit, heç vaxt scroll olunmur (Geri düyməsi həmişə görünür) */}
              <div className="flex items-center justify-between shrink-0 mb-5 pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="a-icon-btn"
                   aria-label={startupText(selectedLang, 'back', 'Back')}
                >
                  <ChevronLeft className="rtl:rotate-180" size={18} strokeWidth={2.5} />
                </button>
                <div className="text-center">
                  <h2 style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.2, color: 'var(--a-ink)' }}>
                    {t.selectCountry}
                  </h2>
                  <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--a-on-bg-soft)', marginTop: 2 }}>
                    {t.selectCountryCap}
                  </p>
                </div>
                <div className="w-10" />
              </div>

              {/* Search — sabit, list-in üstündə həmişə görünür */}
              <div className="relative shrink-0 mb-4">
                <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4" strokeWidth={2.5} style={{ color: 'var(--a-ink-faint)' }} />
                <input
                  type="text"
                  placeholder={t.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full py-3.5 ps-11 pe-4 rounded-2xl text-sm focus:outline-none transition-colors"
                  style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)', color: 'var(--a-ink)', boxShadow: 'var(--a-card-shadow)' }}
                />
              </div>

              {/* List card — YALNIZ bura scroll olunur; header/search yuxarıda sabit qalır */}
              <div className="flex-1 min-h-0 overflow-hidden mb-4" style={{ background: 'var(--a-surface)', borderRadius: 20, boxShadow: 'var(--a-card-shadow)' }}>
                <div className="h-full overflow-y-auto scrollbar-hide">
                  {filteredCountries.length > 0 ? (
                    filteredCountries.map((country, idx) => {
                      const isGuessed = !searchQuery && guessedCountry === country.isoAlpha2;
                      return (
                      <motion.button
                        key={country.isoAlpha2}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx * 0.02, 0.3), duration: 0.25 }}
                        onClick={() => handleCountrySelect(country.isoAlpha2)}
                        className="w-full flex items-center px-4 py-3 transition-colors cursor-pointer"
                        style={{ borderBottom: '1px solid var(--a-line)', background: isGuessed ? 'var(--a-peach-soft, rgba(255,157,99,0.08))' : 'transparent' }}
                      >
                        <div className="w-6 h-4 me-3 overflow-hidden rounded-sm flex-shrink-0" style={{ border: '1px solid var(--a-line)' }}>
                          <img
                            src={country.flag.startsWith('data:') ? country.flag : `data:image/png;base64,${country.flag}`}
                            alt={localizedCountryName(country.isoAlpha2, selectedLang, country.name)}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="text-start flex-1" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--a-ink)' }}>
                          {localizedCountryName(country.isoAlpha2, selectedLang, country.name)}
                        </span>
                        {isGuessed && (
                          <span className="flex items-center gap-1 me-2" style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--a-peach-2)' }}>
                            <Check className="w-3.5 h-3.5" strokeWidth={3} />
                          </span>
                        )}
                        <ChevronLeft className="rtl:rotate-180 w-4 h-4 rotate-180" style={{ color: 'var(--a-ink-faint)' }} />
                      </motion.button>
                      );
                    })
                  ) : (
                    <div className="text-center py-12 px-4">
                      <Globe className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--a-ink-faint)' }} />
                      <p style={{ fontSize: 13, color: 'var(--a-ink-soft)' }}>{t.noneFound}</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
