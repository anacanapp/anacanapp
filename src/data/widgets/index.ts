import type az from './az.json';
import { createFeatureText } from '@/lib/feature-text';

export type WidgetText = typeof az;

const text = createFeatureText<WidgetText>(import.meta.glob<{ default: WidgetText }>('./*.json'));
export const loadWidgetText = text.load;
export const useWidgetText = text.useText;
