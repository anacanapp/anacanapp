import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useUserStore } from '@/store/userStore';
import { useAuth } from '@/hooks/useAuth';
import { useAppSetting } from '@/hooks/useAppSettings';
import { useSubscription } from '@/hooks/useSubscription';
import { useChildren } from '@/hooks/useChildren';
import { useEffectiveCycleLength } from '@/hooks/useCycleHistory';
import { getCycleDayForDate } from '@/lib/cycle-utils';
import { PUSH_NAV_EVENT, type PushNavIntent } from '@/lib/pushNav';
import { STORY_THEMES, fillStory, storiesEnabledFor, storyMatches, storyVars, type Story, type StorySlide, type StoryStage } from '@/lib/stories';
import { STORIES_AZ, WEEKS, MONTHS, PHASES } from '@/data/stories/az';
import { illustration } from './illustrations';
import StoryViewer from './StoryViewer';
import './stories.css';

const SEEN_KEY = (uid: string) => `anacan-stories-seen:${uid}`;
const readSeen = (uid: string): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY(uid)) || '[]')); } catch { return new Set(); }
};
const writeSeen = (uid: string, seen: Set<string>) => {
  try { localStorage.setItem(SEEN_KEY(uid), JSON.stringify([...seen].slice(-400))); } catch { /* storage unavailable */ }
};

const monthsSince = (iso: string | null | undefined, now = new Date()): number | null => {
  if (!iso) return null;
  const b = new Date(iso);
  if (!Number.isFinite(b.getTime()) || b > now) return null;
  let m = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) m -= 1;
  return Math.max(0, m);
};

/**
 * Instagram-style story row on the dashboard (Azerbaijani; app_settings.dashboard_stories off / admin / on).
 * Only stories that fit this user right now are shown (stage, week or baby age, cycle phase); unseen ones first.
 */
export default function DashboardStories({ stage }: { stage: StoryStage }) {
  const { user, isAdmin } = useAuth();
  const setting = useAppSetting('dashboard_stories');
  const { language, role, getPregnancyData, lastPeriodDate } = useUserStore(useShallow((s) => ({
    language: s.language, role: s.role, getPregnancyData: s.getPregnancyData, lastPeriodDate: s.lastPeriodDate,
  })));
  const { isPremium } = useSubscription();
  const { selectedChild } = useChildren();
  const cycleLength = useEffectiveCycleLength();
  const uid = user?.id ?? '';
  const enabled = storiesEnabledFor(setting, { isAdmin: !!isAdmin, language, role });

  const week = stage === 'bump' ? getPregnancyData()?.currentWeek ?? null : null;
  const babyMonths = stage === 'mommy' ? monthsSince(selectedChild?.birth_date) : null;
  const cycleDay = stage === 'flow' && lastPeriodDate ? getCycleDayForDate(new Date(), new Date(lastPeriodDate), cycleLength || 28) : null;
  const ctx = useMemo(() => ({ stage, week, babyMonths, babyName: selectedChild?.name ?? null, cycleDay, isPremium: !!isPremium }),
    [stage, week, babyMonths, selectedChild?.name, cycleDay, isPremium]);
  const vars = useMemo(() => storyVars(ctx, { weeks: WEEKS, months: MONTHS, phases: PHASES }), [ctx]);

  const [seen, setSeen] = useState<Set<string>>(() => readSeen(uid));
  const [openAt, setOpenAt] = useState<number | null>(null);
  // Order is fixed while the viewer is open so "next story" does not jump when one is marked seen.
  const [frozen, setFrozen] = useState<Story[] | null>(null);

  const list = useMemo(() => {
    if (!enabled) return [];
    const fit = STORIES_AZ.filter((s) => storyMatches(s, ctx, vars));
    return [...fit.filter((s) => !seen.has(s.id)), ...fit.filter((s) => seen.has(s.id))];
  }, [enabled, ctx, vars, seen]);

  const log = useCallback((action: string, id: string) => {
    import('@/lib/analytics').then((m) => m.analytics.logToolUsed('stories', action, id)).catch(() => {});
  }, []);
  const markSeen = useCallback((id: string) => {
    setSeen((prev) => { if (prev.has(id)) return prev; const next = new Set(prev); next.add(id); writeSeen(uid, next); return next; });
  }, [uid]);
  const close = useCallback(() => { setOpenAt(null); setFrozen(null); }, []);
  const onCta = useCallback((story: Story, slide: StorySlide) => {
    if (!slide.cta) return;
    log('story_cta', story.id);
    markSeen(story.id);
    close();
    const intent: PushNavIntent = slide.cta.nav.tool ? { tool: slide.cta.nav.tool }
      : slide.cta.nav.tab ? { tab: slide.cta.nav.tab } : { screen: slide.cta.nav.screen };
    window.setTimeout(() => window.dispatchEvent(new CustomEvent<PushNavIntent>(PUSH_NAV_EVENT, { detail: intent })), 60);
  }, [close, log, markSeen]);

  if (!enabled || list.length === 0) return null;
  const shown = frozen ?? list;

  return (
    <section className="as-row-wrap" aria-label="Story-lər" data-testid="dashboard-stories">
      <div className="as-row">
        {list.map((s, i) => {
          const th = STORY_THEMES[s.theme] ?? STORY_THEMES.coral;
          const isSeen = seen.has(s.id);
          return (
            <button key={s.id} type="button" className={`as-ring${isSeen ? ' is-seen' : ''}`} onClick={() => { setFrozen(list); setOpenAt(i); }}
              aria-label={`${fillStory(s.title, vars)}${isSeen ? '' : ', yeni'}`}>
              <span className="as-ring-o"><span className="as-ring-i" style={{ background: th.bg }}
                dangerouslySetInnerHTML={{ __html: illustration(s.illus, th.pop, th.light ? th.ink : '#fff') }} /></span>
              <span className="as-ring-t">{fillStory(s.title, vars)}</span>
            </button>
          );
        })}
      </div>
      {openAt !== null && <StoryViewer stories={shown} startIndex={openAt} vars={vars} onClose={close} onSeen={markSeen} onCta={onCta} onEvent={log} />}
    </section>
  );
}
