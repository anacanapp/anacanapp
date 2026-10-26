import { tr } from '../tr';
import { AD_PLACEMENTS, type AdPlacementId } from './config';
import { AD_REASON_LABELS, type AdBlockReason } from './policy';

/** Presentation only: IDs, formats, rules and request configuration stay typed
 * in config/policy; these helpers resolve their human-readable labels. */
export const localizedAdPlacements = () => AD_PLACEMENTS.map(item => ({ ...item,
  title: tr(`ads_placement_${item.id}_title`, item.title),
  description: tr(`ads_placement_${item.id}_description`, item.description),
  trigger: tr(`ads_placement_${item.id}_trigger`, item.trigger),
}));
export const localizedAdPlacement = (id: AdPlacementId) => localizedAdPlacements().find(item => item.id === id)!;
export const adReasonLabel = (reason: AdBlockReason) => tr(`ads_reason_${reason}`, AD_REASON_LABELS[reason]);
export const adMetricLabels = () => ({
  requested: tr('ads_metric_requested', 'Sorğu'), loaded: tr('ads_metric_loaded', 'Yükləndi'),
  impression: tr('ads_metric_impression', 'Göstərilmə'), skipped: tr('ads_metric_skipped', 'Buraxıldı'),
  reward_earned: tr('ads_metric_reward', 'Mükafat'), failed: tr('ads_metric_failed', 'Xəta'),
});
