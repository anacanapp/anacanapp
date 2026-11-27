import type az from './az.json';
import { createFeatureText } from '@/lib/feature-text';

export type SleepNextText = typeof az;

const text = createFeatureText<SleepNextText>(import.meta.glob<{ default: SleepNextText }>('./*.json'));
export const loadSleepNextText = text.load;
export const useSleepNextText = text.useText;
