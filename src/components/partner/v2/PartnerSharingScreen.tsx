import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Smile, Thermometer, Droplets, Baby, Timer, Scale, CalendarHeart, Milk, Flower2, ShieldCheck, Unlink,
  Loader2, ChevronDown, Share2, Copy, Crown, ClipboardList, Moon, Eye, EyeOff, Bell,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { usePartnerSharing, type SharingKey } from '@/hooks/usePartnerSharing';
import { usePartnerData } from '@/hooks/usePartnerData';
import { usePartnerMessages } from '@/hooks/usePartnerMessages';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { supabase } from '@/integrations/supabase/client';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useToast } from '@/hooks/use-toast';
import { nativeShare } from '@/lib/native';
import { getPartnerCodeForSharing, getPartnerLinkErrorMessage } from '@/lib/partner-link';
import { feature37Text } from '@/lib/feature37-i18n';
import { tr } from '@/lib/tr';
import { PremiumModal } from '@/components/PremiumModal';

/**
 * Ana tərəfi — vahid "Partnyor" bölməsi: dəvət (bağlı deyilsə), partnyorun həftəsi,
 * qruplaşdırılmış paylaşım ayarları (nümunə ilə), ortaq alətlər və bağlantını kəsmək.
 */

interface Props {
  onBack: () => void;
  onNavigate?: (screen: string) => void;
}

const SWITCH_CLS = 'data-[state=checked]:bg-[var(--a-peach-2)]';
type Stage = 'flow' | 'bump' | 'mommy';
type GroupId = 'mood' | 'health' | 'cycle' | 'pregnancy' | 'appointments' | 'baby';

interface Row { key: SharingKey; icon: any; title: string; sub: string }
interface Group { id: GroupId; icon: any; bg: string; ink: string; keys: SharingKey[]; stages: Stage[] }

const GROUPS: Group[] = [
  { id: 'mood', icon: Smile, bg: 'var(--a-yellow-1)', ink: 'var(--a-yellow-ink)', keys: ['share_mood', 'share_symptoms'], stages: ['flow', 'bump', 'mommy'] },
  { id: 'cycle', icon: Flower2, bg: 'var(--a-pink-1)', ink: 'var(--a-pink-ink)', keys: ['share_cycle'], stages: ['flow'] },
  { id: 'pregnancy', icon: Timer, bg: 'var(--a-lav-1)', ink: 'var(--a-lav-ink)', keys: ['share_kicks', 'share_contractions'], stages: ['bump'] },
  { id: 'baby', icon: Milk, bg: 'var(--a-green-1)', ink: 'var(--a-green-ink)', keys: ['share_baby_logs'], stages: ['mommy'] },
  { id: 'appointments', icon: CalendarHeart, bg: 'var(--a-blue-1)', ink: 'var(--a-blue-ink)', keys: ['share_appointments'], stages: ['bump', 'mommy'] },
  { id: 'health', icon: Droplets, bg: 'var(--a-blue-1)', ink: 'var(--a-blue-ink)', keys: ['share_water', 'share_weight'], stages: ['flow', 'bump', 'mommy'] },
];

const rowsByKey = (): Record<SharingKey, Row> => ({
  share_mood: { key: 'share_mood', icon: Smile, title: tr('partnerv2_sh_ehval', 'Əhval'), sub: tr('partnerv2_sh_ehval_sub', 'Gündəlik əhval-ruhiyyəniz') },
  share_symptoms: { key: 'share_symptoms', icon: Thermometer, title: tr('partnerv2_sh_simptomlar', 'Simptomlar'), sub: tr('partnerv2_sh_simptomlar_sub', 'Qeyd etdiyiniz simptomlar') },
  share_water: { key: 'share_water', icon: Droplets, title: tr('partnerv2_sh_su', 'Su qəbulu'), sub: tr('partnerv2_sh_su_sub', 'Günlük su miqdarı və hədəf') },
  share_kicks: { key: 'share_kicks', icon: Baby, title: tr('partnerv2_sh_tepikler', 'Təpiklər'), sub: tr('partnerv2_sh_tepikler_sub', 'Təpik sayğacı bildirişləri') },
  share_contractions: { key: 'share_contractions', icon: Timer, title: tr('partnerv2_sh_sancilar', 'Sancılar'), sub: tr('partnerv2_sh_sancilar_sub', 'Sancı taymeri və 5-1-1 xəbərdarlığı') },
  share_weight: { key: 'share_weight', icon: Scale, title: tr('partnerv2_sh_ceki', 'Çəki'), sub: tr('partnerv2_sh_ceki_sub', 'Çəki qeydləriniz (standart: bağlı)') },
  share_appointments: { key: 'share_appointments', icon: CalendarHeart, title: tr('partnerv2_sh_randevular', 'Randevular'), sub: tr('partnerv2_sh_randevular_sub', 'Həkim vizitləri və xatırlatmalar') },
  share_baby_logs: { key: 'share_baby_logs', icon: Milk, title: tr('partnerv2_sh_korpe', 'Körpə qeydləri'), sub: tr('partnerv2_sh_korpe_sub', 'Yemə, yuxu və bez qeydləri') },
  share_cycle: { key: 'share_cycle', icon: Flower2, title: tr('partnerv2_sh_tsikl', 'Tsikl fazası'), sub: tr('partnerv2_sh_tsikl_sub', 'Faza və növbəti period məlumatı') },
});

