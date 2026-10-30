import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useUserStore } from '@/store/userStore';
import { useAuth } from './useAuth';
import { usePregnancyDayNavigation } from './usePregnancyDayNavigation';
import { usePregnancyContentByDay } from './usePregnancyContent';
import { getDynamicFruitData, useFruitImages } from './useFruitData';
import { useBabyChatText } from '@/data/baby-chat';
import {
  dailyArrival, dailyBabyMessages, dayKey, loadThreads, saveThread, type BabyChatMessage, type BabyWeekFacts,
} from '@/lib/baby-chat';

/** Today's "Körpəmdən mesajlar" state for the pregnant user: week facts, arrival time and thread. */
export function useBabyChat() {
  const { language, getPregnancyData } = useUserStore(useShallow((s) => ({ language: s.language || 'az', getPregnancyData: s.getPregnancyData })));
  const { user } = useAuth();
  const userId = user?.id || 'local';
  const text = useBabyChatText(language);
  const preg = getPregnancyData();
  const { selectedDay: day, selectedWeek: week, daysUntilDueFromSelected } = usePregnancyDayNavigation({
    lastPeriodDate: preg?.lastPeriodDate || null,
    dueDate: preg?.dueDate,
  });
  const { data: dayContent } = usePregnancyContentByDay(day > 0 ? day : undefined);
  const { data: fruitImages = [] } = useFruitImages();
  const size = week > 0 ? getDynamicFruitData(fruitImages, day, week, dayContent) : null;

  const facts: BabyWeekFacts = {
    week,
    fruit: size?.fruit || null,
    cm: size?.lengthCm || null,
    weeksLeft: daysUntilDueFromSelected != null ? Math.max(0, Math.ceil(daysUntilDueFromSelected / 7)) : null,
  };

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const today = dayKey(now);
  const arrival = dailyArrival(now, userId);
  const arrived = now >= arrival;
  const dailyMessage = dayContent?.baby_message || null;

  const [threads, setThreads] = useState(() => loadThreads(userId));
  useEffect(() => { setThreads(loadThreads(userId)); }, [userId]);
  const thread: BabyChatMessage[] = threads[today] || [];
  const delivered = thread.some((m) => m.id === `${today}-daily`);
  const pendingDaily = useMemo(
    () => (text && dailyMessage && arrived && !delivered ? dailyBabyMessages(text, dailyMessage, now, userId) : []),
    [text, dailyMessage, arrived, delivered, now, userId],
  );

  const setThread = useCallback((messages: BabyChatMessage[]) => {
    saveThread(userId, today, messages);
    setThreads((current) => ({ ...current, [today]: messages }));
  }, [userId, today]);

  const previousDay = Object.keys(threads).filter((k) => k < today).sort().pop();
  return {
    text, userId, language, facts, arrival, arrived, dailyMessage, today,
    thread, pendingDaily, setThread, unread: pendingDaily.length > 0,
    previousThread: previousDay ? threads[previousDay] : [],
  };
}
