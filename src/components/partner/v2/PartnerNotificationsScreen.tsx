import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, MessageCircle, HandHeart, ShoppingCart, Timer, Siren, Info } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useToast } from '@/hooks/use-toast';
import { feature37Text } from '@/lib/feature37-i18n';
import { tr } from '@/lib/tr';

/**
 * Partner push choices (both roles). The push service skips a disabled type through
 * claim_communication_notification_v2 (Duzelis70); SOS and birth alerts cannot be turned off.
 */
type PrefKey = 'push_messages' | 'push_partner_thanks' | 'push_partner_shopping' | 'push_partner_contractions';
type Key = Parameters<typeof feature37Text>[0];

const ROWS: { key: PrefKey; icon: any; title: Key; sub: Key; tint: [string, string] }[] = [
  { key: 'push_messages', icon: MessageCircle, title: 'pn_messages', sub: 'pn_messages_sub', tint: ['var(--a-blue-1)', 'var(--a-blue-ink)'] },
  { key: 'push_partner_thanks', icon: HandHeart, title: 'pn_thanks', sub: 'pn_thanks_sub', tint: ['var(--a-pink-1)', 'var(--a-pink-ink)'] },
  { key: 'push_partner_shopping', icon: ShoppingCart, title: 'pn_shopping', sub: 'pn_shopping_sub', tint: ['var(--a-green-1)', 'var(--a-green-ink)'] },
  { key: 'push_partner_contractions', icon: Timer, title: 'pn_contractions', sub: 'pn_contractions_sub', tint: ['var(--a-lav-1)', 'var(--a-lav-ink)'] },
];
const DEFAULTS: Record<PrefKey, boolean> = { push_messages: true, push_partner_thanks: true, push_partner_shopping: true, push_partner_contractions: true };
const SWITCH_CLS = 'data-[state=checked]:bg-[var(--a-peach-2)]';

const PartnerNotificationsScreen = ({ onBack }: { onBack: () => void }) => {
  useScrollToTop();
  const { user } = useAuth();
  const { toast } = useToast();
  const [prefs, setPrefs] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void (async () => {
      const { data } = await (supabase as any).from('user_preferences')
        .select('push_messages, push_partner_thanks, push_partner_shopping, push_partner_contractions')
        .eq('user_id', user.id).maybeSingle();
      if (!alive) return;
      if (data) setPrefs((current) => {
        const next = { ...current };
        for (const row of ROWS) if (typeof data[row.key] === 'boolean') next[row.key] = data[row.key];
        return next;
      });
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user]);

  const save = async (key: PrefKey, value: boolean) => {
    if (!user) return;
    setPrefs((current) => ({ ...current, [key]: value }));
    const { error } = await (supabase as any).from('user_preferences')
      .upsert({ user_id: user.id, [key]: value }, { onConflict: 'user_id' });
    if (error) {
      setPrefs((current) => ({ ...current, [key]: !value }));
      toast({ title: tr('partnerv2_sh_xeta', 'Yadda saxlanılmadı'), description: tr('partnerv2_sh_xeta_sub', 'Yenidən cəhd edin.'), variant: 'destructive' });
    }
  };

  const row = (icon: any, tint: [string, string], title: string, sub: string, control: React.ReactNode, key: string, first: boolean) => {
    const Icon = icon;
    return (
      <div key={key} className="flex items-center gap-3" style={{ padding: '12px 16px', borderTop: first ? undefined : '1px solid var(--a-line)' }}>
        <span className="w-9 h-9 flex items-center justify-center shrink-0" style={{ borderRadius: 12, background: tint[0] }}><Icon size={16} style={{ color: tint[1] }} /></span>
        <div className="flex-1 min-w-0">
          <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--a-ink)' }}>{title}</p>
          <p style={{ fontSize: 11, color: 'var(--a-ink-soft)' }}>{sub}</p>
        </div>
        {control}
      </div>);
  };

  return (
    <div className="a-scope safe-top min-h-screen pb-24 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
      <div className="a-shell">
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.95 }} aria-label={tr('common_geri', 'Geri')}>
              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
            </motion.button>
            <div>
              <p className="a-eyebrow">{feature37Text('pp_settings')}</p>
              <p className="a-wordmark" style={{ fontSize: 16 }}>{feature37Text('pn_title')}</p>
            </div>
          </div>
        </header>
        <p style={{ fontSize: 12.5, color: 'var(--a-ink-soft)', margin: '0 4px 12px' }}>{feature37Text('pn_sub')}</p>
        <div style={{ background: 'var(--a-surface)', borderRadius: 'var(--a-radius-md)', boxShadow: 'var(--a-card-shadow)', overflow: 'hidden' }}>
          {ROWS.map((r, i) => row(r.icon, r.tint, feature37Text(r.title), feature37Text(r.sub),
            <Switch className={SWITCH_CLS} checked={prefs[r.key]} disabled={loading} aria-label={feature37Text(r.title)} onCheckedChange={(v) => void save(r.key, v)} />, r.key, i === 0))}
          {row(Siren, ['var(--a-alert-bg)', 'var(--a-alert-ink)'], feature37Text('pn_sos'), feature37Text('pn_sos_sub'),
            <Switch className={SWITCH_CLS} checked disabled aria-label={feature37Text('pn_sos')} />, 'sos', false)}
        </div>
        <p className="flex items-start gap-2" style={{ fontSize: 11.5, color: 'var(--a-ink-soft)', margin: '12px 4px 0', lineHeight: 1.5 }}>
          <Info size={13} className="shrink-0 mt-0.5" />{feature37Text('pn_inbox_note')}
        </p>
      </div>
    </div>);
};

export default PartnerNotificationsScreen;
