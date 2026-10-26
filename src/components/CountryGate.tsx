import { useState } from 'react';
import { Globe2, Loader2 } from 'lucide-react';
import { tr } from '@/lib/tr';
import CountrySelect from '@/components/CountrySelect';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { useToast } from '@/hooks/use-toast';

/**
 * MƏCBURİ ölkə seçimi ekranı — profili olan, amma country_code-u BOŞ olan
 * hər istifadəçiyə (Apple/Google ilə qeydiyyatdan keçənlər ölkə addımı
 * görmürdü; köhnə hesablarda isə sütun sonradan əlavə olunub) app açılan
 * kimi BİR DƏFƏ göstərilir. Keçmək/bağlamaq mümkün deyil — seçim edilməlidir.
 *
 * Server tərəfdə paralel mexanizm: Duzelis63.sql IP-dən (cf-ipcountry)
 * avtomatik doldurur — bu ekran yalnız IP tutma işləməyən hallar üçün
 * son sığortadır və istifadəçiyə öz ölkəsini dəqiq seçmək imkanı verir.
 */
const CountryGate = ({ onDone }: {onDone: () => void;}) => {
  const { user, refreshProfile } = useAuth();
  const setStoreCountry = useUserStore((s) => s.setCountryCode);
  const { toast } = useToast();
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!selected || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase.
      from('profiles').
      update({ country_code: selected }).
      eq('user_id', user.id);
      if (error) throw error;

      setStoreCountry(selected);
      await refreshProfile?.();
      onDone();
    } catch (e: any) {
      toast({
        title: tr('countrygate_error', 'Xəta baş verdi'),
        description: e.message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="a-scope fixed inset-0 z-[450] flex flex-col items-center justify-center px-6"
      style={{
        background: 'var(--a-bg)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}>
      <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-5" style={{ background: 'var(--a-peach-1)' }}>
        <Globe2 className="w-8 h-8" style={{ color: 'var(--a-accent-ink)' }} />
      </div>

      <h1 className="text-xl font-black text-center mb-2" style={{ color: 'var(--a-ink)' }}>
        {tr('countrygate_title', 'Hansı ölkədə yaşayırsınız?')}
      </h1>
      <p className="text-sm text-center mb-6 max-w-sm" style={{ color: 'var(--a-ink-soft)' }}>
        {tr('countrygate_subtitle', 'Ölkənizə uyğun məzmun, peyvənd təqvimi və community üçün bu məlumat lazımdır. Yalnız bir dəfə soruşulur.')}
      </p>

      <div className="w-full max-w-sm mb-5">
        <CountrySelect value={selected} onChange={setSelected} />
      </div>

      <button
        onClick={handleSave}
        disabled={!selected || saving}
        className="w-full max-w-sm h-12 rounded-full font-bold text-sm text-white border-0 flex items-center justify-center gap-2"
        style={{
          background: 'var(--a-peach-2)',
          opacity: !selected || saving ? 0.5 : 1
        }}>
        {saving ?
        <Loader2 className="w-4 h-4 animate-spin" /> :
        tr('countrygate_save', 'Davam et')
        }
      </button>
    </div>);

};

export default CountryGate;
