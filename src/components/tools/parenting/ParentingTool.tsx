import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { ToolPage, ToolHeader } from '@/components/tools/anacan/ToolKit';
import { useAuth } from '@/hooks/useAuth';
import { useChildren } from '@/hooks/useChildren';
import { useSubscription } from '@/hooks/useSubscription';
import { useAppSetting } from '@/hooks/useAppSettings';
import { useEmergencyNumber } from '@/hooks/useEmergencyNumber';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { useUserStore } from '@/store/userStore';
import { pushBackHandler } from '@/lib/backButton';
import { resetAppScrollPosition } from '@/lib/scroll';
import { ageBandFor, ageInMonths, dailyTipIndex, isoDay, toggleSavedState } from '@/lib/parenting';
import { bandKey, pf, pt } from '@/lib/parenting-copy';
import { clearParentingTarget, peekParentingTarget, type ParentingTarget } from '@/lib/parenting-nav';
import { hasParentingContent } from '@/data/parenting';
import { useParentingState } from './useParentingState';
import { useParentingContent } from './useParentingContent';
import { useParentingReminders } from './useParentingReminders';
import {
  type ParentingCtx, type Route, ArticleScreen, BandScreen, HomeScreen, ProgrammeScreen, ProgrammesScreen, QuizScreen, SavedScreen,
  SosListScreen, SosScreen, TopicsScreen, savedRef,
} from './ParentingScreens';

/**
 * Tərbiyə — evidence-based positive parenting for children 0–12 (Ana module; the linked partner sees the same
 * tool). Content is loaded per app language (lazy chunk + published editor overrides).
 * Free: age-band overviews, the daily tip, a free set of articles and SOS cards, quizzes' short results, the first
 * programme days and every safety / "see a specialist" signal. Premium: the full library, all SOS cards, full
 * programmes, detailed quiz results and programme reminders (PremiumBlurGate).
 */
interface Props {
  onBack: () => void;
  /** Test hook: fixed "now". */
  now?: Date;
}

export interface ParentingChild {
  name?: string | null;
  birth_date?: string | null;
}

const track = (action: string) => {
  import('@/lib/analytics').then((m) => m.analytics.logToolUsed('parenting', action)).catch(() => {});
};

const routeFor = (t: ParentingTarget | null): Route[] => (t ? [{ s: t.kind, id: t.id } as Route] : []);

/** Mother (Ana module): the active child from her own children. */
export default function ParentingTool({ onBack, now }: Props) {
  const { selectedChild, children } = useChildren();
  const child = selectedChild ?? children[0] ?? null;
  return <ParentingToolView onBack={onBack} now={now} child={child} />;
}

