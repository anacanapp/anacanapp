import { useQuery } from '@tanstack/react-query';
import {
  isHealthAvailable, isHealthConnected, readsSupported,
  getDailySteps, getDailyMindfulness, getRecentWorkouts } from
'@/lib/health';

/** iOS-only reads. Mask persisted query data on unsupported platforms as well. */

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
    staleTime: 5 * 60 * 1000,
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
    staleTime: 5 * 60 * 1000
  });
  return supported ? query : { ...query, data: undefined };
};
