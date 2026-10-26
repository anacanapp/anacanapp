import { useQuery } from '@tanstack/react-query';
import { useUserStore } from '@/store/userStore';
import { useCallback, useEffect, useMemo } from 'react';
import { loadTranslations, ensureLanguageReady, fetchActiveLanguages } from '@/lib/i18n';
import { resolveAppLanguages, normalizeAppLanguage } from '@/lib/app-languages';

export function useLanguage() {
  const language = useUserStore(state => state.language);
  const setLanguage = useUserStore(state => state.setLanguage);
  
  // Fetch active languages from DB
  const { data: languages = resolveAppLanguages(), isLoading } = useQuery({
    queryKey: ['app-languages'],
    queryFn: fetchActiveLanguages,
    staleTime: 1000 * 60 * 30, // 30 min cache
  });
  
  // Load translations when language changes
  useEffect(() => {
    if (language !== 'az') {
      loadTranslations(language);
    }
  }, [language]);
  
  const changeLanguage = useCallback(async (lang: string) => {
    lang = normalizeAppLanguage(lang);
    if (lang === language) return;
    await ensureLanguageReady(lang);
    setLanguage(lang);
    window.location.reload();
  }, [language, setLanguage]);

  // Extract disabled_tools for the current language
  const disabledTools: string[] = useMemo(() => {
    const currentLang = languages.find((l: any) => l.code === language);
    if (!currentLang) return [];
    const dt = (currentLang as any).disabled_tools;
    return Array.isArray(dt) ? dt : [];
  }, [languages, language]);
  
  return {
    language,
    languages,
    isLoading,
    changeLanguage,
    disabledTools,
  };
}