export function ParentingToolView({ onBack, now, child, partner = false }: Props & { child: ParentingChild | null; partner?: boolean }) {
  useScreenAnalytics(partner ? 'ParentingPartner' : 'Parenting', 'Tools');
  const { user } = useAuth();
  const { isPremium, loading: premiumLoading } = useSubscription();
  const emergency = useEmergencyNumber();
  const language = useUserStore((s) => s.language);
  const setting = useAppSetting('parenting_tool');
  // Content of the app language; a deep link in a language without content falls back to Azerbaijani.
  const lang = hasParentingContent(language) ? String(language) : 'az';
  const { content, loading, retry } = useParentingContent(lang);
  const { state, update, updateLocal, online, pending } = useParentingState(user?.id ?? null);
  const allowed = setting === undefined || setting === null || premiumLoading ? null : setting === 'on' && !!isPremium;
  useParentingReminders({ state, content, allowed, partner, now });

  const nowDate = useMemo(() => now ?? new Date(), [now]);
  const today = isoDay(nowDate);
  const ageMonths = ageInMonths(child?.birth_date, nowDate);
  const childBand = ageBandFor(ageMonths);
  const band = state.band ?? childBand ?? '1-3';
  const childName = child?.name || pt('par_child_fallback');
  const childAgeLabel = ageMonths === null || childBand === null ? null
    : ageMonths < 12 ? pf('par_age_months', { n: ageMonths })
      : ageMonths % 12 === 0 || ageMonths >= 72 ? pf('par_age_years', { n: Math.floor(ageMonths / 12) })
        : pf('par_age_ym', { y: Math.floor(ageMonths / 12), m: ageMonths % 12 });

  // Opened from Anacan.AI on one item: that item first, back returns to the tool home.
  const [stack, setStack] = useState<Route[]>(() => routeFor(peekParentingTarget()));
  useEffect(() => { clearParentingTarget(); }, []);
  const [query, setQuery] = useState('');
  const route: Route = stack.length ? stack[stack.length - 1] : { s: 'home' };
  const go = useCallback((r: Route) => {
    setStack((prev) => [...prev, r]);
    resetAppScrollPosition();
    if (r.s === 'article' || r.s === 'sos') track(`open_${r.s}`);
  }, []);
  const back = useCallback(() => {
    if (stack.length) { setStack((prev) => prev.slice(0, -1)); resetAppScrollPosition(); } else onBack();
  }, [stack.length, onBack]);

  // Android back: inner screens first, then the tool closes (ToolsHub's / Index's own handler).
  useEffect(() => {
    if (!stack.length) return;
    return pushBackHandler(() => { setStack((prev) => prev.slice(0, -1)); return true; });
  }, [stack.length]);

  if (!content) {
    return (
      <ToolPage>
        <ToolHeader title={pt('par_tool_name')} onBack={onBack} />
        <div className="a-par" role="status" aria-busy={loading}>
          {loading ? (
            <>
              <div className="a-par-skel is-hero" />
              <div className="a-par-skel" />
              <div className="a-par-skel" />
              <p className="a-par-small">{pt('par_loading')}</p>
            </>
          ) : (
            <>
              <p className="a-par-lead">{pt('par_load_failed')}</p>
              <button type="button" className="a-par-btn" onClick={retry}>{pt('par_retry')}</button>
            </>
          )}
        </div>
      </ToolPage>
    );
  }

  const ctx: ParentingCtx = {
    content, band, childBand, childName, childAgeLabel, ageMonths, isPremium: !!isPremium, emergency, today, local: state, update,
    updateLocal, go, track, query, setQuery, reminderAllowed: setting !== 'off' && !!isPremium,
  };

  const ref = savedRef(route);
  const isSaved = !!ref && state.saved.includes(ref);
  const actions = route.s === 'home'
    ? <button type="button" className="a-icon-btn" aria-label={pt('par_saved_title')} onClick={() => go({ s: 'saved' })}><Bookmark size={16} /></button>
    : ref
      ? (
        <button type="button" className="a-icon-btn" aria-pressed={isSaved} aria-label={pt(isSaved ? 'par_unsave' : 'par_save')}
          onClick={() => update((s) => toggleSavedState(s, ref))}>
          {isSaved ? <BookmarkCheck size={16} color="var(--a-coral)" /> : <Bookmark size={16} />}
        </button>
      ) : undefined;

  let title = pt('par_tool_name');
  let eyebrow: string | undefined;
  let body: ReactNode = null;
  switch (route.s) {
    case 'home':
      eyebrow = childAgeLabel ? `${childName} · ${childAgeLabel}` : pt(bandKey(band));
      body = <HomeScreen ctx={ctx} tipIndex={dailyTipIndex(today, content.tips[band].length)} />;
      break;
    case 'band':
      eyebrow = pt('par_tool_name'); title = pt('par_band_open');
      body = <BandScreen ctx={ctx} id={route.id} />;
      break;
    case 'topics':
      eyebrow = pt('par_tool_name'); title = pt('par_topics_title');
      body = <TopicsScreen ctx={ctx} area={route.area} />;
      break;
    case 'article':
      eyebrow = pt('par_tool_name'); title = pt('par_sec_topics');
      body = <ArticleScreen ctx={ctx} id={route.id} />;
      break;
    case 'sosList':
      eyebrow = pt('par_tool_name'); title = pt('par_sos_title');
      body = <SosListScreen ctx={ctx} />;
      break;
    case 'sos': {
      const c = content.sos.find((x) => x.id === route.id);
      eyebrow = pt('par_sos_title'); title = c ? `${c.emoji} ${c.title}` : pt('par_sos_title');
      body = <SosScreen key={route.id} ctx={ctx} id={route.id} />;
      break;
    }
    case 'programmes':
      eyebrow = pt('par_tool_name'); title = pt('par_programmes_title');
      body = <ProgrammesScreen ctx={ctx} />;
      break;
    case 'programme': {
      const p = content.programmes.find((x) => x.id === route.id);
      eyebrow = pt('par_programmes_title'); title = p ? p.title : pt('par_programmes_title');
      body = <ProgrammeScreen key={route.id} ctx={ctx} id={route.id} />;
      break;
    }
    case 'quiz':
      eyebrow = pt('par_tool_name'); title = pt('par_quizzes_title');
      body = <QuizScreen key={route.id} ctx={ctx} id={route.id} />;
      break;
    case 'saved':
      eyebrow = pt('par_tool_name'); title = pt('par_saved_title');
      body = <SavedScreen ctx={ctx} />;
      break;
  }

  return (
    <ToolPage>
      <ToolHeader title={title} eyebrow={eyebrow} onBack={back} actions={actions} />
      {pending && !online && <p className="a-par-small" role="status" style={{ marginBottom: 10 }}>{pt('par_offline')}</p>}
      {body}
    </ToolPage>
  );
}
