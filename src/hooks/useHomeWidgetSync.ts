import { useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from './useAuth';
import { useUserStore } from '@/store/userStore';
import { useSubscription } from './useSubscription';
import { useChildren } from './useChildren';
import { useBabyLogsRange } from './useBabyLogsRange';
import { useFruitDataForWeek } from './useFruitData';
import { useWidgetText, type WidgetText } from '@/data/widgets';
import { fill } from '@/lib/feature-text';
import { feedKind, feedingStats, diaperStats, logsOfDay, sleepStats, type BabyLogRow } from '@/lib/baby-logs-range';
import { ageBand, monthsOld, parsePlanState, planStorageKey, sleepEntries, parseClock } from '@/lib/sleep-training';
import { predictNextNap } from '@/lib/sleep-predict';
import { getDayInWeek, getDaysUntilDue, getPregnancyProgress, getPregnancyWeek, getTrimester } from '@/lib/pregnancy-utils';
import {
  buildWidgetSnapshot, babyAgeText, compactDuration, pushWidgetSnapshot, readWidgetSettings, WIDGET_SETTINGS_KEY,
  type WidgetCare, type WidgetJourney } from
'@/lib/home-widgets';

/** The latest feeding as widget text: "Sol döş · 14 dəq". */
export function lastFeed(t: WidgetText, logs: BabyLogRow[]): { at: number; text: string } | null {
  const feeds = logs.filter((l) => l.log_type === 'feeding' && feedKind(l.feed_type))
    .sort((a, b) => b.start_time.localeCompare(a.start_time));
  const f = feeds[0];
  if (!f) return null;
  const kind = feedKind(f.feed_type)!;
  const start = new Date(f.start_time).getTime();
  const end = f.end_time ? new Date(f.end_time).getTime() : null;
  const minutes = end && end > start ? Math.round((end - start) / 60_000) : null;
  const text = `${t.sides[kind]}${minutes ? ` · ${fill(t.minutes, { n: minutes })}` : ''}`;
  return { at: end ?? start, text };
}

function sleepPlan(userId: string | undefined): { sleepingSince: Date | null; wakeTime: string | null } {
  if (!userId) return { sleepingSince: null, wakeTime: null };
  try {
    const state = parsePlanState(JSON.parse(localStorage.getItem(planStorageKey(userId)) || 'null'));
    return { sleepingSince: state.pendingSleepStart ? new Date(state.pendingSleepStart) : null, wakeTime: state.wakeTime };
  } catch { return { sleepingSince: null, wakeTime: null }; }
}

/**
 * Keeps the home-screen widgets current while the app is open (native only): pregnancy week or the
 * baby's age for everyone; feeding/sleep only with Premium (otherwise the widget asks for Premium).
 */
export function useHomeWidgetSync(): void {
  const native = Capacitor.isNativePlatform();
  const { user, profile } = useAuth();
  const lifeStage = useUserStore((s) => s.lifeStage);
  const language = useUserStore((s) => s.language);
  const t = useWidgetText(language);
  const { isPremium } = useSubscription();
  const { selectedChild } = useChildren();
  const care = native && lifeStage === 'mommy';
  const { logs } = useBabyLogsRange(care && isPremium ? 8 : 1);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!native) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 5 * 60_000);
    const onStorage = (e: StorageEvent) => {if (e.key === WIDGET_SETTINGS_KEY || e.key?.startsWith('anacan.sleepTraining')) setTick((n) => n + 1);};
    const onVisible = () => {if (document.visibilityState === 'hidden') setTick((n) => n + 1);};
    window.addEventListener('storage', onStorage);
    window.addEventListener('anacan-widgets-changed', onVisible as EventListener);
    document.addEventListener('visibilitychange', onVisible);
    return () => {window.clearInterval(id);window.removeEventListener('storage', onStorage);window.removeEventListener('anacan-widgets-changed', onVisible as EventListener);document.removeEventListener('visibilitychange', onVisible);};
  }, [native]);

  const p = profile as { last_period_date?: string | null; due_date?: string | null; baby_birth_date?: string | null; baby_name?: string | null } | null;
  const week = lifeStage === 'bump' && p?.last_period_date ? getPregnancyWeek(p.last_period_date) : 0;
  const fruit = useFruitDataForWeek(Math.max(1, Math.min(42, week || 1)));

  const snapshot = useMemo(() => {
    if (!native || !t || !user) return null;
    const now = new Date();
    let journey: WidgetJourney | null = null;
    let careData: WidgetCare | null = null;
    if (lifeStage === 'bump' && p?.last_period_date && week > 0) {
      const day = getDayInWeek(p.last_period_date);
      journey = {
        eyebrow: fill(t.trimester, { n: getTrimester(week) }),
        title: day ? fill(t.pregnancy_week, { w: week, d: day }) : fill(t.pregnancy_week_only, { w: week }),
        subtitle: fill(t.baby_size, { fruit: fruit.fruit }),
        badge: fill(t.days_left, { n: getDaysUntilDue(p.last_period_date, p.due_date) }),
        progress: Math.min(1, getPregnancyProgress(p.last_period_date) / 100),
        emoji: fruit.emoji || '🤰'
      };
    }
    const birthIso = selectedChild?.birth_date ?? p?.baby_birth_date ?? null;
    if (lifeStage === 'mommy' && birthIso) {
      const birth = new Date(birthIso);
      const name = selectedChild?.name || p?.baby_name || '';
      const age = babyAgeText(t, birth, now);
      journey = { eyebrow: name, title: age, subtitle: '', badge: '', progress: 0, emoji: selectedChild?.avatar_emoji || '👶' };
      const today = logsOfDay(logs, now);
      const feed = lastFeed(t, logs);
      const plan = sleepPlan(user.id);
      const band = ageBand(monthsOld(birth, now));
      const wake = plan.wakeTime ? parseClock(plan.wakeTime) : null;
      const morningWake = wake === null ? null : new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.floor(wake / 60), wake % 60);
      const next = band ? predictNextNap({ entries: sleepEntries(logs), band, now, sleepingSince: plan.sleepingSince, morningWake }) : null;
      careData = {
        name, age, emoji: selectedChild?.avatar_emoji || '👶',
        lastFeedAt: feed?.at ?? null, lastFeedText: feed?.text ?? '',
        nextNapStart: next?.windowStart?.getTime() ?? null, nextNapEnd: next?.windowEnd?.getTime() ?? null,
        nextNapIsBedtime: !!next?.isBedtime,
        sleepingSince: plan.sleepingSince?.getTime() ?? null,
        todayFeeds: feedingStats(today).total,
        todaySleep: compactDuration(t, sleepStats(today).totalMinutes),
        todayDiapers: diaperStats(today).total
      };
    }
    return buildWidgetSnapshot({ text: t, premium: isPremium, settings: readWidgetSettings(), journey, care: careData, now });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [native, t, user?.id, lifeStage, p?.last_period_date, p?.due_date, p?.baby_birth_date, selectedChild?.id, selectedChild?.birth_date, logs, isPremium, fruit.fruit, fruit.emoji, tick]);

  useEffect(() => {if (snapshot) void pushWidgetSnapshot(snapshot);}, [snapshot]);
}
