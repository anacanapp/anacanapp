import { motion } from 'framer-motion';
import {
  ShoppingCart, Package, Vote, FileText, CalendarHeart,
  Baby, BarChart3, Gift, ChevronRight } from
'lucide-react';
import { usePartnerData } from '@/hooks/usePartnerData';
import { usePartnerHospitalBag } from '@/hooks/usePartnerHospitalBag';
import { useDailySummary } from '@/hooks/useDailySummary';
import { useSurprises } from '@/hooks/useSurprises';
import { useShoppingItems } from '@/hooks/useShoppingItems';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { tr } from '@/lib/tr';

/**
 * "Birlikdə" hub — bütün sinxron funksiyaların vahid mərkəzi.
 */

interface Props {
  onNavigate: (screen: string) => void;
}

const MOOD_EMOJIS = ['😢', '😔', '😐', '🙂', '😊'];

const PartnerTogetherScreen = ({ onNavigate }: Props) => {
  useScrollToTop();

  const { partnerProfile, sharing } = usePartnerData();
  const { checkedCount, totalCount, getProgress } = usePartnerHospitalBag();
  const { todaySummary } = useDailySummary();
  const { plannedSurprises, totalPoints } = useSurprises();
  const { items: shoppingItems } = useShoppingItems();

  const lifeStage = partnerProfile?.life_stage || 'bump';
  const uncheckedShopping = shoppingItems.filter((i) => !i.is_checked).length;

  interface FeatureCard {
    id: string;
    screen: string;
    title: string;
    subtitle: string;
    icon: any;
    bg: string;
    ink: string;
    badge?: string | null;
    progress?: number;
    visible: boolean;
  }

  const features: FeatureCard[] = [
  {
    id: 'shopping',
    screen: 'partner-shopping',
    title: tr('partnerv2_alisveris', 'Alışveriş'),
    subtitle: uncheckedShopping > 0 ?
    `${uncheckedShopping} ${tr('partnerv2_gozleyen_mehsul', 'gözləyən məhsul')}` :
    tr('partnerv2_siyahi_hazir', 'Siyahı hazırdır'),
    icon: ShoppingCart,
    bg: 'var(--a-green-1)', ink: 'var(--a-green-ink)',
    badge: uncheckedShopping > 0 ? String(uncheckedShopping) : null,
    visible: true
  },
  {
    id: 'hospital-bag',
    screen: 'partner-hospital-bag',
    title: tr('syncedfeaturesgrid_xestexana_cantasi_045078', 'Xəstəxana Çantası'),
    subtitle: `${checkedCount}/${totalCount} ${tr('partner_ready', 'hazır')}`,
    icon: Package,
    bg: 'var(--a-peach-1)', ink: 'var(--a-accent-ink)',
    progress: getProgress(),
    visible: lifeStage === 'bump'
  },
  {
    id: 'name-voting',
    screen: 'name-voting',
    title: tr('syncedfeaturesgrid_ad_secimi_465d2a', 'Ad Seçimi'),
    subtitle: tr('partnerv2_birlikde_secin', 'Birlikdə seçin'),
    icon: Vote,
    bg: 'var(--a-pink-1)', ink: 'var(--a-pink-ink)',
    visible: lifeStage !== 'flow'
  },
  {
    id: 'daily-summary',
    screen: 'daily-summary',
    title: tr('syncedfeaturesgrid_gundelik_xulase_3d07a5', 'Gündəlik Xülasə'),
    // NOT: əvvəllər `todaySummary` (səssiz auto-sync tərəfindən HƏMİŞƏ doldurulur)
    // sadəcə mövcudluğuna görə "Bugün göndərildi" göstərirdi - real
    // `is_sent` sahəsi heç yoxlanmırdı, çünki göndərmə funksiyası (bax
    // PartnerCareCard.tsx-dəki yeni düymə) heç vaxt çağırılmırdı. Nəticədə
    // partnyor "göndərildi" görürdü, halbuki heç bir bildiriş göndərilməmişdi.
    subtitle: todaySummary?.is_sent ? tr('syncedfeaturesgrid_bugun_gonderildi_1fb520', 'Bugün göndərildi') : tr('syncedfeaturesgrid_gozleyir_7c7f65', 'Gözləyir...'),
    icon: FileText,
    bg: 'var(--a-lav-1)', ink: 'var(--a-lav-ink)',
    badge: todaySummary?.is_sent ? MOOD_EMOJIS[(todaySummary.mood || 3) - 1] : null,
    visible: true
  },
  {
    id: 'appointments',
    screen: 'partner-appointments',
    title: tr('partnerv2_randevular', 'Randevular'),
    subtitle: tr('partnerv2_hekim_vizitleri', 'Həkim vizitləri'),
    icon: CalendarHeart,
    bg: 'var(--a-blue-1)', ink: 'var(--a-blue-ink)',
    visible: sharing.share_appointments
  },
  {
    id: 'baby-day',
    screen: 'partner-baby-day',
    title: tr('partnerv2_korpe_gunu', 'Körpə Günü'),
    subtitle: tr('partnerv2_yeme_yuxu_bez', 'Yemə · yuxu · bez'),
    icon: Baby,
    bg: 'var(--a-pink-1)', ink: 'var(--a-pink-ink)',
    visible: lifeStage === 'mommy' && sharing.share_baby_logs
  },
  {
    id: 'weekly-stats',
    screen: 'partner-weekly-stats',
    title: tr('syncedfeaturesgrid_heftelik_statistika_292953', 'Həftəlik Statistika'),
    subtitle: tr('syncedfeaturesgrid_ehval_aktivlik_a0a105', 'Əhval & aktivlik'),
    icon: BarChart3,
    bg: 'var(--a-blue-1)', ink: 'var(--a-blue-ink)',
    visible: true
  },
  {
    id: 'surprises',
    screen: 'partner-surprises',
    title: tr('syncedfeaturesgrid_surpriz_planla_d495ce', 'Sürpriz Planla'),
    subtitle: plannedSurprises.length > 0 ?
    `${plannedSurprises.length} ${tr('partnerv2_planlanib', 'planlanıb')}` :
    tr('syncedfeaturesgrid_planlasdir_933684', 'Planlaşdır'),
    icon: Gift,
    bg: 'var(--a-yellow-1)', ink: 'var(--a-yellow-ink)',
    badge: totalPoints > 0 ? `${totalPoints} ${tr('partnerv2_xal', 'xal')}` : null,
    visible: true
  }];


  const visibleFeatures = features.filter((f) => f.visible);

  return (
    <div className="a-scope pb-6 min-h-screen relative overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
      <div className="a-sky" aria-hidden>
        <span className="a-cloud c1" /><span className="a-cloud c2" /><span className="a-cloud c3" />
      </div>

      <div className="a-shell relative z-10">
        <header className="a-topbar">
          <div>
            <p className="a-eyebrow">{tr('partnerv2_sinxron_eyebrow', 'SİNXRON')}</p>
            <p className="a-wordmark" style={{ fontSize: 19 }}>{tr('partnerv2_birlikde', 'Birlikdə')}</p>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-2.5">
          {visibleFeatures.map((f, idx) => {
            const Icon = f.icon;
            return (
              <motion.button
                key={f.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                onClick={() => onNavigate(f.screen)}
                className="text-start relative"
                style={{
                  background: 'var(--a-surface)',
                  borderRadius: 'var(--a-radius-md)',
                  padding: 15,
                  boxShadow: 'var(--a-card-shadow)'
                }}
                whileTap={{ scale: 0.97 }}>

                <div className="w-11 h-11 flex items-center justify-center mb-2.5"
                style={{ borderRadius: 14, background: f.bg }}>
                  <Icon size={19} style={{ color: f.ink }} />
                </div>
                <h4 className="truncate" style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--a-ink)' }}>{f.title}</h4>
                <p className="truncate" style={{ fontSize: 11, color: 'var(--a-ink-soft)', marginTop: 1 }}>{f.subtitle}</p>

                {f.progress !== undefined &&
                <div className="h-1.5 rounded-full overflow-hidden mt-2.5" style={{ background: 'var(--a-surface-soft)' }}>
                    <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'var(--a-grad-peach)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${f.progress}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }} />
                  </div>
                }

                {f.badge &&
                <span className="absolute top-3 end-3"
                style={{ background: f.bg, color: f.ink, borderRadius: 999, padding: '3px 8px', fontSize: 10, fontWeight: 800 }}>
                    {f.badge}
                  </span>
                }
                {!f.badge && f.progress === undefined &&
                <ChevronRight size={14} className="rtl:rotate-180 absolute bottom-4 end-3.5" style={{ color: 'var(--a-ink-faint)' }} />
                }
              </motion.button>);

          })}
        </div>
      </div>
    </div>);

};

export default PartnerTogetherScreen;
