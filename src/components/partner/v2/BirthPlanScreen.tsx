import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ClipboardList, Loader2, Check } from 'lucide-react';
import { BirthPlanChangedError, useBirthPlan, type BirthPlan } from '@/hooks/usePartnerFamily';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useToast } from '@/hooks/use-toast';
import { useUserStore } from '@/store/userStore';
import { feature37Text } from '@/lib/feature37-i18n';
import { tr } from '@/lib/tr';

/** Doğuş planı — the mother's wishes, shared with (and editable by) her linked partner. */
type Key = Parameters<typeof feature37Text>[0];
type ListField = 'companions' | 'environment' | 'after' | 'cesarean';

const LISTS: { field: ListField; title: Key; options: [string, Key][] }[] = [
  { field: 'companions', title: 'bp_companions', options: [['partner', 'bp_c_partner'], ['mother', 'bp_c_mother'], ['doula', 'bp_c_doula'], ['none', 'bp_c_none']] },
  { field: 'environment', title: 'bp_env', options: [['dim', 'bp_e_dim'], ['music', 'bp_e_music'], ['own_clothes', 'bp_e_own_clothes'], ['quiet', 'bp_e_quiet'], ['photos', 'bp_e_photos'], ['move', 'bp_e_move']] },
  { field: 'after', title: 'bp_after', options: [['skin', 'bp_a_skin'], ['cord', 'bp_a_cord'], ['partner_cord', 'bp_a_partner_cord'], ['breastfeed', 'bp_a_breastfeed'], ['rooming', 'bp_a_rooming']] },
  { field: 'cesarean', title: 'bp_cesarean', options: [['partner', 'bp_cs_partner'], ['skin', 'bp_cs_skin'], ['explain', 'bp_cs_explain']] },
];
const PAIN: [string, Key][] = [['natural', 'bp_p_natural'], ['epidural', 'bp_p_epidural'], ['open', 'bp_p_open']];

