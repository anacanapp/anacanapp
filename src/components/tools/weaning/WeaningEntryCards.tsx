import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useChildren } from '@/hooks/useChildren';
import { useAppSetting } from '@/hooks/useAppSettings';
import { useUserStore } from '@/store/userStore';
import { supabase } from '@/integrations/supabase/client';
import { PUSH_NAV_EVENT, type PushNavIntent } from '@/lib/pushNav';
import { readLocal, writeLocal, type WeaningLocal } from '@/lib/weaning-sync';
import { feedingLinkVisible, feedsFromLogs, homeCardState, readHomeDismissed, weaningOfferable, writeHomeDismissed, type FeedLog } from '@/lib/weaning-entry';
import { stepLabel, wf, wt } from '@/lib/weaning-copy';

/** Opens the weaning tool from any screen (Index switches to Tools and opens it). */
export function openWeaningTool() {
  window.dispatchEvent(new CustomEvent<PushNavIntent>(PUSH_NAV_EVENT, { detail: { tool: 'weaning' } }));
}

/** Shared inputs: account, module, admin switch, selected child and the tool's device state. */
function useWeaningEntryInputs() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const lifeStage = useUserStore((s) => s.lifeStage);
  const setting = useAppSetting('weaning_tool');
  const { selectedChild, children } = useChildren();
  const child = selectedChild ?? children[0] ?? null;
  const [local, setLocal] = useState<WeaningLocal>(() => readLocal(uid));
  const reload = useCallback(() => setLocal(readLocal(uid)), [uid]);
  useEffect(() => {
    reload();
    // The tool writes its state to this phone; refresh when the user comes back to this screen.
    window.addEventListener('focus', reload);
    document.addEventListener('visibilitychange', reload);
    return () => { window.removeEventListener('focus', reload); document.removeEventListener('visibilitychange', reload); };
  }, [reload]);
  const base = { lifeStage, birthDate: child?.birth_date ?? null, setting, plan: local.plan, continueBF: local.continueBF };
  return { uid, child, local, setLocal, base };
}

