import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { tr } from '@/lib/tr';
import { Globe, Check } from 'lucide-react';
import { useUserStore } from '@/store/userStore';
import { ensureLanguageReady, fetchActiveLanguages } from '@/lib/i18n';
import { supabase } from '@/integrations/supabase/client';
import { APP_LANGUAGES } from '@/lib/app-languages';

// İlkin/fallback siyahı — app_languages sorğusu gələnə qədər və ya xəta halında.
const FALLBACK_LANGS = APP_LANGUAGES.map(language => ({ code: language.code as string, label: language.native_name as string, native: language.native_name as string }));



export default function LanguageSelector() {
  const language = useUserStore((state) => state.language);
  const setLanguage = useUserStore((state) => state.setLanguage);
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [langs, setLangs] = useState(FALLBACK_LANGS);

  // Removed feature flag check so the language selector is always enabled for all users.
  useEffect(() => {
    setEnabled(true);
    // Aktiv dillər DB-dən gəlir — ru/tr açmaq üçün app_languages.is_active=true kifayətdir.
    fetchActiveLanguages()
      .then((list) => setLangs(list.map((l) => ({ code: l.code, label: l.native_name, native: l.native_name }))))
      .catch(() => {});
  }, []);

  const change = async (code: string) => {
    if (switching) return;
    if (code === language) {setOpen(false);return;}
    setSwitching(true); setLoadError(false);
    // Lokal seed dərhal hazırdır (şəbəkəsiz); DB overlay-i reload-dan sonra
    // App boot onsuz da arxa planda edir — zəif internetdə istifadəçini gözlətmirik.
    try { await ensureLanguageReady(code); }
    catch { setSwitching(false); setLoadError(true); return; }
    setLanguage(code);
    // Persist to user_preferences so server-side (cron, edge fns) honors the choice
    const actor = useUserStore.getState().userId;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    try {
      await Promise.race([(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (actor && session?.user.id === actor && !controller.signal.aborted) await supabase.from('user_preferences')
          .upsert({ user_id: actor, language: code }, { onConflict: 'user_id' }).abortSignal(controller.signal);
      })(), new Promise<void>(resolve => { timer = setTimeout(() => { controller.abort(); resolve(); }, 3000); })]);
    } catch { /* Local selection is durable even while the backend is offline. */ }
    finally { clearTimeout(timer!); }
    setSwitching(false);
    setOpen(false);
    // Force re-render of the app
    setTimeout(() => window.location.reload(), 50);
  };

  if (!enabled) return null;

  const current = langs.find((l) => l.code === language) ?? langs[0];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between p-3 rounded-2xl bg-card hover:bg-muted/40 transition-colors border border-border">
        
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Globe className="w-4.5 h-4.5 text-primary" />
          </div>
          <div className="text-start">
            <div className="text-sm font-semibold text-foreground">{tr("untranslated_dil_language_7oaxzb", "Dil / Language")}</div>
            <div className="text-xs text-muted-foreground">{current.native}</div>
          </div>
        </div>
        <span className="text-xs font-semibold text-primary uppercase">{current.code}</span>
      </button>

      {open && createPortal(
      <div
        className="fixed inset-0 z-[95] bg-black/50 flex items-end sm:items-center justify-center p-4"
        onClick={() => !switching && setOpen(false)}>
        
          <div
          className="bg-card w-full max-w-sm max-h-[85dvh] flex flex-col rounded-3xl p-4 shadow-2xl"
          onClick={(e) => e.stopPropagation()}>
          
            <h3 className="text-base font-bold text-foreground mb-3 px-1 shrink-0">{tr("untranslated_dil_language_7oaxzb", "Dil / Language")}</h3>
            {loadError && <p role="alert" className="text-sm text-destructive mb-3">{tr('language_bundle_retry', 'Dil yüklənmədi. Yenidən cəhd edin.')}</p>}
            <div className="space-y-2 min-h-0 overflow-y-auto overscroll-contain">
              {langs.map((l) =>
            <button
              key={l.code}
              disabled={switching}
              onClick={() => change(l.code)}
              className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-colors ${
              l.code === language ?
              'border-primary bg-primary/10' :
              'border-border hover:bg-muted/40'}`
              }>
              
                  <div className="text-start">
                    <div className="text-sm font-semibold text-foreground">{l.native}</div>
                    <div className="text-[11px] text-muted-foreground uppercase">{l.code}</div>
                  </div>
                  {l.code === language && <Check className="w-4 h-4 text-primary" />}
                </button>
            )}
            </div>
            <p className="text-[11px] text-muted-foreground/70 mt-3 px-1 leading-relaxed">
              {tr("languageselector_dili_deyisdikden_sonra_tetbiq__ad3607", "Dili d\u0259yi\u015Fdikd\u0259n sonra t\u0259tbiq yenil\u0259n\u0259c\u0259k. / The app will reload after changing language.")}
            </p>
          </div>
        </div>,
      document.body)
      }
    </>);

}
