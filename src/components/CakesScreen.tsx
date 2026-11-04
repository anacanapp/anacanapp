import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Cake as CakeIcon, Loader2, ShoppingBag, ShoppingCart, ChevronRight } from 'lucide-react';
import { addMonths, differenceInCalendarDays, parseISO } from 'date-fns';
import { useChildren } from '@/hooks/useChildren';
import { useCakes, type Cake } from '@/hooks/useCakes';
import { useCakeCart } from '@/hooks/useCakeCart';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics, trackEvent } from '@/hooks/useScreenAnalytics';
import CakeDetailScreen from '@/components/cakes/CakeDetailScreen';
import CakeCartDrawer from '@/components/cakes/CakeCartDrawer';
import CakeOrderForm from '@/components/cakes/CakeOrderForm';
import { tr } from "@/lib/tr";

interface CakesScreenProps {
  onBack?: () => void;
  initialMonth?: number;
}

import { getOrdinal } from '@/lib/utils';
import { useUserStore } from '@/store/userStore';
import { useAuth } from '@/hooks/useAuth';
import { isCakesAvailable } from '@/lib/freemium';

const getMonthLabels = (language: string) => Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  label: i === 11 ? tr('cakesscreen_one_year', '1 yaş') : `${getOrdinal(i + 1, language)} ay`
}));

type CakeCategoryKey = 'month' | 'milestone' | 'pregnancy' | 'family';
type CakeFilter = 'all' | CakeCategoryKey | number;
const CATEGORY_ORDER: CakeCategoryKey[] = ['month', 'milestone', 'pregnancy', 'family'];
const categoryLabel = (key: CakeCategoryKey) => ({
  month: tr('cakesscreen_cat_month', 'Aylıq tortlar'),
  milestone: tr('cakesscreen_cat_milestone', 'Xüsusi günlər'),
  pregnancy: tr('cakesscreen_cat_pregnancy', 'Hamiləlik'),
  family: tr('cakesscreen_cat_family', 'Ailə və bayram')
})[key];
const categorySub = (key: CakeCategoryKey) => ({
  month: tr('cakesscreen_cat_month_sub', 'Hər ayın fotosu üçün bento tort'),
  milestone: tr('cakesscreen_cat_milestone_sub', '40 gün, ilk diş, ilk addım, 1 yaş'),
  pregnancy: tr('cakesscreen_cat_pregnancy_sub', 'Gender reveal və sevindirici xəbər'),
  family: tr('cakesscreen_cat_family_sub', 'Ana, əkizlər, bayramlar və adlı tortlar')
})[key];
const categoryOf = (cake: Cake): CakeCategoryKey => (CATEGORY_ORDER as string[]).includes(cake.category) ? cake.category as CakeCategoryKey : 'milestone';

