import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useHospitalBagTemplates, type HospitalBagTemplate } from './useDynamicTools';
import { useHospitalBagSync } from './useHospitalBagSync';
import type { BagCategory, BagItem } from '@/lib/hospital-bag';

export interface PartnerHospitalBagItem extends Omit<BagItem, 'category'> {
  /** 'partner' items are reported as 'mom' here so the three-tab partner screen still lists them. */
  category: 'mom' | 'baby' | 'documents';
  /** The real group, including 'partner'. */
  bag_category: BagCategory;
}

const NO_TEMPLATES: HospitalBagTemplate[] = [];

/** The linked mother's hospital bag as seen and edited by the partner, updated live. */
export const usePartnerHospitalBag = () => {
  const { user, profile } = useAuth();
  const [partnerUserId, setPartnerUserId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);
  const { data, isLoading: templatesLoading } = useHospitalBagTemplates();
  const templates = data ?? NO_TEMPLATES;

  useEffect(() => {
    let cancelled = false;
    const linked = profile?.linked_partner_id;
    if (!user || !linked) {
      setPartnerUserId(null);
      setResolving(false);
      return;
    }
    setResolving(true);
    void (async () => {
      try {
        const { data: row, error } = await supabase.from('profiles').select('user_id').eq('id', linked).single();
        if (!cancelled) setPartnerUserId(error || !row ? null : row.user_id);
      } catch {
        if (!cancelled) setPartnerUserId(null);
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, profile?.linked_partner_id]);

  const bag = useHospitalBagSync(partnerUserId, 'partner', templates, !resolving && !templatesLoading);

  const items: PartnerHospitalBagItem[] = bag.items
    .filter((i) => !i.hidden)
    .map((i) => ({ ...i, bag_category: i.category, category: i.category === 'partner' ? 'mom' : i.category }));

  return {
    items,
    loading: resolving || (!!partnerUserId && (bag.loading || templatesLoading)),
    toggleItem: bag.toggleItem,
    addItem: (itemName: string, category: BagCategory) => bag.addItem(itemName, category),
    deleteItem: bag.deleteItem,
    setHidden: bag.setHidden,
    getProgress: () => bag.progress,
    checkedCount: bag.checkedCount,
    totalCount: bag.totalCount,
    refetch: bag.refetch,
  };
};
