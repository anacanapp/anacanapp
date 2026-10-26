import { useCallback, useEffect, useRef, useState } from 'react';
import { useAdExperience } from '@/components/ads/AdExperienceProvider';
import { useSubscription } from './useSubscription';
import { AD_REASON_LABELS } from '@/lib/ads/policy';

export interface GameReviveBenefits { lives: number; moves: number; seconds: number }
export function useGameAds(gameId: string, phase: string, restore: (benefits: GameReviveBenefits) => void) {
  const ads = useAdExperience(), subscription = useSubscription();
  const [used, setUsed] = useState(0), [waiting, setWaiting] = useState(false);
  const [message, setMessage] = useState('');
  const state = useRef({ phase, restore, ads, premium: subscription.isPremium });
  state.current = { phase, restore, ads, premium: ads.preview.enabled ? ads.preview.premium : subscription.isPremium };
  const round = useRef(crypto.randomUUID()), alive = useRef(true), acting = useRef(false), uses = useRef(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const clearBreak = ads.registerSurface('games_break_interstitial');
    const clearReward = ads.registerSurface('game_revive_rewarded');
    return () => { clearBreak(); clearReward(); };
  }, [ads.registerSurface]);
  const resetRound = useCallback(() => { round.current = crypto.randomUUID(); uses.current = 0; setUsed(0); setMessage(''); }, []);
  const transition = useCallback(async (action: () => void) => {
    if (acting.current) return;
    acting.current = true; setWaiting(true);
    const token = round.current;
    try {
      if (['won','lost'].includes(state.current.phase)
        && state.current.ads.opportunity('games_break_interstitial', `${gameId}:${token}`))
        await state.current.ads.showInterstitial('games_break_interstitial');
      if (alive.current && round.current === token) action();
    } finally { acting.current = false; if (alive.current) setWaiting(false); }
  }, [gameId]);
  const revive = useCallback(async () => {
    const config = state.current.ads.configuration?.placements.find(item => item.id === 'game_revive_rewarded');
    if (acting.current || state.current.phase !== 'lost' || !config?.enabled || uses.current >= config.max_revives) return;
    acting.current = true; setWaiting(true); setMessage(''); const token = round.current;
    try {
      const earned = state.current.premium || await state.current.ads.showRewarded('game_revive_rewarded');
      if (!alive.current || token !== round.current || state.current.phase !== 'lost') return;
      if (earned) { uses.current++; setUsed(uses.current); state.current.phase = 'playing'; state.current.restore({ lives: config.revive_lives, moves: config.revive_moves, seconds: config.revive_seconds }); }
      else setMessage('Video tamamlanmadı və ya reklam hazır deyil. Can / gediş dəyişmədi.');
    } finally { acting.current = false; if (alive.current) setWaiting(false); }
  }, []);
  const config = ads.configuration?.placements.find(item => item.id === 'game_revive_rewarded');
  const decision = ads.decisionFor('game_revive_rewarded');
  const premium = ads.preview.enabled ? ads.preview.premium : subscription.isPremium;
  return { transition, revive, resetRound, waiting: waiting || ads.busy, message, premium, used,
    benefits: { lives: config?.revive_lives ?? 3, moves: config?.revive_moves ?? 5, seconds: config?.revive_seconds ?? 15 },
    canOffer: phase === 'lost' && !!config?.enabled && used < (config?.max_revives ?? 1),
    canRequest: premium || decision.allowed || decision.reason === 'consent',
    reason: AD_REASON_LABELS[decision.reason],
    allowedPlacements: phase === 'lost' ? 'games_break_interstitial game_revive_rewarded' : ['intro','won'].includes(phase) ? 'games_break_interstitial' : '',
  };
}
