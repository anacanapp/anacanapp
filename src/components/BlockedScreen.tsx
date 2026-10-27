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
    <div className="a-scope fixed inset-0 z-[500] flex flex-col items-center justify-center px-6"
    style={{ background: 'var(--a-bg)', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>

      <span className="a3-ico-sq c-peach" style={{ width: 72, height: 72, borderRadius: 24, marginBottom: 20 }} aria-hidden="true">
        <Ban size={34} style={{ color: 'var(--a-bad)' }} />
      </span>

      <h1 className="a3-tool-title" style={{ textAlign: 'center', marginBottom: 8 }}>
        {tr('blocked_title', 'Hesabınız bloklanıb')}
      </h1>
      <p className="a3-meta" style={{ textAlign: 'center', fontSize: 14, maxWidth: 360, marginBottom: 24 }}>
        {tr('blocked_subtitle', 'Anacan qaydalarının pozulmasına görə hesabınız tətbiqdən müvəqqəti və ya daimi olaraq kənarlaşdırılıb.')}
      </p>

      <div className="a3-card a3-pad w-full max-w-sm" style={{ marginBottom: 12 }}>
        <span className="a3-eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--a-bad)' }}>
          <ShieldAlert size={14} />{tr('blocked_reason_label', 'Bloklanma səbəbi')}
        </span>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: 'var(--a-ink)' }}>
          {block.reason || tr('blocked_reason_default', 'Qaydaların pozulması')}
        </p>
      </div>

      <div className="a3-card a3-pad w-full max-w-sm" style={{ marginBottom: 32 }}>
        <p className="a3-meta" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <Clock size={16} />
          <span>
            {expiryText ?
            <>{tr('blocked_until', 'Blokun bitmə tarixi:')} <b style={{ color: 'var(--a-ink)' }}>{expiryText}</b></> :
            tr('blocked_permanent', 'Bu blok daimidir.')}
          </span>
        </p>
        <p className="a3-meta">
          {tr('blocked_appeal', 'Bunun səhv olduğunu düşünürsünüzsə, support@anacan.az ünvanına yazın.')}
        </p>
      </div>

      <button type="button" onClick={() => signOut()} className="a3-btn ghost">
        <LogOut size={16} />
        {tr('blocked_signout', 'Hesabdan çıx')}
      </button>
    </div>);

};

export default BlockedScreen;
