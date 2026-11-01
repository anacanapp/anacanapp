import type az from './az.json';
import { createFeatureText } from '@/lib/feature-text';

export type LockOfferText = typeof az;

const text = createFeatureText<LockOfferText>(import.meta.glob<{ default: LockOfferText }>('./*.json'));
export const loadLockOfferText = text.load;
export const useLockOfferText = text.useText;
