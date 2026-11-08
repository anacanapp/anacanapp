import { useAuth } from './useAuth';
import { useHospitalBagTemplates, type HospitalBagTemplate } from './useDynamicTools';
import { useHospitalBagSync } from './useHospitalBagSync';
import type { BagItem } from '@/lib/hospital-bag';

export type HospitalBagItem = BagItem;

const NO_TEMPLATES: HospitalBagTemplate[] = [];

/**
 * The mother's hospital bag: default items (templates, can be hidden) plus her own and her partner's items
 * (can be deleted). Changes made on the partner's phone arrive live. `items` holds the visible list;
 * `allItems` includes hidden default items for the "hidden" section.
 */
export const useHospitalBag = () => {
  const { user } = useAuth();
  const { data, isLoading: templatesLoading } = useHospitalBagTemplates();
  const templates = data ?? NO_TEMPLATES;
  const bag = useHospitalBagSync(user?.id ?? null, 'owner', templates, !!user && !templatesLoading);
  const visible = bag.items.filter((i) => !i.hidden);

  return {
    items: visible,
    allItems: bag.items,
    hiddenItems: bag.items.filter((i) => i.hidden),
    loading: bag.loading || templatesLoading,
    toggleItem: bag.toggleItem,
    addItem: bag.addItem,
    deleteItem: bag.deleteItem,
    setHidden: bag.setHidden,
    getProgress: () => bag.progress,
    checkedCount: bag.checkedCount,
    totalCount: bag.totalCount,
    refetch: bag.refetch,
  };
};
