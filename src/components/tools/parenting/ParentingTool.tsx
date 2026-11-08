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
import {
  type ChildSlot, ageBandFor, ageInMonths, childForProgramme, dailyTipIndex, effectiveBand, hasParentingActivity, isoDay, milestoneAge, normalizeForChild,
  parentingChildren, pickParentingChild, readSlot, setSlotBand, toggleSavedState, writeSlot,
} from '@/lib/parenting';
import type { AgeBandId } from '@/data/parenting/types';
import { bandKey, pf, pt } from '@/lib/parenting-copy';
import { clearParentingTarget, peekParentingTarget, type ParentingTarget } from '@/lib/parenting-nav';
import { hasParentingContent } from '@/data/parenting';
import { useParentingState } from './useParentingState';
import { useParentingContent } from './useParentingContent';
import { useParentingReminders } from './useParentingReminders';
import { ParentingIntro, introSeen, markIntroSeen } from './ParentingIntro';
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
  /** Child id (user_children / partner_children_v1); null for a profile-only baby. */
  id?: string | null;
  name?: string | null;
  birth_date?: string | null;
  /** Original due date (user_children.due_date): a preterm baby's milestone check uses the corrected age. */
  due_date?: string | null;
}

/** Tool analytics; `itemId` names the article / SOS card / programme opened, so content popularity is measurable. */
const track = (action: string, itemId?: string) => {
  import('@/lib/analytics').then((m) => m.analytics.logToolUsed('parenting', action, itemId)).catch(() => {});
};

const routeFor = (t: ParentingTarget | null): Route[] => (t ? [{ s: t.kind, id: t.id } as Route] : []);

/** Mother (Ana module): her children, starting on the app's selected child when it is under 13. */
export default function ParentingTool({ onBack, now }: Props) {
  const { selectedChild, children } = useChildren();
  const child = selectedChild ?? children[0] ?? null;
  return <ParentingToolView onBack={onBack} now={now} child={child} kids={children} />;
}

