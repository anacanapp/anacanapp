import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useChildren } from '@/hooks/useChildren';
import { useAppSetting } from '@/hooks/useAppSettings';
import { useDisabledTools } from '@/hooks/useDisabledTools';
import { useUserStore } from '@/store/userStore';
import { homeTipFor, isParentingHomeCardVisible } from '@/lib/parenting';
import { bandKey, pt } from '@/lib/parenting-copy';
import { tr } from '@/lib/tr';
// Only the tips file: the dashboard must not pull the whole article/SOS library into its chunk.
// Tərbiyə content is Azerbaijani only and the card is shown to Azerbaijani-language users only.
import { TIPS } from '@/data/parenting/az/tips';
import { useParentingState } from './useParentingState';

/**
 * Ana home teaser for Tərbiyə: today's tip for the active child's age band (the same tip the tool's home shows) and
 * a way into the tool. Visible under the same rules as the Tools tile (switch on, az, Ana module, child under 13).
 */
export default function ParentingHomeCard({ onOpen, now }: { onOpen: () => void; now?: Date }) {
  const { user } = useAuth();
  const lifeStage = useUserStore((s) => s.lifeStage);
  const language = useUserStore((s) => s.language);
  const setting = useAppSetting('parenting_tool');
  const { isToolDisabled } = useDisabledTools();
  const { selectedChild, children } = useChildren();
  const child = selectedChild ?? children[0] ?? null;
  const { state } = useParentingState(user?.id ?? null);

  if (!isParentingHomeCardVisible({ lifeStage, language, setting, birthDate: child?.birth_date ?? null, toolDisabled: isToolDisabled('parenting'), now })) return null;
  const today = homeTipFor(TIPS, { birthDate: child?.birth_date ?? null, chosenBand: state.band, now });
  if (!today) return null;

  return (
    <section className="a-section" data-testid="parenting-home-card">
      <motion.button type="button" className="a-card a-fade-in a-par-home" whileTap={{ scale: 0.98 }} onClick={onOpen}>
        <span className="a-par-home-top">
          <span className="a-par-home-icon" aria-hidden>🤝</span>
          <span className="a-par-home-eyebrow">{tr('dash_parenting_eyebrow', 'Tərbiyə · Günün məsləhəti')}</span>
          <span className="a-par-home-tag">{pt(bandKey(today.band))}</span>
        </span>
        <b className="a-par-home-title">{today.tip.title}</b>
        <span className="a-par-home-text">{today.tip.text}</span>
        <span className="a-par-home-cta">
          {pt('par_see_all')}
          <ChevronRight size={14} className="rtl:rotate-180" />
        </span>
      </motion.button>
    </section>
  );
}
