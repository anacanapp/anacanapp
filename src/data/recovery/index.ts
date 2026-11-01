import type az from './az.json';
import { createFeatureText } from '@/lib/feature-text';

export type RecoveryText = typeof az;

const text = createFeatureText<RecoveryText>(import.meta.glob<{ default: RecoveryText }>('./*.json'));
export const loadRecoveryText = text.load;
export const useRecoveryText = text.useText;
