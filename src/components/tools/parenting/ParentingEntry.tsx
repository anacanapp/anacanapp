import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useChildren } from '@/hooks/useChildren';
import { useAppSetting } from '@/hooks/useAppSettings';
import { useDisabledTools } from '@/hooks/useDisabledTools';
import { useUserStore } from '@/store/userStore';
import { isParentingPartnerVisible, isParentingTileVisible } from '@/lib/parenting';
import { matchParentingTopic } from '@/lib/parenting-match';
import { openParentingTool } from '@/lib/parenting-nav';
import { pt } from '@/lib/parenting-copy';
import { useParentingContent } from './useParentingContent';

/** The woman's context as the partner (Ata AI) sees it. */
export interface ParentingPartnerContext {
  lifeStage: string | null | undefined;
  babyBirthDate?: string | null;
}

/**
 * Whether Tərbiyə is available to this user: the mother in the Ana module (same rules as the Tools tile), or the
 * partner of a woman in the Ana module (partner rules). Both need the admin switch and content for the language.
 */
export function useParentingAvailable(partner?: ParentingPartnerContext | null): boolean {
  const lifeStage = useUserStore((s) => s.lifeStage);
  const language = useUserStore((s) => s.language);
  const setting = useAppSetting('parenting_tool');
  const { isToolDisabled } = useDisabledTools();
  const { selectedChild, children } = useChildren();
  if (partner) return isParentingPartnerVisible({ womanLifeStage: partner.lifeStage, language, setting, birthDate: partner.babyBirthDate ?? null });
  const child = selectedChild ?? children[0] ?? null;
  return !isToolDisabled('parenting') && isParentingTileVisible({ lifeStage, language, setting, birthDate: child?.birth_date ?? null });
}

/**
 * Anacan.AI: a suggestion card under the answer when the question was about a parenting topic — the best matching
 * SOS card or article in the app language; it opens the tool directly on that item.
 */
export function ParentingAiCard({ question, partner }: { question: string; partner?: ParentingPartnerContext | null }) {
  const language = useUserStore((s) => s.language);
  const available = useParentingAvailable(partner);
  const { content } = useParentingContent(language, available);
  const match = available ? matchParentingTopic(content, question) : null;
  if (!match) return null;
  const open = () => {
    import('@/lib/analytics').then((m) => m.analytics.logToolUsed('parenting', `ai_card_${match.kind}`)).catch(() => {});
    openParentingTool({ kind: match.kind, id: match.id }, { partner: !!partner });
  };
  return (
    <div style={{ paddingInlineStart: 34, marginTop: -4, marginBottom: 14 }}>
      <motion.button type="button" className="a-par-ai" whileTap={{ scale: 0.98 }} onClick={open} data-testid="parenting-ai-card">
        <span className="ic" aria-hidden>{match.emoji}</span>
        <span className="tx">
          <small>{pt(match.kind === 'sos' ? 'par_ai_kind_sos' : 'par_ai_kind_article')}</small>
          <b>{match.title}</b>
          <span>{pt('par_ai_text')}</span>
        </span>
        <span className="cta">{pt('par_ai_open')}<ChevronRight size={14} className="rtl:rotate-180" /></span>
      </motion.button>
    </div>
  );
}