/** Ana home: a one-time, dismissible card at 12+ months, or the running plan's progress. */
export function WeaningHomeCard() {
  const { uid, child, local, setLocal, base } = useWeaningEntryInputs();
  const [dismissed, setDismissed] = useState(() => readHomeDismissed(uid, child?.id));
  useEffect(() => { setDismissed(readHomeDismissed(uid, child?.id)); }, [uid, child?.id]);
  const state = homeCardState({ ...base, dismissed });
  if (state.kind === 'hidden') return null;

  if (state.kind === 'active') {
    const sub = state.paused ? wt('weaning_home_active_paused') : state.step ? wf('weaning_home_active_step', { step: stepLabel(state.step) }) : wt('weaning_home_active_done');
    return (
      <section className="a-section" data-testid="weaning-home-active">
        <motion.button type="button" className="cx-card cx-row" whileTap={{ scale: .98 }} onClick={openWeaningTool}
        style={{ width: '100%', textAlign: 'start', cursor: 'pointer', background: 'var(--a-surface)' }}>
          <span className="cx-icon" style={{ background: 'var(--a-peach-1)', fontSize: 22 }}>🌱</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <b style={{ display: 'block', fontSize: 14.5, color: 'var(--a-ink)' }}>{wf('weaning_home_active_title', { done: state.done, total: state.total })}</b>
            <span className="cx-sub" style={{ display: 'block' }}>{sub}</span>
          </span>
          <ChevronRight size={18} className="rtl:rotate-180" style={{ color: 'var(--a-ink-faint)' }} />
        </motion.button>
      </section>);
  }

  const keepBreastfeeding = () => {
    const next = { ...readLocal(uid), continueBF: true };
    writeLocal(uid, next);
    setLocal(next);
  };
  const dismiss = () => { writeHomeDismissed(uid, child?.id); setDismissed(true); };
  return (
    <section className="a-section" data-testid="weaning-home-intro">
      <div className="cx-card" style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--a-surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span className="a-tag on" style={{ fontSize: 11.5 }}>🌱 {wt('weaning_home_badge')}</span>
          <button type="button" onClick={dismiss} aria-label={wt('weaning_home_dismiss')}
          style={{ width: 28, height: 28, borderRadius: 10, border: 0, background: 'var(--a-surface-soft)', color: 'var(--a-ink-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>
        <b style={{ fontSize: 15, color: 'var(--a-ink)', lineHeight: 1.3 }}>{wt('weaning_home_title')}</b>
        <span className="cx-sub">{wt('weaning_home_text')}</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
          <button type="button" className="a-btn-solid" style={{ minHeight: 40, padding: '0 16px' }} onClick={openWeaningTool}>{wt('weaning_home_open')}</button>
          <button type="button" className="a-btn-soft" style={{ minHeight: 40, padding: '0 16px' }} onClick={keepBreastfeeding}>{wt('weaning_home_continue')}</button>
        </div>
      </div>
    </section>);
}

/** Feeding logger: "thinking about weaning?" — prefills the plan builder from the last 7 days of breastfeeds. */
export function WeaningFeedingLink() {
  const { uid, child, base } = useWeaningEntryInputs();
  const [busy, setBusy] = useState(false);
  if (!feedingLinkVisible(base)) return null;

  const open = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (uid) {
        const since = new Date(Date.now() - 7 * 86400000).toISOString();
        let q = supabase.from('baby_logs').select('log_type, feed_type, start_time').eq('user_id', uid).eq('log_type', 'feeding').gte('start_time', since);
        if (child?.id) q = q.eq('child_id', child.id);
        const { data } = await q;
        const current = readLocal(uid);
        const feeds = feedsFromLogs((data ?? []) as FeedLog[], current.feeds);
        if (feeds && !current.plan) writeLocal(uid, { ...current, feeds });
      }
    } catch { /* offline: the builder keeps its defaults */ }
    finally { setBusy(false); openWeaningTool(); }
  };
  return (
    <motion.button type="button" className="cx-card cx-row" whileTap={{ scale: .98 }} onClick={open} disabled={busy} data-testid="weaning-feeding-link"
    style={{ width: '100%', textAlign: 'start', cursor: 'pointer', background: 'var(--a-surface)', marginBottom: 12 }}>
      <span className="cx-icon" style={{ background: 'var(--a-peach-1)', fontSize: 20 }}>🌱</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <b style={{ display: 'block', fontSize: 14, color: 'var(--a-ink)' }}>{wt('weaning_feed_link_title')}</b>
        <span className="cx-sub" style={{ display: 'block' }}>{wt('weaning_feed_link_text')}</span>
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--a-coral-text, var(--a-accent-ink))' }}>{wt('weaning_feed_link_cta')}</span>
    </motion.button>);
}

/** Anacan.AI: shown under the answer to a weaning question (mother persona only). */
export function WeaningAiCard() {
  const { base } = useWeaningEntryInputs();
  if (!weaningOfferable(base)) return null;
  const running = !!base.plan && (base.plan.status === 'active' || base.plan.status === 'paused');
  return (
    <div style={{ paddingInlineStart: 34, marginTop: -4, marginBottom: 14 }}>
      <motion.button type="button" className="cx-card cx-row" whileTap={{ scale: .98 }} onClick={openWeaningTool} data-testid="weaning-ai-card"
      style={{ width: '100%', textAlign: 'start', cursor: 'pointer', background: 'var(--a-surface)' }}>
        <span className="cx-icon" style={{ background: 'var(--a-peach-1)', fontSize: 20 }}>🌱</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: 'block', fontSize: 14, color: 'var(--a-ink)' }}>{wt(running ? 'weaning_ai_title_active' : 'weaning_ai_title')}</b>
          <span className="cx-sub" style={{ display: 'block' }}>{wt('weaning_ai_text')}</span>
        </span>
        <ChevronRight size={18} className="rtl:rotate-180" style={{ color: 'var(--a-ink-faint)' }} />
      </motion.button>
    </div>);
}
