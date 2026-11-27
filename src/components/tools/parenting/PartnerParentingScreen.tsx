import { usePartnerData } from '@/hooks/usePartnerData';
import { partnerParentingChild } from '@/lib/parenting';
import { ParentingToolView } from './ParentingTool';

/**
 * Tərbiyə for the partner (father): the same tool, content and Premium rules; the child is the woman's active child
 * the partner can see (partner_children_v1, else her profile's baby) and he can switch between her children. His
 * progress, bookmarks and reminders are his own (his account's parenting_state row). Each child carries her due date
 * (partner_children_v1 after migration 20261109090000), so a preterm baby's milestone check uses corrected age.
 */
export default function PartnerParentingScreen({ onBack }: { onBack: () => void }) {
  const { partnerProfile, partnerChildren } = usePartnerData();
  const current = partnerChildren.find((c) => c.is_current) ?? partnerChildren[0];
  const child = partnerParentingChild(partnerChildren, partnerProfile);
  return <ParentingToolView onBack={onBack} child={current ? { ...child, id: current.id, ...(current.due_date ? { due_date: current.due_date } : {}) } : child} kids={partnerChildren} partner />;
}
