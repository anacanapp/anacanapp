import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Cake as CakeIcon, Search, Loader2, ShoppingBag, ShoppingCart } from 'lucide-react';
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
  label: `${getOrdinal(i + 1, language)} ay`,
  emoji: ['🎂', '🧁', '🎀', '🌸', '⭐', '🎈', '🌈', '🎪', '🎠', '🎡', '🎆', '🎊'][i]
}));

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

  const [activeFilter, setActiveFilter] = useState<'all' | 'milestone' | number>(initialMonth || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCake, setSelectedCake] = useState<Cake | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);

  // Tort detalı / checkout açılanda da yuxarıdan başla
  useScrollToTop([selectedCake, showCheckout]);

  const filteredCakes = useMemo(() => {
    let filtered = cakes;
    if (activeFilter === 'milestone') {
      filtered = filtered.filter((c) => c.category === 'milestone');
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
          <motion.button onClick={onBack} className="a3-icon-btn" whileTap={{ scale: 0.9 }}>
              <ArrowLeft className="rtl:rotate-180" size={20} strokeWidth={2} />
            </motion.button>
          }
          <div>
            <p className="a-eyebrow">{tr("cakesscreen_ayliq_milestone_tortlari_81907e", "Aylıq & Milestone tortları")}</p>
            <p className="a3-tool-title">{tr("untranslated_tortlar_go6yj8", "Tortlar 🎂")}</p>
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


      {/* Filters */}
      <motion.div className="a-tag-row hide-scrollbar" style={{ flexWrap: 'nowrap', overflowX: 'auto', marginBottom: 0, paddingBottom: 4 }} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
        <button onClick={() => setActiveFilter('all')} className={`a-tag${activeFilter === 'all' ? ' on' : ''}`} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
          {tr("cakesscreen_hamisi_a6c712", "\u2728 Ham\u0131s\u0131")}
        </button>
        {MONTHS.map((m) =>
        <button key={m.id} onClick={() => setActiveFilter(m.id)} className={`a-tag${activeFilter === m.id ? ' on' : ''}`} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
            {m.emoji} {m.label}
          </button>
        )}
        <button onClick={() => setActiveFilter('milestone')} className={`a-tag${activeFilter === 'milestone' ? ' on' : ''}`} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
          🏆 Milestone
        </button>
      </motion.div>

      {/* Banner (anacan-demo CTA) */}
      <motion.div className="a-cta a-fade-in" style={{ background: 'var(--a-grad-pink)', marginTop: 14 }} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }}>
        <span className="a-cta-shape" style={{ width: 120, height: 120, top: -40, insetInlineEnd: -30, background: 'rgba(255,255,255,0.35)' }} />
        <div className="relative z-10">
          <span className="a-cta-badge" style={{ background: 'var(--a-chip-overlay)', color: 'var(--a-alert-ink)' }}>🎂 {tr("cakesscreen_xususi_tortlar_ba1400", "Xüsusi Tortlar")}</span>
          <h3 className="a-cta-title a-heading" style={{ color: 'var(--a-alert-ink)', margin: '12px 0 6px', fontSize: 18 }}>{tr("cakesscreen_korpenizin_xususi_gunu_ucun_c2d99a", "Körpənizin xüsusi günü üçün!")}</h3>
          <p className="a-cta-text" style={{ color: 'color-mix(in srgb, var(--a-alert-ink) 75%, transparent)' }}>{tr("cakesscreen_her_ay_ve_milestone_ucun_unikal_dizaynla_39bdf9", "Hər ay və milestone üçün unikal dizaynlar")}</p>
        </div>
      </motion.div>

      {/* Cakes Grid */}
      <motion.div className="a-tool-grid" style={{ marginTop: 14 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
        {filteredCakes.map((cake, index) =>
        <motion.div
          key={cake.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(0.05 * index, 0.3) }}
          className="a-tool-tile"
          style={{ padding: 0, overflow: 'hidden' }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setSelectedCake(cake)}>
          
            {cake.image_url ?
          <div className="relative" style={{ height: 132 }}>
                <img src={cake.image_url} alt={cake.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                {cake.category === 'milestone' && cake.milestone_label &&
            <span className="a-cta-badge" style={{ position: 'absolute', top: 8, insetInlineStart: 8, padding: '3px 8px', fontSize: 9, background: 'var(--a-yellow-1)', color: 'var(--a-warn-ink)' }}>{cake.milestone_label}</span>
            }
                {cake.category === 'month' && cake.month_number &&
            <span className="a-cta-badge" style={{ position: 'absolute', top: 8, insetInlineStart: 8, padding: '3px 8px', fontSize: 9 }}>{tr(`common_month_label_${cake.month_number}`, `${getOrdinal(cake.month_number!, language)} ay`)}</span>
            }
              </div> :

          <div style={{ height: 132, background: 'var(--a-illus-grad)', display: 'grid', placeItems: 'center' }}>
                <CakeIcon size={40} style={{ color: 'var(--a-peach-2)', opacity: 0.6 }} />
              </div>
          }
            <div style={{ padding: 12 }}>
              <p className="a-tool-title" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 3 }}>{cake.name}</p>
              {cake.description && <p className="a-tool-sub" style={{ marginBottom: 8 }}>{cake.description}</p>}
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--a-accent-ink)' }}>{cake.price}₼</span>
                <motion.span className="a-trio-icon" style={{ margin: 0, width: 34, height: 34, background: 'var(--a-grad-peach)', color: 'var(--a-accent-ink)' }} whileTap={{ scale: 0.9 }}>
                  <ShoppingBag size={15} strokeWidth={2.2} />
                </motion.span>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>

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