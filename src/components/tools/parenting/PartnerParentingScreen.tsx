import { usePartnerData } from '@/hooks/usePartnerData';
import { partnerParentingChild } from '@/lib/parenting';
import { ParentingToolView } from './ParentingTool';

/**
 * Tərbiyə for the partner (father): the same tool, content and Premium rules; the child is the woman's active child
 * the partner can see (partner_children_v1, else her profile's baby). His progress, bookmarks and reminders are
 * his own (his account's parenting_state row).
 */
export default function PartnerParentingScreen({ onBack }: { onBack: () => void }) {
  const { partnerProfile, partnerChildren } = usePartnerData();
  return <ParentingToolView onBack={onBack} child={partnerParentingChild(partnerChildren, partnerProfile)} partner />;
}
