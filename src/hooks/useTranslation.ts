import { useCallback } from 'react';
import { useUserStore } from '@/store/userStore';
import { getCachedTranslation } from '@/lib/i18n';

/**
 * Translation hook. Returns t() function that:
 * - For 'az' language: returns the defaultValue (hardcoded Azerbaijani)
 * - For other languages: looks up cached DB translation, falls back to defaultValue
 */
export function useTranslation() {
  const language = useUserStore(state => state.language);
  
  const t = useCallback((key: string, defaultValue: string): string => {
    if (language === 'az') return defaultValue;
    
    const cached = getCachedTranslation(key, language);
    return cached || defaultValue;
  }, [language]);
  
  return { t, language };
}