const groupTitle = (id: GroupId) => feature37Text(`ph_group_${id}` as Parameters<typeof feature37Text>[0]);
const groupPreview = (id: GroupId) => feature37Text(`ph_group_${id}_preview` as Parameters<typeof feature37Text>[0]);

const card = { background: 'var(--a-surface)', borderRadius: 'var(--a-radius-md)', boxShadow: 'var(--a-card-shadow)' } as const;

const PartnerSharingScreen = ({ onBack, onNavigate }: Props) => {
  useScrollToTop();
  const { settings, updateSetting, loading, available } = usePartnerSharing();
  const { profile, user, refreshProfile } = useAuth();
  const { partnerProfile } = usePartnerData();
  const { messages } = usePartnerMessages();
  const { isPremium } = useSubscription();
  const lifeStage = useUserStore((s) => s.lifeStage);
  const { toast } = useToast();
  const [open, setOpen] = useState<GroupId | null>(null);
  const [showOthers, setShowOthers] = useState(false);
  const [showUnlink, setShowUnlink] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const [code, setCode] = useState<string>(profile?.partner_code || '');
  const [sharing, setSharing] = useState(false);

  const stage: Stage = lifeStage === 'bump' || lifeStage === 'mommy' ? lifeStage : 'flow';
  const linked = !!profile?.linked_partner_id && !!partnerProfile;
  const rows = rowsByKey();
  const mainGroups = GROUPS.filter((g) => g.stages.includes(stage));
  const otherGroups = GROUPS.filter((g) => !g.stages.includes(stage));

  const week = useMemo(() => {
    const since = Date.now() - 7 * 86400000;
    const fromPartner = (messages || []).filter((m: any) => m.receiver_id === user?.id && new Date(m.created_at).getTime() >= since);
    return {
      loves: fromPartner.filter((m: any) => m.message_type === 'love' || (m.message_type === 'text' && m.content === '❤️')).length,
      texts: fromPartner.filter((m: any) => ['text', 'image', 'audio', 'video'].includes(m.message_type) && m.content !== '❤️').length,
    };
  }, [messages, user?.id]);

  const save = async (key: SharingKey, value: boolean) => {
    const ok = await updateSetting(key, value);
    if (!ok) toast({ title: tr('partnerv2_sh_xeta', 'Yadda saxlanılmadı'), description: tr('partnerv2_sh_xeta_sub', 'Yenidən cəhd edin.'), variant: 'destructive' });
  };
  const toggleGroup = async (group: Group, value: boolean) => {
    for (const key of group.keys) if (settings[key] !== value) await save(key, value);
  };

  const freshCode = async () => {
    const next = await getPartnerCodeForSharing(code);
    setCode(next);
    void refreshProfile();
    return next;
  };
  const shareInvite = async () => {
    if (!isPremium) { setShowPremium(true); return; }
    setSharing(true);
    try {
      const next = await freshCode();
      await nativeShare({
        title: tr('profile_partnyor_kodu', 'Partnyor Kodu'),
        text: `${tr('profile_share_partner_text', 'Anacan tətbiqinə qoşul və hamiləlik səyahətimizdə mənə dəstək ol! Partnyor kodum:')} ${next}\n\n${tr('profile_download_app', 'Tətbiqi yüklə:')} ${window.location.origin}`,
      });
    } catch (error) {
      toast({ title: getPartnerLinkErrorMessage(error), variant: 'destructive' });
    } finally {
      setSharing(false);
    }
  };
  const copyInvite = async () => {
    if (!isPremium) { setShowPremium(true); return; }
    try {
      const next = await freshCode();
      await navigator.clipboard.writeText(next);
      toast({ title: feature37Text('ph_invite_copied') });
    } catch (error) {
      toast({ title: getPartnerLinkErrorMessage(error), variant: 'destructive' });
    }
  };

  const handleUnlink = async () => {
    setUnlinking(true);
    try {
      const { error } = await (supabase.rpc as any)('unlink_partners');
      if (error) throw error;
      toast({ title: tr('partnerv2_baglanti_kesildi', 'Bağlantı kəsildi'), description: tr('partnerv2_baglanti_kesildi_sub', 'Partnyor artıq məlumatlarınızı görmür.') });
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      console.error(e);
      toast({ title: tr('partnerv2_sh_xeta', 'Yadda saxlanılmadı'), variant: 'destructive' });
      setUnlinking(false);
      setShowUnlink(false);
    }
  };

  const renderGroup = (group: Group) => {
    const Icon = group.icon;
    const on = group.keys.some((k) => settings[k]);
    const all = group.keys.every((k) => settings[k]);
    const expanded = open === group.id;
    return (
      <div key={group.id} style={{ ...card, overflow: 'hidden' }}>
        <div className="flex items-center gap-3" style={{ padding: '13px 14px' }}>
          <button type="button" onClick={() => setOpen(expanded ? null : group.id)} className="flex flex-1 min-w-0 items-center gap-3 text-start" aria-expanded={expanded}>
            <span className="w-10 h-10 flex items-center justify-center shrink-0" style={{ borderRadius: 13, background: group.bg }}>
              <Icon size={17} style={{ color: group.ink }} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block" style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--a-ink)' }}>{groupTitle(group.id)}</span>
              <span className="flex items-center gap-1" style={{ fontSize: 11, color: on ? 'var(--a-ink-soft)' : 'var(--a-ink-faint)' }}>
                {on ? <Eye size={11} /> : <EyeOff size={11} />}
                <span className="truncate">{on ? groupPreview(group.id) : feature37Text('ph_preview_off')}</span>
              </span>
            </span>
            {group.keys.length > 1 && <ChevronDown size={15} style={{ color: 'var(--a-ink-faint)', transform: expanded ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />}
          </button>
          <Switch className={SWITCH_CLS} checked={all} disabled={loading || !available}
            aria-label={groupTitle(group.id)} onCheckedChange={(checked) => void toggleGroup(group, checked)} />
        </div>
        <AnimatePresence initial={false}>
          {expanded && group.keys.length > 1 &&
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} style={{ overflow: 'hidden' }}>
              <div style={{ borderTop: '1px solid var(--a-line)', padding: '4px 0' }}>
                {group.keys.map((key) => {
                  const row = rows[key];
                  const RowIcon = row.icon;
                  return (
                    <div key={key} className="flex items-center gap-3" style={{ padding: '9px 16px 9px 22px' }}>
                      <RowIcon size={15} style={{ color: 'var(--a-ink-soft)' }} className="shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--a-ink)' }}>{row.title}</p>
                        <p style={{ fontSize: 10.5, color: 'var(--a-ink-soft)' }}>{row.sub}</p>
                      </div>
                      <Switch className={SWITCH_CLS} checked={settings[key]} disabled={loading || !available}
                        aria-label={row.title} onCheckedChange={(checked) => void save(key, checked)} />
                    </div>);
                })}
              </div>
            </motion.div>}
        </AnimatePresence>
      </div>);
  };

  const tools = [
    ...(stage === 'bump' ? [{ screen: 'birth-plan', icon: ClipboardList, title: feature37Text('pm_birth_plan'), sub: feature37Text('pm_birth_plan_sub') }] : []),
    ...(stage === 'mommy' ? [{ screen: 'night-shift', icon: Moon, title: feature37Text('pm_night_shift'), sub: feature37Text('pm_night_shift_sub') }] : []),
  ];

  return (
    <div className="a-scope safe-top min-h-screen pb-24 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
      <div className="a-shell">
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.95 }} aria-label={tr('common_geri', 'Geri')}>
              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
            </motion.button>
            <div>
              <p className="a-eyebrow">{tr('partnerv2_siz_idare_edirsiniz', 'Siz idarə edirsiniz')}</p>
              <p className="a-wordmark" style={{ fontSize: 16 }}>{feature37Text('ph_title')}</p>
            </div>
          </div>
        </header>

        <div className="space-y-3.5">
          {linked ?
            <div className="a-card" style={{ padding: 16 }}>
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0" style={{ background: 'var(--a-grad-blue)' }}>👨</span>
                <div className="flex-1 min-w-0">
                  <p className="truncate" style={{ fontSize: 16, fontWeight: 900, color: 'var(--a-ink)' }}>{partnerProfile?.name || tr('common_partnyor', 'Partnyor')}</p>
                  <span className="inline-flex items-center gap-1" style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--a-green-ink)', background: 'var(--a-green-1)', borderRadius: 999, padding: '2px 8px' }}>
                    ● {feature37Text('ph_linked')}
                  </span>
                </div>
              </div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--a-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '14px 0 6px' }}>{feature37Text('ph_week')}</p>
              <div className="grid grid-cols-2 gap-2">
                {[{ emoji: '❤️', value: week.loves, label: feature37Text('ph_loves') }, { emoji: '💬', value: week.texts, label: feature37Text('ph_messages') }].map((s) =>
                  <div key={s.label} className="flex items-center gap-2" style={{ background: 'var(--a-surface-soft)', borderRadius: 14, padding: '9px 12px' }}>
                    <span style={{ fontSize: 18 }}>{s.emoji}</span>
                    <span style={{ fontSize: 17, fontWeight: 900, color: 'var(--a-ink)' }}>{s.value}</span>
                    <span style={{ fontSize: 11, color: 'var(--a-ink-soft)' }}>{s.label}</span>
                  </div>)}
              </div>
            </div> :
            <div className="a-card" style={{ padding: 18 }}>
              <p style={{ fontSize: 16, fontWeight: 900, color: 'var(--a-ink)' }}>{feature37Text('ph_invite_title')}</p>
              <p style={{ fontSize: 12.5, color: 'var(--a-body-text)', margin: '4px 0 12px', lineHeight: 1.5 }}>{feature37Text('ph_invite_body')}</p>
              {isPremium ?
                <>
                  <code className="block text-center font-mono font-bold tracking-wider" style={{ fontSize: 18, color: 'var(--a-ink)', background: 'var(--a-surface-soft)', borderRadius: 14, padding: 12 }}>
                    {code || 'ANACAN-······'}
                  </code>
                  <div className="flex gap-2" style={{ marginTop: 10 }}>
                    <button type="button" onClick={copyInvite} className="a-btn-soft flex-1 inline-flex items-center justify-center gap-1.5"><Copy size={15} />{feature37Text('ph_invite_copy')}</button>
                    <button type="button" onClick={shareInvite} disabled={sharing} className="a-btn-solid flex-1 inline-flex items-center justify-center gap-1.5">
                      {sharing ? <Loader2 size={15} className="animate-spin" /> : <Share2 size={15} />}{feature37Text('ph_invite_share')}
                    </button>
                  </div>
                </> :
                <button type="button" onClick={() => setShowPremium(true)} className="w-full inline-flex items-center justify-center gap-2"
                  style={{ borderRadius: 16, background: 'var(--a-grad-yellow)', color: 'var(--a-warn-ink)', fontWeight: 800, fontSize: 13, padding: 14 }}>
                  <Crown size={15} />{feature37Text('ph_invite_premium')}
                </button>}
            </div>}

          {linked && tools.length > 0 && onNavigate &&
            <div className="grid gap-2.5">
              {tools.map(({ screen, icon: Icon, title, sub }) =>
                <motion.button key={screen} type="button" onClick={() => onNavigate(screen)} className="flex items-center gap-3 text-start" style={{ ...card, padding: 13 }} whileTap={{ scale: 0.98 }}>
                  <span className="w-10 h-10 flex items-center justify-center shrink-0" style={{ borderRadius: 13, background: 'var(--a-lav-1)' }}><Icon size={17} style={{ color: 'var(--a-lav-ink)' }} /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block" style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--a-ink)' }}>{title}</span>
                    <span className="block truncate" style={{ fontSize: 11, color: 'var(--a-ink-soft)' }}>{sub}</span>
                  </span>
                </motion.button>)}
            </div>}

          <div style={{ padding: '6px 4px 0' }}>
            <p style={{ fontSize: 15, fontWeight: 900, color: 'var(--a-ink)' }}>{feature37Text('ph_what_sees')}</p>
            <p style={{ fontSize: 11.5, color: 'var(--a-ink-soft)', marginTop: 2 }}>{feature37Text('ph_sees_sub')}</p>
          </div>

          {!available &&
            <div style={{ background: 'var(--a-yellow-1)', borderRadius: 14, padding: '10px 13px' }}>
              <p style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--a-warn-ink)' }}>
                {tr('partnerv2_sh_migration_yox', 'Ayarlar bazası hazır deyil — hazırda standart paylaşım aktivdir.')}
              </p>
            </div>}

          <div className="space-y-2.5">{mainGroups.map(renderGroup)}</div>

          <button type="button" onClick={() => setShowOthers(!showOthers)} className="w-full flex items-center justify-center gap-1" style={{ fontSize: 12, fontWeight: 700, color: 'var(--a-ink-soft)', padding: 6 }} aria-expanded={showOthers}>
            {feature37Text('ph_more_groups')} <ChevronDown size={14} style={{ transform: showOthers ? 'rotate(180deg)' : undefined }} />
          </button>
          {showOthers && <div className="space-y-2.5">{otherGroups.map(renderGroup)}</div>}

          {onNavigate &&
            <button type="button" onClick={() => onNavigate('partner-notifications')} className="w-full flex items-center gap-3 text-start" style={{ ...card, padding: 13 }}>
              <span className="w-10 h-10 flex items-center justify-center shrink-0" style={{ borderRadius: 13, background: 'var(--a-blue-1)' }}><Bell size={17} style={{ color: 'var(--a-blue-ink)' }} /></span>
              <span className="flex-1" style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--a-ink)' }}>{feature37Text('pn_title')}</span>
              <ChevronDown size={15} className="-rotate-90 rtl:rotate-90" style={{ color: 'var(--a-ink-faint)' }} />
            </button>}

          <div className="flex items-start gap-2.5" style={{ background: 'var(--a-disclaimer-bg)', border: '1px solid var(--a-disclaimer-border)', borderRadius: 16, padding: 13 }}>
            <ShieldCheck size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--a-disclaimer-strong)' }} />
            <p style={{ fontSize: 11.5, color: 'var(--a-disclaimer-ink)', lineHeight: 1.5 }}>{feature37Text('ph_never')}</p>
          </div>

          {linked &&
            <motion.button onClick={() => setShowUnlink(true)} className="w-full flex items-center gap-4 text-start"
              style={{ padding: 14, borderRadius: 16, background: 'var(--a-alert-bg)' }} whileTap={{ scale: 0.98 }}>
              <div className="w-10 h-10 flex items-center justify-center shrink-0" style={{ borderRadius: 13, background: 'var(--a-chip-overlay)' }}>
                <Unlink size={17} style={{ color: 'var(--a-alert-ink)' }} />
              </div>
              <div className="flex-1">
                <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--a-alert-ink)' }}>{tr('partnerv2_baglantini_kes', 'Bağlantını kəs')}</p>
                <p style={{ fontSize: 11, color: 'var(--a-alert-soft)' }}>{tr('partnerv2_baglantini_kes_sub', 'Partnyor bütün girişini itirəcək')}</p>
              </div>
            </motion.button>}
        </div>
      </div>

      <Dialog open={showUnlink} onOpenChange={setShowUnlink}>
        <DialogContent className="a-scope rounded-[22px]">
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--a-alert-ink)' }}>{tr('partnerv2_baglantini_kes', 'Bağlantını kəs')}?</DialogTitle>
            <DialogDescription>
              {tr('partnerv2_unlink_tesdiq_izah', 'Partnyorunuz artıq heç bir məlumatınızı görməyəcək və partnyor paneli bağlanacaq. Yenidən bağlanmaq üçün kodu təkrar paylaşmalısınız.')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowUnlink(false)} className="flex-1 rounded-full">{tr('common_legv_et', 'Ləğv et')}</Button>
            <Button variant="destructive" onClick={handleUnlink} disabled={unlinking} className="flex-1 rounded-full">
              {unlinking ? <Loader2 className="w-4 h-4 animate-spin" /> : tr('partnerv2_beli_kes', 'Bəli, kəs')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <PremiumModal isOpen={showPremium} onClose={() => setShowPremium(false)} />
    </div>);
};

export default PartnerSharingScreen;
