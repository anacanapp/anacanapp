import { useEffect, useMemo, useState } from 'react';
import { CreditCard, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAppSettings, useUpdateAppSetting } from '@/hooks/useAppSettings';
import { parseInAppEpointSetting, type AppPlatform, type InAppEpointSetting as Setting } from '@/lib/in-app-epoint';
import { parseCountryList } from '@/lib/in-app-epoint-pricing';
import InAppEpointPricing from './InAppEpointPricing';

const PLATFORMS: Array<{ id: AppPlatform; label: string; note?: string }> = [
  { id: 'android', label: 'Android' },
  { id: 'ios', label: 'iOS', note: 'Apple 3.1.1: rəqəmsal məzmunun tətbiqdən kənar ödənişi App Store qaydalarına zidd ola bilər. Yalnız store qərarından sonra açın.' },
  { id: 'web', label: 'Veb (app.anacan.az)' },
];

/**
 * Admin › Premium səhifəsi › Epoint: app_settings.in_app_epoint, the switch for "pay with an Azerbaijani card (Epoint)"
 * in the app paywall. Saved through the regular admin settings writer (useUpdateAppSetting); the app reads it through
 * get_public_app_setting and web-premium re-checks it on the server for every in-app checkout.
 */
export default function InAppEpointSetting() {
  const { data: settings = [], isLoading } = useAppSettings();
  const update = useUpdateAppSetting();
  const stored = useMemo(() => parseInAppEpointSetting(settings.find(s => s.key === 'in_app_epoint')?.value ?? null), [settings]);
  const [draft, setDraft] = useState<Setting>(stored);
  const [countriesText, setCountriesText] = useState(stored.countries.join(', '));
  useEffect(() => { setDraft(stored); setCountriesText(stored.countries.join(', ')); }, [stored]);

  const parsed = parseCountryList(countriesText);
  const dirty = JSON.stringify({ ...draft, countries: parsed.countries }) !== JSON.stringify(stored);
  const save = async () => {
    if (parsed.invalid.length) { toast.error(`Yanlış ölkə kodu: ${parsed.invalid.join(', ')} (iki hərf, məs. AZ)`); return; }
    const value: Setting = { enabled: draft.enabled, countries: parsed.countries, platforms: draft.platforms };
    try {
      await update.mutateAsync({ key: 'in_app_epoint', value });
      toast.success('Epoint ayarı saxlanıldı');
    } catch { toast.error('Saxlamaq alınmadı'); }
  };

  return (
    <div className="space-y-4">
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><CreditCard size={18} /> Tətbiqdə Epoint kartla ödəniş</CardTitle>
        <p className="text-xs text-muted-foreground">
          Paywall-da mağaza düyməsinin altında “Azərbaycan kartı ilə ödə (Epoint)” seçimi. Qiymət anacan.az veb abunəliyinin qiymətidir
          (kampaniya və ya standart), ödəniş avtomatik yenilənir. Ölkə istifadəçinin profilindən, yoxdursa cihaz dilinin regionundan götürülür.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? <p className="text-sm text-muted-foreground">Yüklənir...</p> : <>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="iep-enabled" className="font-semibold">Aktivdir</Label>
            <Switch id="iep-enabled" checked={draft.enabled} onCheckedChange={enabled => setDraft(d => ({ ...d, enabled }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="iep-countries">Ölkələr (ISO kodları, vergüllə)</Label>
            <Input id="iep-countries" value={countriesText} onChange={e => setCountriesText(e.target.value)} placeholder="AZ, GE, TR" />
            {parsed.invalid.length > 0 && <p className="text-xs text-destructive">Yanlış kod: {parsed.invalid.join(', ')}</p>}
            <p className="text-xs text-muted-foreground">Ödəniş AZN ilə Azərbaycan kartı üzrədir; digər ölkələri yalnız lazım olduqda əlavə edin.</p>
          </div>
          <div className="space-y-2">
            <Label>Platformalar</Label>
            {PLATFORMS.map(p => (
              <div key={p.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{p.label}</span>
                  <Switch checked={draft.platforms[p.id]} aria-label={p.label}
                    onCheckedChange={on => setDraft(d => ({ ...d, platforms: { ...d.platforms, [p.id]: on } }))} />
                </div>
                {p.note && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{p.note}</p>}
              </div>
            ))}
          </div>
          <Button onClick={() => void save()} disabled={!dirty || update.isPending} className="w-full">
            <Save size={16} className="me-2" /> {update.isPending ? 'Saxlanılır...' : 'Saxla'}
          </Button>
        </>}
      </CardContent>
    </Card>
    <InAppEpointPricing />
    </div>
  );
}