const CakesScreen = ({ onBack, initialMonth }: CakesScreenProps) => {
  const language = useUserStore((s) => s.language);
  const storeCountryCode = useUserStore((s) => s.countryCode);
  const { profile, isAdmin } = useAuth();
  const MONTHS = useMemo(() => getMonthLabels(language), [language]);

  useScreenAnalytics('Cakes', 'Shop');

  // Müdafiə-dərinliyi: bu tool yalnız Azərbaycan üçündür (giriş nöqtəsindən asılı olmayaraq).
  // QEYD: hook qaydalarına görə bu yoxlama BÜTÜN hook çağırışlarından sonra, yalnız
  // render-dən əvvəl tətbiq olunur (aşağıda, `return` bloklarından əvvəl axtar).
  const cakesOk = isAdmin || isCakesAvailable((profile as any)?.country_code || storeCountryCode, language);
  const { cakes, loading } = useCakes();
  const { totalItems } = useCakeCart();

  const [activeFilter, setActiveFilter] = useState<CakeFilter>(initialMonth || 'all');
  const [searchQuery] = useState('');
  const { selectedChild, getChildAge } = useChildren();
  const [selectedCake, setSelectedCake] = useState<Cake | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);

  // Tort detalı / checkout açılanda da yuxarıdan başla
  useScrollToTop([selectedCake, showCheckout]);

  const filteredCakes = useMemo(() => {
    let filtered = cakes;
    if (typeof activeFilter === 'string' && activeFilter !== 'all') {
      filtered = filtered.filter((c) => categoryOf(c) === activeFilter);
    } else if (typeof activeFilter === 'number') {
      filtered = filtered.filter((c) => c.category === 'month' && c.month_number === activeFilter);
    }
    if (searchQuery.trim()) {
      filtered = filtered.filter((c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return filtered;
  }, [cakes, activeFilter, searchQuery]);

  const presentCategories = useMemo(() => CATEGORY_ORDER.filter((key) => cakes.some((c) => categoryOf(c) === key)), [cakes]);

  // The child's next month birthday: the monthly cake for it, and how many days are left.
  const nextMonth = useMemo(() => {
    if (!selectedChild?.birth_date) return null;
    const age = getChildAge(selectedChild);
    const months = age?.months ?? null;
    if (months === null || months < 0 || months >= 12) return null;
    const month = months + 1;
    const cake = cakes.find((c) => c.category === 'month' && c.month_number === month);
    if (!cake) return null;
    let days = 0;
    try { days = Math.max(0, differenceInCalendarDays(addMonths(parseISO(selectedChild.birth_date), month), new Date())); } catch { return null; }
    return { month, cake, days, name: selectedChild.name as string | undefined };
  }, [selectedChild, getChildAge, cakes]);

  const monthMode = activeFilter === 'month' || typeof activeFilter === 'number';
  const renderGrid = (list: Cake[]) =>
  <div className="a-tool-grid" style={{ marginTop: 10 }}>
      {list.map((cake, index) =>
    <motion.div
      key={cake.id}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(0.04 * index, 0.25) }}
      className="a-tool-tile"
      style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }}
      whileTap={{ scale: 0.97 }}
      onClick={() => { trackEvent('cake_viewed', { cake_id: cake.id, category: cake.category }); setSelectedCake(cake); }}>
          {cake.image_url ?
      <div className="relative" style={{ aspectRatio: '1 / 1' }}>
              <img src={cake.image_url} alt={cake.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              {cake.category !== 'month' && cake.milestone_label &&
        <span className="a-cta-badge" style={{ position: 'absolute', top: 8, insetInlineStart: 8, padding: '3px 8px', fontSize: 9, background: 'var(--a-yellow-1)', color: 'var(--a-warn-ink)' }}>{cake.milestone_label}</span>
        }
              {cake.category === 'month' && cake.month_number &&
        <span className="a-cta-badge" style={{ position: 'absolute', top: 8, insetInlineStart: 8, padding: '3px 8px', fontSize: 9 }}>{cake.month_number === 12 ? tr('cakesscreen_one_year', '1 yaş') : tr(`common_month_label_${cake.month_number}`, `${getOrdinal(cake.month_number!, language)} ay`)}</span>
        }
            </div> :
      <div style={{ aspectRatio: '1 / 1', background: 'var(--a-illus-grad)', display: 'grid', placeItems: 'center' }}>
              <CakeIcon size={40} style={{ color: 'var(--a-peach-2)', opacity: 0.6 }} />
            </div>
      }
          <div style={{ padding: 12 }}>
            <p className="a-tool-title" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 3 }}>{cake.name}</p>
            {cake.description && <p className="a-tool-sub" style={{ marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{cake.description}</p>}
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--a-accent-ink)' }}>{cake.price}₼</span>
              <span className="a-trio-icon" style={{ margin: 0, width: 34, height: 34, background: 'var(--a-grad-peach)', color: 'var(--a-accent-ink)' }}>
                <ShoppingBag size={15} strokeWidth={2.2} />
              </span>
            </div>
          </div>
        </motion.div>
    )}
    </div>;

  if (!cakesOk) return null;

  if (showOrderSuccess) {
    return (
      <div className="a-scope min-h-screen flex flex-col items-center justify-center px-6 text-center overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }} className="text-8xl mb-6">🎂</motion.div>
        <h2 className="a-heading" style={{ margin: '0 0 8px', fontSize: 22, color: 'var(--a-on-bg)' }}>{tr("cakesscreen_sifarisiniz_qebul_edildi_ae5b9e", "Sifarişiniz qəbul edildi!")}</h2>
        <p className="a-list-sub" style={{ margin: '0 0 28px', whiteSpace: 'normal' }}>{tr("cakesscreen_tezlikle_sizinle_elaqe_saxlanilacaq_806311", "Tezliklə sizinlə əlaqə saxlanılacaq")}</p>
        <button
          onClick={() => {setShowOrderSuccess(false);setShowCheckout(false);setSelectedCake(null);}}
          className="a-cta-btn">
          {tr("cakesscreen_tortlara_qayit_c533c2", "Tortlara qay\u0131t")}
        
        </button>
      </div>);

  }

  if (showCheckout) {
    return (
      <CakeOrderForm
        onBack={() => setShowCheckout(false)}
        onSuccess={() => setShowOrderSuccess(true)} />);


  }

  if (selectedCake) {
    return (
      <>
        <CakeDetailScreen
          cake={selectedCake}
          onBack={() => setSelectedCake(null)}
          onOpenCart={() => setShowCart(true)} />
        
        <CakeCartDrawer
          open={showCart}
          onClose={() => setShowCart(false)}
          onCheckout={() => {setShowCart(false);setShowCheckout(true);}} />
        
      </>);

  }

  if (loading) {
    return (
      <div className="a-scope min-h-screen flex items-center justify-center overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--a-peach-2)' }} />
      </div>);

  }

  return (
    <div className="a-scope overflow-y-auto pb-44" style={{ background: 'var(--a-bg)', minHeight: '100%' }}>
      <div className="a-shell">
      {/* Top bar */}
      <motion.header className="a-topbar" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onBack &&
          <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.9 }}>
              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
            </motion.button>
          }
          <div>
            <p className="a-eyebrow">{tr("cakesscreen_eyebrow_v2", "Aylıq və xüsusi gün tortları")}</p>
            <p className="a-wordmark" style={{ fontSize: 18 }}>{tr("untranslated_tortlar_go6yj8", "Tortlar 🎂")}</p>
          </div>
        </div>
        <div className="a-topbar-actions">
          <button onClick={() => setShowCart(true)} className="a-icon-btn" style={{ cursor: 'pointer' }}>
            <ShoppingCart size={16} strokeWidth={2} />
            {totalItems > 0 &&
            <span
              style={{
                position: 'absolute', top: -4, insetInlineEnd: -4, minWidth: 15, height: 15, padding: '0 4px',
                borderRadius: 999, background: 'var(--a-peach-2)', color: '#fff', fontSize: 8.5, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {totalItems}
              </span>
            }
          </button>
        </div>
      </motion.header>


      {/* Categories */}
      <motion.div className="a-tag-row hide-scrollbar" style={{ flexWrap: 'nowrap', overflowX: 'auto', marginBottom: 0, paddingBottom: 4 }} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
        <button onClick={() => setActiveFilter('all')} className={`a-tag${activeFilter === 'all' ? ' on' : ''}`} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
          {tr("cakesscreen_hamisi_plain", "Hamısı")}
        </button>
        {presentCategories.map((key) =>
        <button key={key} onClick={() => setActiveFilter(key)} className={`a-tag${activeFilter === key || key === 'month' && typeof activeFilter === 'number' ? ' on' : ''}`} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
            {categoryLabel(key)}
          </button>
        )}
      </motion.div>

      {/* Months (inside "Aylıq tortlar") */}
      {monthMode &&
      <div className="a-tag-row hide-scrollbar" style={{ flexWrap: 'nowrap', overflowX: 'auto', marginTop: 8, marginBottom: 0, paddingBottom: 4 }}>
          {MONTHS.map((m) =>
        <button key={m.id} onClick={() => setActiveFilter(activeFilter === m.id ? 'month' : m.id)} className={`a-tag${activeFilter === m.id ? ' on' : ''}`} style={{ flexShrink: 0, whiteSpace: 'nowrap', fontSize: 12, padding: '5px 11px' }}>
              {m.label}
            </button>
        )}
        </div>
      }

      {/* Next month birthday of the child, or the general banner */}
      {nextMonth && activeFilter === 'all' ?
      <motion.button type="button" className="a-card a-fade-in w-full text-start" onClick={() => { trackEvent('cake_next_month_clicked', { month: nextMonth.month, days: nextMonth.days }); setSelectedCake(nextMonth.cake); }}
      style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, background: 'var(--a-grad-pink)', boxShadow: 'none', cursor: 'pointer' }} initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.15 }}>
          {nextMonth.cake.image_url && <img src={nextMonth.cake.image_url} alt="" style={{ width: 74, height: 74, borderRadius: 14, objectFit: 'cover', flexShrink: 0, border: '2px solid #fff' }} />}
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="a-cta-badge" style={{ background: 'var(--a-chip-overlay)', color: 'var(--a-alert-ink)' }}>
              {nextMonth.days === 0 ? tr('cakesscreen_next_today', 'Bu gün') : tr('cakesscreen_next_days', '{n} gün qalıb').replace('{n}', String(nextMonth.days))}
            </span>
            <b style={{ display: 'block', fontSize: 15, fontWeight: 800, color: 'var(--a-alert-ink)', marginTop: 6, lineHeight: 1.25 }}>
              {nextMonth.month === 12 ?
            tr('cakesscreen_next_year', '{name} 1 yaşını qeyd edir').replace('{name}', nextMonth.name || tr('cakesscreen_baby', 'Körpəniz')) :
            tr('cakesscreen_next_month', '{name} {m} aylıq olur').replace('{name}', nextMonth.name || tr('cakesscreen_baby', 'Körpəniz')).replace('{m}', String(nextMonth.month))}
            </b>
            <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 12, fontWeight: 800, color: 'var(--a-alert-ink)', marginTop: 4 }}>
              {tr('cakesscreen_next_cta', 'Ay tortunu sifariş et')} · {nextMonth.cake.price}₼<ChevronRight className="rtl:rotate-180" size={14} />
            </span>
          </span>
        </motion.button> :
      activeFilter === 'all' &&
      <motion.div className="a-cta a-fade-in" style={{ background: 'var(--a-grad-pink)', marginTop: 14 }} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.15 }}>
          <span className="a-cta-shape" style={{ width: 120, height: 120, top: -40, insetInlineEnd: -30, background: 'rgba(255,255,255,0.35)' }} />
          <div className="relative z-10">
            <span className="a-cta-badge" style={{ background: 'var(--a-chip-overlay)', color: 'var(--a-alert-ink)' }}>🎂 {tr("cakesscreen_xususi_tortlar_ba1400", "Xüsusi Tortlar")}</span>
            <h3 className="a-cta-title a-heading" style={{ color: 'var(--a-alert-ink)', margin: '12px 0 6px', fontSize: 18 }}>{tr("cakesscreen_korpenizin_xususi_gunu_ucun_c2d99a", "Körpənizin xüsusi günü üçün!")}</h3>
            <p className="a-cta-text" style={{ color: 'color-mix(in srgb, var(--a-alert-ink) 75%, transparent)' }}>{tr("cakesscreen_her_ay_ve_milestone_ucun_unikal_dizaynla_39bdf9", "Hər ay və milestone üçün unikal dizaynlar")}</p>
          </div>
        </motion.div>
      }

      {/* Cakes: grouped by category in "Hamısı", one grid otherwise */}
      {activeFilter === 'all' && !searchQuery.trim() ?
      presentCategories.map((key) => {
        const list = cakes.filter((c) => categoryOf(c) === key);
        return (
          <section key={key} style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <p className="a-heading" style={{ margin: 0, fontSize: 16, color: 'var(--a-on-bg)' }}>{categoryLabel(key)}</p>
                  <p className="a-list-sub" style={{ margin: '2px 0 0', whiteSpace: 'normal' }}>{categorySub(key)}</p>
                </div>
                <button type="button" onClick={() => setActiveFilter(key)} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 12, fontWeight: 800, color: 'var(--a-accent-ink)', background: 'none', border: 0, cursor: 'pointer' }}>
                  {tr('cakesscreen_see_all_n', 'Hamısı · {n}').replace('{n}', String(list.length))}<ChevronRight className="rtl:rotate-180" size={14} />
                </button>
              </div>
              {renderGrid(key === 'month' ? list.slice(0, 4) : list)}
            </section>);
      }) :
      <motion.div style={{ marginTop: 6 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {typeof activeFilter === 'string' && activeFilter !== 'all' && <p className="a-list-sub" style={{ margin: '10px 0 0', whiteSpace: 'normal' }}>{categorySub(activeFilter)}</p>}
          {renderGrid(filteredCakes)}
        </motion.div>
      }

      {filteredCakes.length === 0 &&
      <motion.div className="a-card a-section text-center" style={{ padding: '36px 18px' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="text-6xl mb-4">🎂</div>
          <p className="a-list-sub" style={{ margin: 0 }}>{tr("cakesscreen_bu_kateqoriyada_tort_tapilmadi_330a9b", "Bu kateqoriyada tort tapılmadı")}</p>
        </motion.div>
      }
      </div>

      {/* Floating Cart Button - above BottomNav */}
      {totalItems > 0 &&
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={() => setShowCart(true)}
        className="fixed end-4 z-40 w-14 h-14 rounded-full flex items-center justify-center"
        style={{ bottom: 'calc(96px + env(safe-area-inset-bottom))', background: 'var(--a-peach-2)', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 14px 30px -10px rgba(255, 138, 76, 0.7)' }}>
        
          <ShoppingCart size={22} strokeWidth={2.2} />
          <span
          style={{
            position: 'absolute', top: -4, insetInlineEnd: -4, width: 22, height: 22, borderRadius: 999,
            background: 'var(--a-ink)', color: 'var(--a-bg)', fontSize: 11, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {totalItems}
          </span>
        </motion.button>
      }

      {/* Cart Drawer */}
      <CakeCartDrawer
        open={showCart}
        onClose={() => setShowCart(false)}
        onCheckout={() => {setShowCart(false);setShowCheckout(true);}} />
      
    </div>);

};

export default CakesScreen;