import type az from './az.json';
import { createFeatureText } from '@/lib/feature-text';

export type PromoText = typeof az;

const text = createFeatureText<PromoText>(import.meta.glob<{ default: PromoText }>('./*.json'));
export const loadPromoText = text.load;
export const usePromoText = text.useText;
