import type az from './az.json';
import { createFeatureText } from '@/lib/feature-text';

export type IllnessText = typeof az;

const text = createFeatureText<IllnessText>(import.meta.glob<{ default: IllnessText }>('./*.json'));
export const loadIllnessText = text.load;
export const useIllnessText = text.useText;
