import { useLanguage } from '@/hooks/useLanguage';

/**
 * Returns the list of disabled tool IDs for the current language,
 * and a helper to check if a specific tool is disabled.
 */
export function useDisabledTools() {
  const { disabledTools } = useLanguage();

  return {
    disabledTools,
    isToolDisabled: (toolId: string) => disabledTools.includes(toolId),
  };
}
