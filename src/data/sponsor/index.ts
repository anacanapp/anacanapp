import type az from './az.json';
import { createFeatureText } from '@/lib/feature-text';

export type SponsorText = typeof az;

const text = createFeatureText<SponsorText>(import.meta.glob<{ default: SponsorText }>('./*.json'));
export const loadSponsorText = text.load;
export const useSponsorText = text.useText;
