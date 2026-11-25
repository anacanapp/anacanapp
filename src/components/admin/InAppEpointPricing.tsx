import { useEffect, useMemo, useState } from 'react';
import { DollarSign, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAppSettings, useUpdateAppSetting } from '@/hooks/useAppSettings';
import {
  effectiveRate, parsePricing, resolveUsdPrices, serializePricing, usdToAzn, validatePricing, type InAppEpointPricing, type Rounding,
} from '@/lib/in-app-epoint-pricing';

const toText = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));
const toNum = (text: string): number | null => {
  const t = text.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};
const azn = (v: number | null) => (v === null ? '—' : `${v.toFixed(2)} ₼`);

/**
 * Admin › Premium səhifəsi › Epoint: USD prices of the in-app Epoint offer (app_settings.in_app_epoint_pricing, admin-only,
 * not public). The server converts them to AZN at the CBAR rate (app_settings.fx_usd_azn, refreshed daily by
 * web-premium) or this fallback rate, and locks the AZN price into each new subscription. The preview below mirrors the
 * server formula (web_premium_app_offer_v1).
 */
export default function InAppEpointPricing() {
  const { data: settings = [], isLoading } = useAppSettings();
  const update = useUpdateAppSetting();
  const raw = settings.find(s => s.key === 'in_app_epoint_pricing')?.value ?? null;
  const fxRaw = settings.find(s => s.key === 'fx_usd_azn')?.value ?? null;
  const stored = useMemo(() => parsePricing(raw), [raw]);
  const [draft, setDraft] = useState<InAppEpointPricing>(stored);
  const [newCountry, setNewCountry] = useState('');
  useEffect(() => { setDraft(stored); }, [stored]);

  const numbersOk = [draft.default.monthly, draft.default.yearly, draft.fallbackRate, ...Object.values(draft.countries).flatMap(o => [o.monthly, o.yearly])]
    .every(v => v === undefined || v === null || Number.isFinite(v));
  const problem = numbersOk ? validatePricing(draft) : 'Rəqəm düzgün deyil.';
  const dirty = JSON.stringify(serializePricing(draft)) !== JSON.stringify(serializePricing(stored));
  const rate = effectiveRate(fxRaw, draft);

  const setDefault = (plan: 'monthly' | 'yearly', text: string) => setDraft(d => ({ ...d, default: { ...d.default, [plan]: toNum(text) } }));
  const setCountry = (cc: string, plan: 'monthly' | 'yearly', text: string) => setDraft(d => {
    const entry = { ...d.countries[cc] };
    const value = toNum(text);
    if (value === null) delete entry[plan]; else entry[plan] = value;
    return { ...d, countries: { ...d.countries, [cc]: entry } };
  });
  const addCountry = () => {
    const cc = newCountry.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(cc)) { toast.error('Ölkə kodu iki hərf olmalıdır (məs. AZ)'); return; }
    if (draft.countries[cc]) { toast.error(`${cc} artıq var`); return; }
    setDraft(d => ({ ...d, countries: { ...d.countries, [cc]: {} } }));
    setNewCountry('');
  };
  const removeCountry = (cc: string) => setDraft(d => { const next = { ...d.countries }; delete next[cc]; return { ...d, countries: next }; });
  const save = async () => {
    if (problem) { toast.error(problem); return; }
    try {
      await update.mutateAsync({ key: 'in_app_epoint_pricing', value: serializePricing(draft) });
      toast.success('Qiymətlər saxlanıldı. Yeni abunəliklər yeni qiymətlə başlayır; mövcud abunəliklərin qiyməti dəyişmir.');
    } catch { toast.error('Saxlamaq alınmadı'); }
  };

  const previewRows = [{ cc: null as string | null, label: 'Default' }, ...Object.keys(draft.countries).sort().map(cc => ({ cc, label: cc }))];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><DollarSign size={18} /> Epoint qiymətləri (USD)</CardTitle>
        <p className="text-xs text-muted-foreground">
          Qiymətlər USD ilə yazılır, ödəniş AZN ilə alınır: server Azərbaycan Mərkəzi Bankının gündəlik məzənnəsi ilə çevirir (gündə bir dəfə yenilənir;
          alınmasa son məzənnə, o da yoxdursa aşağıdakı ehtiyat məzənnə). Qiymət abunə anında kilidlənir; dəyişiklik yalnız yeni abunəliklərə aiddir.
          anacan.az kampaniya / Mərcan səhifələrinin qiymətləri ayrıdır və dəyişmir.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? <p className="text-sm text-muted-foreground">Yüklənir...</p> : <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="iep-usd-m">Default aylıq (USD)</Label>
              <Input id="iep-usd-m" inputMode="decimal" value={toText(draft.default.monthly)} onChange={e => setDefault('monthly', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="iep-usd-y">Default illik (USD)</Label>
              <Input id="iep-usd-y" inputMode="decimal" value={toText(draft.default.yearly)} onChange={e => setDefault('yearly', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="iep-fallback">Ehtiyat məzənnə (1 USD = ? AZN)</Label>
              <Input id="iep-fallback" inputMode="decimal" value={toText(draft.fallbackRate)} onChange={e => setDraft(d => ({ ...d, fallbackRate: toNum(e.target.value) }))} /></div>
            <div className="space-y-1.5"><Label>Yuvarlaqlaşdırma</Label>
              <Select value={draft.rounding} onValueChange={v => setDraft(d => ({ ...d, rounding: v as Rounding }))}>
                <SelectTrigger aria-label="Yuvarlaqlaşdırma"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="x99">Ən yaxın ,99 (6,78 → 6,99)</SelectItem>
                  <SelectItem value="cents">Qəpiyə qədər (6,78)</SelectItem>
                </SelectContent>
              </Select></div>
          </div>

          <div className="space-y-2">
            <Label>Ölkə üzrə qiymətlər (USD; boş xana default qiyməti götürür)</Label>
            <Table>
              <TableHeader><TableRow><TableHead>Ölkə</TableHead><TableHead>Aylıq</TableHead><TableHead>İllik</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {Object.keys(draft.countries).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground">İstisna yoxdur</TableCell></TableRow>}
                {Object.keys(draft.countries).sort().map(cc => (
                  <TableRow key={cc}>
                    <TableCell className="font-mono">{cc}</TableCell>
                    <TableCell><Input className="h-8" inputMode="decimal" aria-label={`${cc} aylıq`} placeholder={toText(draft.default.monthly)}
                      value={toText(draft.countries[cc].monthly)} onChange={e => setCountry(cc, 'monthly', e.target.value)} /></TableCell>
                    <TableCell><Input className="h-8" inputMode="decimal" aria-label={`${cc} illik`} placeholder={toText(draft.default.yearly)}
                      value={toText(draft.countries[cc].yearly)} onChange={e => setCountry(cc, 'yearly', e.target.value)} /></TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={() => removeCountry(cc)} aria-label={`${cc} sil`}><Trash2 size={14} /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex gap-2">
              <Input className="h-8 w-24" placeholder="AZ" maxLength={2} value={newCountry} onChange={e => setNewCountry(e.target.value)} aria-label="Yeni ölkə kodu" />
              <Button size="sm" variant="outline" onClick={addCountry}><Plus size={14} className="me-1" /> Ölkə əlavə et</Button>
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-sm font-semibold">Önizləmə (AZN)</p>
            <p className="text-xs text-muted-foreground">
              {rate ? `Məzənnə: 1 USD = ${rate.rate} AZN · ${rate.source === 'cbar' ? `AMB, ${rate.date ?? '—'}` : 'ehtiyat məzənnə (AMB məzənnəsi hələ alınmayıb)'}`
                : 'Məzənnə yoxdur: AMB məzənnəsi alınmayıb və ehtiyat məzənnə yazılmayıb, tətbiqdə Epoint seçimi görünməyəcək.'}
            </p>
            <Table>
              <TableHeader><TableRow><TableHead>Ölkə</TableHead><TableHead>Aylıq</TableHead><TableHead>İllik</TableHead></TableRow></TableHeader>
              <TableBody>
                {previewRows.map(({ cc, label }) => {
                  const usd = resolveUsdPrices(draft, cc);
                  const cell = (v: number | null) => `${azn(usdToAzn(v, rate?.rate ?? null, draft.rounding))} (≈ $${v ?? '—'})`;
                  return <TableRow key={label}><TableCell className="font-mono">{label}</TableCell><TableCell>{cell(usd.monthly)}</TableCell><TableCell>{cell(usd.yearly)}</TableCell></TableRow>;
                })}
              </TableBody>
            </Table>
          </div>

          {problem && <p className="text-xs text-destructive">{problem}</p>}
          <Button onClick={() => void save()} disabled={!dirty || !!problem || update.isPending} className="w-full">
            <Save size={16} className="me-2" /> {update.isPending ? 'Saxlanılır...' : 'Qiymətləri saxla'}
          </Button>
        </>}
      </CardContent>
    </Card>
  );
}
