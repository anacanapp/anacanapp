import { tr } from '@/lib/tr';
import { RECAP_COPY, type RecapCopyKey } from './copy';

/** Translated Recap string (tr with the Azerbaijani source as fallback). */
export const rt = (key: RecapCopyKey): string => tr(key, RECAP_COPY[key]);