const Chip = ({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) => (
  <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={onClick} aria-pressed={on}
    className="inline-flex items-center gap-1"
    style={{ padding: '7px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 700,
      background: on ? 'var(--a-lav-ink)' : 'var(--a-surface-soft)', color: on ? 'var(--a-surface)' : 'var(--a-ink)' }}>
    {on && <Check size={13} />}{label}
  </motion.button>
);

const BirthPlanScreen = ({ onBack }: { onBack: () => void }) => {
  useScrollToTop();
  const { state, loading, error, save } = useBirthPlan();
  const language = useUserStore((s) => s.language) || 'az';
  const { toast } = useToast();
  const [plan, setPlan] = useState<BirthPlan>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (state && !dirty) setPlan(state.plan || {});
  }, [state, dirty]);

  const update = (next: BirthPlan) => { setPlan(next); setDirty(true); };
  const toggle = (field: ListField, value: string) => {
    const current = plan[field] || [];
    let next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    if (field === 'companions') next = value === 'none' ? (current.includes('none') ? [] : ['none']) : next.filter((v) => v !== 'none');
    update({ ...plan, [field]: next });
  };

  const onSave = () => save.mutate(plan, {
    onSuccess: () => { setDirty(false); toast({ title: feature37Text('bp_saved') }); },
    onError: (e) => {
      if (e instanceof BirthPlanChangedError) { setDirty(false); toast({ title: feature37Text('bp_changed'), variant: 'destructive' }); }
      else toast({ title: feature37Text('bp_error'), variant: 'destructive' });
    },
  });

  const noFamily = !!error && String((error as any)?.message || '').includes('BIRTH_PLAN_NO_FAMILY');
  const card = { background: 'var(--a-surface)', borderRadius: 'var(--a-radius-md)', boxShadow: 'var(--a-card-shadow)', padding: 16 } as const;
  const h = { fontSize: 13.5, fontWeight: 900, color: 'var(--a-ink)', marginBottom: 9 } as const;
  const updated = state?.updated_at ? new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(state.updated_at)) : null;

  return (
    <div className="a-scope safe-top min-h-screen pb-32 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
      <div className="a-shell">
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.95 }} aria-label={tr('common_geri', 'Geri')}>
              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
            </motion.button>
            <div>
              <p className="a-eyebrow">{feature37Text('pm_birth_plan_sub')}</p>
              <p className="a-wordmark" style={{ fontSize: 16 }}>{feature37Text('pm_birth_plan')}</p>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: 'var(--a-ink-faint)' }} /></div>
        ) : error || !state ? (
          <div className="a-card text-center" style={{ padding: 22 }}>
            <p style={{ fontSize: 13.5, color: 'var(--a-body-text)' }}>{noFamily ? feature37Text('family_no_link') : feature37Text('family_error')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-2.5" style={{ background: 'var(--a-lav-1)', borderRadius: 16, padding: 13 }}>
              <ClipboardList size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--a-lav-ink)' }} />
              <div>
                <p style={{ fontSize: 12.5, color: 'var(--a-lav-ink)', lineHeight: 1.5, fontWeight: 600 }}>
                  {state.is_mother ? feature37Text('bp_intro_mother') : feature37Text('bp_intro_partner')}
                </p>
                {updated && <p style={{ fontSize: 10.5, color: 'var(--a-lav-ink)', opacity: 0.8, marginTop: 3 }}>{feature37Text('bp_updated').replace('{date}', updated)}</p>}
              </div>
            </div>

            <section style={card}>
              <label style={{ ...h, display: 'block' }} htmlFor="bp-place">{feature37Text('bp_place')}</label>
              <input id="bp-place" className="a-input" style={{ width: '100%' }} maxLength={160} value={plan.place || ''}
                placeholder={feature37Text('bp_place_ph')} onChange={(e) => update({ ...plan, place: e.target.value })} />
              <label style={{ ...h, display: 'block', marginTop: 14 }} htmlFor="bp-doctor">{feature37Text('bp_doctor')}</label>
              <input id="bp-doctor" className="a-input" style={{ width: '100%' }} maxLength={160} value={plan.doctor || ''}
                onChange={(e) => update({ ...plan, doctor: e.target.value })} />
            </section>

            <section style={card}>
              <p style={h}>{feature37Text('bp_pain')}</p>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={feature37Text('bp_pain')}>
                {PAIN.map(([value, label]) =>
                  <Chip key={value} on={plan.pain === value} label={feature37Text(label)} onClick={() => update({ ...plan, pain: plan.pain === value ? undefined : value })} />)}
              </div>
            </section>

            {LISTS.map(({ field, title, options }) =>
              <section key={field} style={card}>
                <p style={h}>{feature37Text(title)}</p>
                <div className="flex flex-wrap gap-1.5">
                  {options.map(([value, label]) =>
                    <Chip key={value} on={(plan[field] || []).includes(value)} label={feature37Text(label)} onClick={() => toggle(field, value)} />)}
                </div>
              </section>)}

            <section style={card}>
              <label style={{ ...h, display: 'block' }} htmlFor="bp-notes">{feature37Text('bp_notes')}</label>
              <textarea id="bp-notes" className="a-input" rows={4} maxLength={2000} value={plan.notes || ''}
                placeholder={feature37Text('bp_notes_ph')} onChange={(e) => update({ ...plan, notes: e.target.value })}
                style={{ width: '100%', height: 'auto', minHeight: 96, padding: 12, resize: 'vertical' }} />
            </section>
          </div>
        )}
      </div>

      {dirty &&
        <div className="fixed inset-x-0 z-20 flex justify-center px-4" style={{ bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>
          <button type="button" onClick={onSave} disabled={save.isPending} className="a-btn-solid inline-flex items-center justify-center gap-2"
            style={{ width: '100%', maxWidth: 420, boxShadow: '0 16px 32px -12px rgba(217, 108, 74, 0.6)' }}>
            {save.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}{feature37Text('bp_save')}
          </button>
        </div>}
    </div>);
};

export default BirthPlanScreen;
