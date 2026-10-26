import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Stethoscope, BookOpen, Camera, Music, 
  Baby, Thermometer, AlertCircle, Sparkles, Star, Heart, LucideIcon, Crown
} from 'lucide-react';
import { hapticFeedback } from '@/lib/native';
import { useQuickActions } from '@/hooks/useQuickActions';
import { useChildren } from '@/hooks/useChildren';
import { useToolConfigs } from '@/hooks/useDynamicTools';
import { useSubscription } from '@/hooks/useSubscription';
import { useUserStore } from '@/store/userStore';
import { tr } from '@/lib/tr';
import { PremiumModal } from '@/components/PremiumModal';
import { useDisabledTools } from '@/hooks/useDisabledTools';

const ICON_MAP: Record<string, LucideIcon> = {
  Baby, Thermometer, Music, AlertCircle, Sparkles, BookOpen, Camera, Stethoscope, Heart, Star
};

interface QuickActionsBarProps {
  onNavigateToTool?: (tool: string) => void;
}

/**
 * Quick access grid — redesigned to the anacan-demo "a-trio" tiles.
 * Premium-gated tools show a crown chip and open the premium modal.
 * All data (quick_actions table, tool configs, disabled tools) unchanged.
 */
const QuickActionsBar = ({ onNavigateToTool }: QuickActionsBarProps) => {
  const { selectedChild, getChildAge } = useChildren();
  const lifeStage = useUserStore((s) => s.lifeStage);
  const { isPremium } = useSubscription();
  const { data: toolConfigs = [] } = useToolConfigs(lifeStage);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  
  const childAge = selectedChild ? getChildAge(selectedChild) : null;
  const ageInMonths = childAge?.months || 0;
  const ageGroup = ageInMonths < 3 ? 'newborn' : 'older';
  
  const { data: dbActions = [], isLoading } = useQuickActions('mommy', ageGroup);
  const { disabledTools } = useDisabledTools();

  // Filter out actions for disabled tools
  const filteredActions = dbActions.filter(a => !disabledTools.includes(a.tool_key));

  const isToolPremium = (toolKey: string): boolean => {
    const config = toolConfigs.find(t => t.tool_id === toolKey);
    if (!config) return false;
    if (config.is_premium) return true;
    if (lifeStage === 'mommy' && config.mommy_locked) return true;
    if (lifeStage === 'bump' && config.bump_locked) return true;
    if (lifeStage === 'flow' && config.flow_locked) return true;
    return false;
  };

  const handleAction = async (toolKey: string) => {
    await hapticFeedback.light();
    if (!isPremium && isToolPremium(toolKey)) {
      setShowPremiumModal(true);
      return;
    }
    onNavigateToTool?.(toolKey);
  };

  const getTranslationKey = (toolKey: string): string => {
    const normalized = toolKey.replace(/-/g, '_');
    if (normalized === 'baby_photo') return 'quick_action_baby_photoshoot';
    if (normalized === 'fairy_tales') return 'quick_action_fairy_tale';
    return `quick_action_${normalized}`;
  };

  if (isLoading) {
    return (
      <section className="a-section">
        <div className="a-section-head">
          <h2 className="a-section-title a-heading">{tr('quickactionsbar_quick_access', 'Sürətli keçid')}</h2>
        </div>
        <div className="a-trio cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="a-trio-item animate-pulse" style={{ height: 84 }} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="a-section">
        <div className="a-section-head">
          <h2 className="a-section-title a-heading">
            {tr('quickactionsbar_quick_access', 'Sürətli keçid')}
          </h2>
        </div>
        <div className="a-trio cols-4">
          {filteredActions.map((action, idx) => {
            const IconComponent = ICON_MAP[action.icon] || Star;
            const needsPremium = !isPremium && isToolPremium(action.tool_key);
            return (
              <motion.button
                key={action.id}
                onClick={() => handleAction(action.tool_key)}
                className="a-trio-item"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.05 + idx * 0.04 }}
                whileTap={{ scale: 0.92 }}
                aria-label={needsPremium ? `${action.label} — Premium` : action.label}
              >
                {needsPremium && (
                  <span className="a-crown-chip">
                    <Crown size={11} strokeWidth={2.6} />
                  </span>
                )}
                <span className="a-trio-icon" style={{ background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)' }}>
                  <IconComponent size={17} strokeWidth={2} />
                </span>
                <p className="a-trio-label">{tr(getTranslationKey(action.tool_key), action.label_az || action.label)}</p>
              </motion.button>
            );
          })}
        </div>
      </section>

      <PremiumModal
        isOpen={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        feature="tool"
      />
    </>
  );
};

export default QuickActionsBar;