export function ParentingToolView({ onBack, now, child: preferred, kids, partner = false }: Props & {
  /** The preferred child (the app's selected child / her current child). */
  child: ParentingChild | null;
  /** Every child the parent can switch between (only those under 13 or without a birth date are offered). */
  kids?: ParentingChild[];
  partner?: boolean;
}) {
  useScreenAnalytics(partner ? 'ParentingPartner' : 'Parenting', 'Tools');
  const { user, profile } = useAuth();
  const { isPremium, loading: premiumLoading } = useSubscription();
  const emergency = useEmergencyNumber();
  const language = useUserStore((s) => s.language);
  const setting = useAppSetting('parenting_tool');
  // Content of the app language; a deep link in a language without content falls back to Azerbaijani.
  const lang = hasParentingContent(language) ? String(language) : 'az';
  const { content, loading, retry } = useParentingContent(lang);
  const { state, update, updateLocal, online, pending } = useParentingState(user?.id ?? null);
  // Reminders: switch on for everyone (free users get the free programme days); Premium for every day.
  const allowed = setting === undefined || setting === null ? null : setting === 'on';
  useParentingReminders({ state, content, allowed, isPremium: premiumLoading ? null : !!isPremium, partner, now });

  const nowDate = useMemo(() => now ?? new Date(), [now]);
  const today = isoDay(nowDate);

  // Several children: a compact switcher; the band, programmes and quiz results follow the selected child.
  const [pickedId, setPickedId] = useState<string | null>(() => peekParentingTarget()?.child ?? null);
  const kidList = useMemo(() => (kids?.length ? kids : preferred ? [preferred] : []), [kids, preferred]);
  const eligible = useMemo(() => parentingChildren(kidList, nowDate), [kidList, nowDate]);
  const child = pickParentingChild(kidList, { picked: pickedId, preferred: preferred?.id, now: nowDate });
  const childId = child?.id ?? null;
  const ageMonths = ageInMonths(child?.birth_date, nowDate);
  const childBand = ageBandFor(ageMonths);
  const milestone = milestoneAge(child?.birth_date, child?.due_date, nowDate);
  const slot = readSlot(state, childId);
  const band = effectiveBand(slot, childBand) ?? '1-3';
  const updateSlot = useCallback((fn: (s: ChildSlot) => ChildSlot) => update((s) => writeSlot(s, childId, fn)), [update, childId]);

  // Account-level data from before multi-child support becomes this child's; an outgrown manual band is dropped.
  const stamp = useMemo(() => new Date(nowDate.getTime()).toISOString(), [nowDate]);
  useEffect(() => {
    if (normalizeForChild(state, childId, childBand, stamp) !== state) update((s) => normalizeForChild(s, childId, childBand, stamp));
  }, [state, childId, childBand, stamp, update]);
  const childName = child?.name || pt('par_child_fallback');
  const childAgeLabel = ageMonths === null || childBand === null ? null
    : ageMonths < 12 ? pf('par_age_months', { n: ageMonths })
      : ageMonths % 12 === 0 || ageMonths >= 72 ? pf('par_age_years', { n: Math.floor(ageMonths / 12) })
        : pf('par_age_ym', { y: Math.floor(ageMonths / 12), m: ageMonths % 12 });

  // Opened from Anacan.AI on one item: that item first, back returns to the tool home.
  const [stack, setStack] = useState<Route[]>(() => routeFor(peekParentingTarget()));
  useEffect(() => {
    // Opened on one item (Anacan.AI card, reminder tap, home "Continue"): count it like any other open.
    const t = peekParentingTarget();
    if (t) track(`open_${t.kind}`, t.id);
    // A reminder tap names only the programme: open it for the child it runs for.
    if (t?.kind === 'programme' && !t.child) {
      const owner = childForProgramme(state, t.id);
      if (owner) setPickedId(owner);
    }
    clearParentingTarget();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once, on mount

  // First-run intro (once per device + account), only on the tool home and for a parent who has not used the tool.
  const uid = user?.id ?? null;
  const [intro, setIntro] = useState(() => !introSeen(uid) && !peekParentingTarget() && !hasParentingActivity(state));
  // A parent who already used the tool (before this intro existed) never sees it.
  useEffect(() => { if (!intro && !introSeen(uid) && hasParentingActivity(state)) markIntroSeen(uid); }, [intro, uid, state]);
  const finishIntro = useCallback((picked: AgeBandId | null) => {
    markIntroSeen(uid);
    setIntro(false);
    if (picked) updateSlot((s) => setSlotBand(s, picked, childBand));
    track(picked ? 'intro_band' : 'intro_done');
  }, [uid, updateSlot, childBand]);
  const [query, setQuery] = useState('');
  const route: Route = stack.length ? stack[stack.length - 1] : { s: 'home' };
  const go = useCallback((r: Route) => {
    setStack((prev) => [...prev, r]);
    resetAppScrollPosition();
    if (r.s === 'article' || r.s === 'sos' || r.s === 'programme') track(`open_${r.s}`, r.id);
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
    content, band, childBand, childName, childAgeLabel, ageMonths, isPremium: !!isPremium, emergency, today, locale: String(language || lang),
    local: state, slot, updateSlot, update, updateLocal, go, track, query, setQuery, reminderAllowed: setting !== 'off',
    milestoneMonths: milestone.months, milestoneCorrected: milestone.corrected, partner, userId: user?.id ?? null,
    // The mother can send an item to her linked partner (partner_messages); everyone can use the share sheet.
    shareActor: !partner && user?.id && profile?.user_id === user.id && profile?.linked_partner_id ? { userId: user.id, partnerProfileId: profile.linked_partner_id } : null,
  };

  const ref = savedRef(route);
  const isSaved = !!ref && state.saved.includes(ref);
  const switcher = route.s === 'home' && eligible.length > 1 ? (
    <select className="a-par-kid" aria-label={pt('par_child_switch')} value={childId ?? ''} data-testid="parenting-child-switch"
      onChange={(e) => { setPickedId(e.target.value || null); track('child_switch'); }}>
      {eligible.map((k) => <option key={k.id ?? 'none'} value={k.id ?? ''}>{k.name || pt('par_child_fallback')}</option>)}
    </select>
  ) : null;
  const actions = route.s === 'home'
    ? <>{switcher}<button type="button" className="a-icon-btn" aria-label={pt('par_saved_title')} onClick={() => go({ s: 'saved' })}><Bookmark size={16} /></button></>
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
      body = <BandScreen ctx={ctx} id={route.id} focus={route.focus} />;
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
      {intro && route.s === 'home' && <ParentingIntro askBand={childBand === null && !slot.band} onDone={finishIntro} />}
    </ToolPage>
  );
}
