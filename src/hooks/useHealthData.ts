import { useQuery } from '@tanstack/react-query';
import {
  isHealthAvailable, isHealthConnected, readsSupported, getReadAccess,
  getDailySteps, getDailyMindfulness, getRecentWorkouts } from
'@/lib/health';

/** Apple Health (iOS) and Health Connect (Android) reads. Off the device, persisted data is masked. */

export const useHealthAvailability = () => {
  const supported = readsSupported();
  const query = useQuery({
    queryKey: ['health-available'],
    queryFn: isHealthAvailable,
    enabled: supported,
    staleTime: 60 * 1000
  });
  return supported ? query : { ...query, data: false };
};

/** Android only: what Health Connect actually allows. iOS answers null (HealthKit hides read grants). */
export const useHealthReadAccess = (connected = isHealthConnected()) => {
  const supported = readsSupported();
  const query = useQuery({
    queryKey: ['health-read-access'],
    queryFn: getReadAccess,
    enabled: supported && connected,
    staleTime: 0,
    refetchOnWindowFocus: true
  });
  return supported ? query : { ...query, data: null };
};

export const useHealthDaily = (days = 7, connected = isHealthConnected()) => {
  const supported = readsSupported();
  const query = useQuery({
    queryKey: ['health-daily', days],
    queryFn: async () => {
      const [steps, mindfulness] = await Promise.all([
      getDailySteps(days),
      getDailyMindfulness(days)]
      );
      return { steps, mindfulness };
    },
    enabled: supported && connected,
    staleTime: 2 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: true
  });
  return supported ? query : { ...query, data: undefined };
};

export const useHealthWorkouts = (days = 7, connected = isHealthConnected()) => {
  const supported = readsSupported();
  const query = useQuery({
    queryKey: ['health-workouts', days],
    queryFn: () => getRecentWorkouts(days),
    enabled: supported && connected,
    staleTime: 5 * 60 * 1000,
    retry: 1
  });
  return supported ? query : { ...query, data: undefined };
};
