import { useEffect, useState } from 'react';
import { Baby, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAppSettings, useUpdateAppSetting } from '@/hooks/useAppSettings';
import { tr } from '@/lib/tr';

/**
 * Kill switch for the AI replies in "Körpəmdən mesajlar" (server function baby-chat-reply).
 * Off: the app answers with curated lines only. Takes effect at once, no app release needed.
 */
const BabyChatAiSetting = () => {
  const { data: settings = [], isLoading } = useAppSettings();
  const update = useUpdateAppSetting();
  const { toast } = useToast();
  const row = settings.find((s) => s.key === 'baby_chat_ai');
  let value: { enabled?: boolean; daily_limit?: number } = {};
  try { value = typeof row?.value === 'string' ? JSON.parse(row.value) : (row?.value as typeof value) || {}; } catch { value = {}; }
  const [enabled, setEnabled] = useState(false);
  const [limit, setLimit] = useState(20);
  useEffect(() => { setEnabled(value.enabled === true); setLimit(typeof value.daily_limit === 'number' ? value.daily_limit : 20); }, [row?.value]);

  const save = async (next: { enabled: boolean; daily_limit: number }) => {
    try {
      await update.mutateAsync({ key: 'baby_chat_ai', value: next });
      toast({ title: tr('admin_baby_ai_saved', 'Körpə AI ayarı yadda saxlandı ✓') });
    } catch {
      toast({ title: tr('adminpremiumconfig_xeta_bas_verdi_f22fba', 'Xəta baş verdi'), variant: 'destructive' });
    }
  };

  if (isLoading) return <div className="p-4 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>;
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Baby className="w-5 h-5 text-primary" />
        <div className="flex-1">
          <p className="font-semibold text-sm">{tr('admin_baby_ai_title', 'Körpəmdən mesajlar — AI cavablar')}</p>
          <p className="text-xs text-muted-foreground">{tr('admin_baby_ai_desc', 'Söndürüləndə körpə yalnız hazır, yoxlanmış cavablarla danışır. Tibbi və ya narahatlıq mövzusu heç vaxt AI-a getmir.')}</p>
        </div>
        <Switch checked={enabled} onCheckedChange={(v) => { setEnabled(v); void save({ enabled: v, daily_limit: limit }); }} aria-label={tr('admin_baby_ai_title', 'Körpəmdən mesajlar — AI cavablar')} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground flex-1">{tr('admin_baby_ai_limit', 'Hər istifadəçiyə gündəlik AI cavab limiti')}</span>
        <Input type="number" min={0} max={200} value={limit} onChange={(e) => setLimit(Math.max(0, Math.min(200, Number(e.target.value) || 0)))} className="w-24 h-9" />
        <Button size="sm" variant="outline" onClick={() => save({ enabled, daily_limit: limit })} disabled={update.isPending}>
          {tr('admin_save', 'Yadda saxla')}
        </Button>
      </div>
    </div>
  );
};

export default BabyChatAiSetting;
