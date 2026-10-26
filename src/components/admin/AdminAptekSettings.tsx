import { useEffect, useState } from 'react';
import { ShoppingBag, Save, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAptekConfig } from '@/hooks/useAptek';
import { parseAptekConfig, type AptekConfig } from '@/lib/aptek-pricing';

const PLACEMENTS = ['home', 'colic', 'feed', 'weaning', 'cups', 'newborn', 'bag', 'search'] as const;

/** Admin card for app_settings.aptek_config (store switch, delivery, sets, offer placements). */
export default function AdminAptekSettings() {
  const { data } = useAptekConfig();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [cfg, setCfg] = useState<AptekConfig | null>(null);
  const [bundles, setBundles] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data && !cfg) { setCfg(data); setBundles(JSON.stringify(data.bundles, null, 1)); }
  }, [data, cfg]);

  if (!cfg) return null;

  const save = async () => {
    let parsedBundles: unknown;
    try { parsedBundles = JSON.parse(bundles || '[]'); } catch {
      toast({ title: tr('adminaptek_bad_json', 'Dəstlər JSON formatında deyil'), variant: 'destructive' });
      return;
    }
    // Stored as a jsonb object (not a JSON string) so place_aptek_order can read it directly.
    const value = parseAptekConfig({ ...cfg, bundles: parsedBundles });
    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data: existing } = await db.from('app_settings').select('id').eq('key', 'aptek_config').maybeSingle();
    const { error } = existing
      ? await db.from('app_settings').update({ value }).eq('key', 'aptek_config')
      : await db.from('app_settings').insert({ key: 'aptek_config', value });
    setSaving(false);
    if (error) { toast({ title: tr('adminsettings_xeta', 'Xəta'), description: error.message, variant: 'destructive' }); return; }
    void qc.invalidateQueries({ queryKey: ['aptek-config'] });
    toast({ title: tr('adminaptek_saved', 'Aptek ayarları yadda saxlanıldı') });
  };

  const num = (k: 'free_shipping_min' | 'shipping_fee' | 'bundle_discount_pct') => (
    <Input type="number" min={0} value={cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: Number(e.target.value) || 0 })} />
  );

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-green-500/10"><ShoppingBag className="w-5 h-5 text-green-600" /></div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">Anacan Aptek</h3>
          <p className="text-sm text-muted-foreground">{tr('adminaptek_sub', 'Mağaza, çatdırılma, dəstlər və təklif yerləri')}</p>
        </div>
        <Button size="sm" onClick={() => void save()} disabled={saving} className="gap-2">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {tr('adminaptek_save', 'Yadda saxla')}
        </Button>
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
          <div>
            <p className="text-sm font-medium">{tr('adminaptek_enabled', 'Aptek istifadəçilərə açıqdır')}</p>
            <p className="text-xs text-muted-foreground">{tr('adminaptek_enabled_sub', 'Söndürülü olanda yalnız adminlər görür')}</p>
          </div>
          <Switch checked={cfg.enabled} onCheckedChange={(enabled) => setCfg({ ...cfg, enabled })} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className="text-sm space-y-1"><span>{tr('adminaptek_free_min', 'Pulsuz çatdırılma (₼)')}</span>{num('free_shipping_min')}</label>
          <label className="text-sm space-y-1"><span>{tr('adminaptek_fee', 'Çatdırılma haqqı (₼)')}</span>{num('shipping_fee')}</label>
          <label className="text-sm space-y-1"><span>{tr('adminaptek_bundle_pct', 'Dəst endirimi (%)')}</span>{num('bundle_discount_pct')}</label>
        </div>
        <label className="text-sm space-y-1 block">
          <span>{tr('adminaptek_countries', 'Ölkələr (vergüllə, məs. AZ)')}</span>
          <Input value={cfg.countries.join(', ')} onChange={(e) => setCfg({ ...cfg, countries: e.target.value.split(',').map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c)) })} />
        </label>
        <div>
          <p className="text-sm font-medium mb-2">{tr('adminaptek_placements', 'Təklif yerləri')}</p>
          <div className="grid grid-cols-2 gap-2">
            {PLACEMENTS.map((p) => (
              <label key={p} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <span>{p}</span>
                <Switch checked={cfg.placements[p] !== false} onCheckedChange={(on) => setCfg({ ...cfg, placements: { ...cfg.placements, [p]: on } })} />
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">{tr('adminaptek_formula_note', 'Uşaq qarışığı heç bir yerdə təklif edilmir, yalnız mağazada görünür.')}</p>
        </div>
        <label className="text-sm space-y-1 block">
          <span>{tr('adminaptek_bundles', 'Dəstlər (JSON: id, skus, tone)')}</span>
          <Textarea rows={6} className="font-mono text-xs" value={bundles} onChange={(e) => setBundles(e.target.value)} />
        </label>
      </div>
    </Card>
  );
}
