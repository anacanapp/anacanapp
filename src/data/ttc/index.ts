import type az from './az.json';
import { createFeatureText } from '@/lib/feature-text';

export type TtcText = typeof az;

const text = createFeatureText<TtcText>(import.meta.glob<{ default: TtcText }>('./*.json'));
export const loadTtcText = text.load;
export const useTtcText = text.useText;
