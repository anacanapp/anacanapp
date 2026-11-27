import { Ban, LogOut, Clock, ShieldAlert } from 'lucide-react';
import { tr } from '@/lib/tr';
import { getLocaleTag } from '@/lib/i18n';
import { useAuth } from '@/hooks/useAuth';
import type { ActiveBlock } from '@/hooks/useUserBlock';

interface BlockedScreenProps {
  block: ActiveBlock;
}

/**
 * Tam blok (block_type='full') ekranı — istifadəçi tətbiqə girəndə bunun
 * xaricində heç nə görmür. Blok səbəbi və (müvəqqətidirsə) bitmə tarixi
 * göstərilir. Yeganə çıxış: hesabdan çıxmaq.
 *
 * Community bloku üçün AYRICA yüngül panel CommunityScreen-dədir —
 * o halda tətbiqin qalan hissəsi işləməyə davam edir.
 */
const BlockedScreen = ({ block }: BlockedScreenProps) => {
  const { signOut } = useAuth();

  const expiryText = block.expires_at ?
  new Date(block.expires_at).toLocaleDateString(getLocaleTag(), {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }) :
  null;

  return (
    <div className="fixed inset-0 z-[500] flex flex-col items-center justify-center px-6 bg-background"
    style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      
      <div className="w-20 h-20 rounded-3xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center mb-5">
        <Ban className="w-10 h-10 text-red-500" />
      </div>

      <h1 className="text-xl font-black text-foreground text-center mb-2">
        {tr('blocked_title', 'Hesabınız bloklanıb')}
      </h1>
      <p className="text-sm text-muted-foreground text-center mb-6 max-w-sm">
        {tr('blocked_subtitle', 'Anacan qaydalarının pozulmasına görə hesabınız tətbiqdən müvəqqəti və ya daimi olaraq kənarlaşdırılıb.')}
      </p>

      <div className="w-full max-w-sm rounded-2xl border border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-950/20 p-4 mb-3">
        <div className="flex items-center gap-2 mb-1.5">
          <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
          <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">
            {tr('blocked_reason_label', 'Bloklanma səbəbi')}
          </span>
        </div>
        <p className="text-sm text-foreground leading-relaxed">
          {block.reason || tr('blocked_reason_default', 'Qaydaların pozulması')}
        </p>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 mb-8">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            {expiryText ?
            <>{tr('blocked_until', 'Blokun bitmə tarixi:')} <span className="font-semibold text-foreground">{expiryText}</span></> :
            tr('blocked_permanent', 'Bu blok daimidir.')}
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          {tr('blocked_appeal', 'Bunun səhv olduğunu düşünürsünüzsə, support@anacan.az ünvanına yazın.')}
        </p>
      </div>

      <button
        onClick={() => signOut()}
        className="flex items-center gap-2 px-6 h-11 rounded-full bg-muted font-bold text-sm text-foreground">
        <LogOut className="w-4 h-4" />
        {tr('blocked_signout', 'Hesabdan çıx')}
      </button>
    </div>);

};

export default BlockedScreen;
