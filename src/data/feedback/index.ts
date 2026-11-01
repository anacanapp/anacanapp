import type az from './az.json';
import { createFeatureText } from '@/lib/feature-text';

export type FeedbackText = typeof az;

const text = createFeatureText<FeedbackText>(import.meta.glob<{ default: FeedbackText }>('./*.json'));
export const loadFeedbackText = text.load;
export const useFeedbackText = text.useText;
