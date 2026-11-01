import { useEffect, useState } from 'react';
import { Star, Save, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { DISABLED_CONFIG, parseReviewConfig, type ReviewConfig } from '@/lib/review-prompt';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- app_settings rows are untyped jsonb
const db = supabase as any;

/** Admin card for app_settings.review_prompts — the native store review switch (Duzelis76). */
export default function AdminReviewPrompts() {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<ReviewConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void db.from('app_settings').select('value').eq('key', 'review_prompts').maybeSingle()
      .then(({ data }: { data: { value: unknown } | null }) => setCfg(data ? parseReviewConfig(data.value) : DISABLED_CONFIG));
  }, []);
  if (!cfg) return null;

  const save = async () => {
    setSaving(true);
    const value = { enabled: cfg.enabled, min_build_ios: cfg.min_build_ios, min_build_android: cfg.min_build_android, cooldown_days: cfg.cooldown_days };
    const { data: existing } = await db.from('app_settings').select('id').eq('key', 'review_prompts').maybeSingle();
    const { error } = existing
      ? await db.from('app_settings').update({ value }).eq('key', 'review_prompts')
      : await db.from('app_settings').insert({ key: 'review_prompts', value });
    setSaving(false);
    toast(error ? { title: 'Xəta', description: error.message, variant: 'destructive' } : { title: 'Rəy sorğusu ayarları yadda saxlanıldı' });
  };
  const build = (k: 'min_build_ios' | 'min_build_android') =>
    <Input type="number" min={0} placeholder="—" value={cfg[k] ?? ''} onChange={(e) => setCfg({ ...cfg, [k]: e.target.value === '' ? null : Number(e.target.value) })} />;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-yellow-500/10"><Star className="w-5 h-5 text-yellow-600" /></div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">App Store / Play rəy sorğusu</h3>
          <p className="text-sm text-muted-foreground">Milestone, yeni hamiləlik həftəsi və 7-ci gündən sonra — yalnız rəsmi OS pəncərəsi</p>
        </div>
        <Button size="sm" onClick={() => void save()} disabled={saving} className="gap-2">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Yadda saxla
        </Button>
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
          <div>
            <p className="text-sm font-medium">Rəy sorğusu aktivdir</p>
            <p className="text-xs text-muted-foreground">Crash düzəlişi yayımlanana qədər SÖNDÜRÜLÜ saxlayın</p>
          </div>
          <Switch checked={cfg.enabled} onCheckedChange={(enabled) => setCfg({ ...cfg, enabled })} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className="text-sm space-y-1"><span>Min. iOS build</span>{build('min_build_ios')}</label>
          <label className="text-sm space-y-1"><span>Min. Android build</span>{build('min_build_android')}</label>
          <label className="text-sm space-y-1"><span>Fasilə (gün)</span>
            <Input type="number" min={14} value={cfg.cooldown_days} onChange={(e) => setCfg({ ...cfg, cooldown_days: Math.max(14, Number(e.target.value) || 60) })} /></label>
        </div>
        <p className="text-xs text-muted-foreground">Crash olmuş build-lərdə soruşulmasın deyə min. build-i düzəlişli build nömrəsinə qoyun. Cihazda son 7 gündə crash olubsa, sorğu avtomatik dayanır.</p>
      </div>
    </Card>);
}
