import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useChildren } from '@/hooks/useChildren';
import { useAppSetting } from '@/hooks/useAppSettings';
import { useDisabledTools } from '@/hooks/useDisabledTools';
import { useSubscription } from '@/hooks/useSubscription';
import { useUserStore } from '@/store/userStore';
import { homeTipFor, isParentingHomeCardVisible, pickParentingChild, readSlot } from '@/lib/parenting';
import { bandKey, pf, pt } from '@/lib/parenting-copy';
import { activeProgramme } from '@/lib/parenting-reminders';
import { setParentingTarget } from '@/lib/parenting-target';
import { tr } from '@/lib/tr';
import { useParentingState } from './useParentingState';
import { useParentingTips } from './useParentingTips';
import { useParentingReminders } from './useParentingReminders';

/**
 * Ana home teaser for Tərbiyə: today's tip for the active child's age band (the same tip the tool's home shows) and
 * a way into the tool. Visible under the same rules as the Tools tile (switch on, content for the app language,
 * Ana module, child under 13). Only the small tips + programmes chunk of the language loads here (never the whole
 * content); nothing is shown until it is there. It also keeps the programme reminders in line (cancelled once the
 * switch is gone; free users only for the free programme days).
 */
export default function ParentingHomeCard({ onOpen, now }: { onOpen: () => void; now?: Date }) {
  const { user } = useAuth();
  const lifeStage = useUserStore((s) => s.lifeStage);
  const language = useUserStore((s) => s.language);
  const setting = useAppSetting('parenting_tool');
  const { isPremium, loading: premiumLoading } = useSubscription();
  const { isToolDisabled } = useDisabledTools();
  const { selectedChild, children } = useChildren();
  // The selected child when under 13, else the first younger sibling: a 13+ child does not hide the card.
  const child = pickParentingChild(children, { preferred: selectedChild?.id, now }) ?? selectedChild ?? children[0] ?? null;
  const { state } = useParentingState(user?.id ?? null, { sync: false });
  const visible = isParentingHomeCardVisible({
    lifeStage, language, setting, birthDate: child?.birth_date ?? null, birthDates: children.map((c) => c.birth_date), toolDisabled: isToolDisabled('parenting'), now,
  });
  const content = useParentingTips(language, visible);
  const known = setting !== undefined && setting !== null;
  useParentingReminders({ state, content, allowed: known ? visible : null, isPremium: premiumLoading ? null : !!isPremium, now });

  if (!visible || !content) return null;
  const today = homeTipFor(content.tips, { birthDate: child?.birth_date ?? null, slot: readSlot(state, child?.id ?? null), now });
  if (!today) return null;

  // A running programme: a "Continue: <programme> · Day n/total" line that opens it directly.
  const running = activeProgramme(state, content.programmes);
  const track = (action: string, itemId?: string) => {
    import('@/lib/analytics').then((m) => m.analytics.logToolUsed('parenting', action, itemId)).catch(() => {});
  };
  const openTip = () => { track('home_card_open'); onOpen(); };
  const openProgramme = () => {
    if (!running) return;
    setParentingTarget({ kind: 'programme', id: running.programme.id, ...(running.childId ? { child: running.childId } : {}) });
    track('home_continue', running.programme.id);
    onOpen();
  };

  return (
    <section className="a-section" data-testid="parenting-home-card">
      {running && (
        <motion.button type="button" className="a-card a-fade-in a-par-home-continue" whileTap={{ scale: 0.98 }} onClick={openProgramme}
          data-testid="parenting-home-continue">
          <span className="a-par-home-icon" aria-hidden>{running.programme.emoji}</span>
          <span className="a-par-home-continue-text">
            <b>{pf('par_home_continue', { title: running.programme.title })}</b>
            <small>{pf('par_home_day', { n: Math.min(running.progress.done.length + 1, running.programme.days.length), total: running.programme.days.length })}</small>
          </span>
          <ChevronRight size={16} className="rtl:rotate-180" aria-hidden />
        </motion.button>
      )}
      <motion.button type="button" className="a-card a-fade-in a-par-home" whileTap={{ scale: 0.98 }} onClick={openTip}>
        <span className="a-par-home-top">
          <span className="a-par-home-icon" aria-hidden>🤝</span>
          <span className="a-par-home-eyebrow">{tr('dash_parenting_eyebrow', 'Tərbiyə · Günün məsləhəti')}</span>
          <span className="a-par-home-tag">{pt(bandKey(today.band))}</span>
        </span>
        <b className="a-par-home-title">{today.tip.title}</b>
        <span className="a-par-home-text">{today.tip.text}</span>
        <span className="a-par-home-cta">
          {pt('par_see_all')}
          <ChevronRight size={14} className="rtl:rotate-180" />
        </span>
      </motion.button>
    </section>
  );
}
