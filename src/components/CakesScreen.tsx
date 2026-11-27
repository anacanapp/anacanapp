import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronRight, Plus, ShoppingBag, Truck, Gift, Check } from 'lucide-react';
import { addMonths, differenceInCalendarDays, parseISO } from 'date-fns';
import { useCakes, type Cake } from '@/hooks/useCakes';
import { useCakeCart } from '@/hooks/useCakeCart';
import { useChildren } from '@/hooks/useChildren';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics, trackEvent } from '@/hooks/useScreenAnalytics';
import { useToast } from '@/hooks/use-toast';
import CakeDetailScreen from '@/components/cakes/CakeDetailScreen';
import CakeCartDrawer from '@/components/cakes/CakeCartDrawer';
import CakeOrderForm from '@/components/cakes/CakeOrderForm';
import { CATEGORY_ORDER, categoryLabel, categoryOf, categoryShort, categorySub, canQuickAdd, money, type CakeCategoryKey } from '@/components/cakes/cakeUi';
import '@/components/cakes/cakes.css';
import { tr } from '@/lib/tr';
import { getOrdinal } from '@/lib/utils';
import { useUserStore } from '@/store/userStore';
import { useAuth } from '@/hooks/useAuth';
import { isCakesAvailable } from '@/lib/freemium';
import { QcProductBadge, QcSuccessNote, type QcOrderNote } from '@/components/qaygicash/QcParts';
import { toMinor } from '@/lib/qaygicash';

interface CakesScreenProps {
  onBack?: () => void;
  initialMonth?: number;
}

type CakeFilter = 'all' | CakeCategoryKey | number;
const PARTY_PACKAGE = 'party_package';

const monthLabel = (month: number, language: string) =>
  month === 12 ? tr('cakesscreen_one_year', '1 yaş') : tr(`common_month_label_${month}`, `${getOrdinal(month, language)} ay`);

const CakesScreen = ({ onBack, initialMonth }: CakesScreenProps) => {
  const language = useUserStore((s) => s.language);
  const storeCountryCode = useUserStore((s) => s.countryCode);
  const { profile, isAdmin } = useAuth();
  const { toast } = useToast();

  useScreenAnalytics('Cakes', 'Shop');

  // Müdafiə-dərinliyi: bu tool yalnız Azərbaycan üçündür (giriş nöqtəsindən asılı olmayaraq).
  // Hook qaydalarına görə yoxlama bütün hook çağırışlarından sonra, render-dən əvvəl tətbiq olunur.
  const cakesOk = isAdmin || isCakesAvailable((profile as any)?.country_code || storeCountryCode, language);
  const { cakes, loading } = useCakes();
  const { totalItems, addToCart } = useCakeCart();
  const { selectedChild, getChildAge } = useChildren();

  const [filter, setFilter] = useState<CakeFilter>(initialMonth || 'all');
  const [selectedCake, setSelectedCake] = useState<Cake | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [orderQc, setOrderQc] = useState<QcOrderNote | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  useScrollToTop([selectedCake, showCheckout, filter]);

  const present = useMemo(() => CATEGORY_ORDER.filter((key) => cakes.some((c) => categoryOf(c) === key)), [cakes]);
  const partyPackage = useMemo(() => cakes.find((c) => c.milestone_type === PARTY_PACKAGE) || null, [cakes]);

  const list = useMemo(() => {
    if (typeof filter === 'number') return cakes.filter((c) => c.category === 'month' && c.month_number === filter);
    if (filter === 'all') return cakes;
    return cakes.filter((c) => categoryOf(c) === filter);
  }, [cakes, filter]);

  // The child's next month birthday: the monthly cake for it and how many days are left.
  const nextMonth = useMemo(() => {
    if (!selectedChild?.birth_date) return null;
    const months = getChildAge(selectedChild)?.months ?? null;
    if (months === null || months < 0 || months >= 12) return null;
    const month = months + 1;
    const cake = cakes.find((c) => c.category === 'month' && c.month_number === month);
    if (!cake) return null;
    let days = 0;
    try { days = Math.max(0, differenceInCalendarDays(addMonths(parseISO(selectedChild.birth_date), month), new Date())); } catch { return null; }
    return { month, cake, days, name: (selectedChild.name as string | undefined) || tr('cakesscreen_baby', 'Körpəniz') };
  }, [selectedChild, getChildAge, cakes]);

  const open = (cake: Cake, source: string) => {
    trackEvent('cake_viewed', { cake_id: cake.id, category: cake.category, source });
    setSelectedCake(cake);
  };
  const quickAdd = (cake: Cake) => {
    if (!canQuickAdd(cake)) { open(cake, 'quick_add'); return; }
    addToCart(cake, 1, {});
    trackEvent('cake_added_to_cart', { cake_id: cake.id, category: cake.category, source: 'card', value: Number(cake.price) });
    setJustAdded(cake.id);
    window.setTimeout(() => setJustAdded((id) => (id === cake.id ? null : id)), 1400);
    toast({ title: tr('cakedetailscreen_sebete_elave_edildi_e0f576', 'Səbətə əlavə edildi! 🎂'), description: cake.name });
  };

  if (!cakesOk) return null;

  if (showOrderSuccess) {
    return (
      <div className="a-scope ck" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24, minHeight: '100vh' }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}
          style={{ width: 88, height: 88, borderRadius: 30, background: 'var(--a-coral)', color: '#fff', display: 'grid', placeItems: 'center', marginBottom: 22 }}>
          <Check size={44} strokeWidth={3} />
        </motion.div>
        <h2 className="ck-title" style={{ fontSize: 22 }}>{tr('cakesscreen_sifarisiniz_qebul_edildi_ae5b9e', 'Sifarişiniz qəbul edildi!')}</h2>
        <p className="ck-desc" style={{ margin: '8px 0 18px' }}>{tr('cakesscreen_tezlikle_sizinle_elaqe_saxlanilacaq_806311', 'Tezliklə sizinlə əlaqə saxlanılacaq')}</p>
        <QcSuccessNote note={orderQc} style={{ marginBottom: 18 }} />
        <button className="ck-cta" style={{ flex: 'none', width: '100%', maxWidth: 320 }} onClick={() => { setShowOrderSuccess(false); setOrderQc(null); setShowCheckout(false); setSelectedCake(null); }}>
          {tr('cakesscreen_tortlara_qayit_c533c2', 'Tortlara qayıt')}
        </button>
      </div>);
  }

  if (showCheckout) return <CakeOrderForm onBack={() => setShowCheckout(false)} onSuccess={(qc) => { setOrderQc(qc ?? null); setShowOrderSuccess(true); }} />;

  const cart = <CakeCartDrawer open={showCart} onClose={() => setShowCart(false)} onCheckout={() => { setShowCart(false); setShowCheckout(true); }} />;

  if (selectedCake) {
    return (
      <>
        <CakeDetailScreen cake={selectedCake} onBack={() => setSelectedCake(null)} onOpenCart={() => setShowCart(true)} />
        {cart}
      </>);
  }

  const card = (cake: Cake) =>
  <div key={cake.id} className="ck-card">
      <button type="button" className="ck-card-open" onClick={() => open(cake, 'card')} aria-label={cake.name}>
        {cake.image_url ? <img className="ck-card-img" src={cake.image_url} alt="" loading="lazy" decoding="async" /> : <span className="ck-card-img" style={{ display: 'block' }} />}
        <span className="ck-card-tag">{cake.category === 'month' && cake.month_number ? monthLabel(cake.month_number, language) : cake.milestone_label || categoryShort(categoryOf(cake))}</span>
      </button>
      <div className="ck-card-body">
        <p className="ck-card-name">{cake.name}</p>
        <QcProductBadge channel="cake" priceMinor={toMinor(Number(cake.price))} style={{ alignSelf: 'flex-start' }} />
        <div className="ck-card-foot">
          <span className="ck-price">{money(Number(cake.price))}</span>
          <button type="button" className="ck-add" onClick={() => quickAdd(cake)} aria-label={tr('cakesscreen_add_to_cart', 'Səbətə əlavə et')}>
            {justAdded === cake.id ? <Check size={16} strokeWidth={3} /> : <Plus size={17} strokeWidth={2.6} />}
          </button>
        </div>
      </div>
    </div>;

  const monthMode = filter === 'month' || typeof filter === 'number';

  return (
    <div className="a-scope ck overflow-y-auto" style={{ paddingBottom: 140 }}>
      <header className="ck-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {onBack &&
          <button type="button" className="ck-iconbtn" onClick={onBack} aria-label={tr('common_back', 'Geri')}>
              <ArrowLeft className="rtl:rotate-180" size={18} strokeWidth={2.2} />
            </button>
          }
          <div style={{ minWidth: 0 }}>
            <p className="ck-eyebrow">{tr('cakesscreen_eyebrow_brand', 'Anacan tortları')}</p>
            <h1 className="ck-title">{tr('cakesscreen_title_v3', 'Hər ayın tortu')}</h1>
          </div>
        </div>
        <button type="button" className="ck-iconbtn" onClick={() => setShowCart(true)} aria-label={tr('cakesscreen_cart', 'Səbət')}>
          <ShoppingBag size={19} strokeWidth={2.1} />
          {totalItems > 0 && <span className="ck-badge">{totalItems}</span>}
        </button>
      </header>

      {loading ?
      <div className="ck-pad" style={{ display: 'grid', gap: 12 }}>
          <div className="ck-hero" style={{ cursor: 'default' }} />
          <div className="ck-grid" style={{ padding: 0 }}>{[0, 1, 2, 3].map((i) => <div key={i} className="ck-card" style={{ aspectRatio: '3 / 4' }} />)}</div>
        </div> :
      <>
          {filter === 'all' && nextMonth &&
        <div className="ck-pad">
              <button type="button" className="ck-hero" onClick={() => { trackEvent('cake_next_month_clicked', { month: nextMonth.month, days: nextMonth.days }); open(nextMonth.cake, 'next_month'); }}>
                {nextMonth.cake.image_url && <img src={nextMonth.cake.image_url} alt="" />}
                <span className="ck-hero-shade">
                  <span className="ck-hero-pill">{nextMonth.days === 0 ? tr('cakesscreen_next_today', 'Bu gün') : tr('cakesscreen_next_days', '{n} gün qalıb').replace('{n}', String(nextMonth.days))}</span>
                  <span className="ck-hero-title">
                    {nextMonth.month === 12 ?
                tr('cakesscreen_next_year', '{name} 1 yaşını qeyd edir').replace('{name}', nextMonth.name) :
                tr('cakesscreen_next_month', '{name} {m} aylıq olur').replace('{name}', nextMonth.name).replace('{m}', String(nextMonth.month))}
                  </span>
                  <span className="ck-hero-row">
                    <span style={{ opacity: 0.92 }}>{nextMonth.cake.name} · {money(Number(nextMonth.cake.price))}</span>
                    <span className="ck-hero-cta">{tr('cakesscreen_order_now', 'Sifariş et')}</span>
                  </span>
                </span>
              </button>
            </div>
        }

          <nav className="ck-chips" aria-label={tr('cakesscreen_categories', 'Kateqoriyalar')}>
            <button type="button" className={`ck-chip${filter === 'all' ? ' on' : ''}`} onClick={() => setFilter('all')}>{tr('cakesscreen_hamisi_plain', 'Hamısı')}</button>
            {present.map((key) =>
          <button key={key} type="button" className={`ck-chip${filter === key || key === 'month' && typeof filter === 'number' ? ' on' : ''}`} onClick={() => setFilter(key)}>{categoryShort(key)}</button>
          )}
          </nav>
          {monthMode &&
        <div className="ck-chips" style={{ paddingTop: 8 }}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) =>
          <button key={m} type="button" className={`ck-chip sm${filter === m ? ' on' : ''}`} onClick={() => setFilter(filter === m ? 'month' : m)}>{monthLabel(m, language)}</button>
          )}
            </div>
        }

          {filter === 'all' && partyPackage &&
        <button type="button" className="ck-promo" onClick={() => open(partyPackage, 'promo')}>
              {partyPackage.image_url ? <img src={partyPackage.image_url} alt="" /> : <Gift size={28} />}
              <span style={{ flex: 1, minWidth: 0 }}>
                <b>{partyPackage.name} · {money(Number(partyPackage.price))}</b>
                <span>{tr('cakesscreen_party_sub', '2 kq tort, smash cake, 6 kapkeyk, topper')}</span>
              </span>
              <ChevronRight className="rtl:rotate-180" size={18} style={{ color: 'var(--a-coral-text)' }} />
            </button>
        }

          {filter === 'all' ?
        present.map((key) => {
          const items = cakes.filter((c) => categoryOf(c) === key);
          return (
            <section key={key}>
                  <div className="ck-head">
                    <div style={{ minWidth: 0 }}><h3>{categoryLabel(key)}</h3><p>{categorySub(key)}</p></div>
                    <button type="button" className="ck-link" onClick={() => setFilter(key)}>{tr('cakesscreen_see_all_n', 'Hamısı · {n}').replace('{n}', String(items.length))}<ChevronRight className="rtl:rotate-180" size={15} /></button>
                  </div>
                  <div className="ck-rail">{items.map(card)}</div>
                </section>);
        }) :
        <>
              {typeof filter === 'string' && <div className="ck-head" style={{ paddingBottom: 6 }}><div><h3>{categoryLabel(filter)}</h3><p>{categorySub(filter)}</p></div></div>}
              {list.length ? <div className="ck-grid" style={{ paddingTop: typeof filter === 'number' ? 14 : 4 }}>{list.map(card)}</div> :
          <div className="ck-empty">{tr('cakesscreen_bu_kateqoriyada_tort_tapilmadi_330a9b', 'Bu kateqoriyada tort tapılmadı')}</div>}
            </>
        }

          <p className="ck-note"><Truck size={16} strokeWidth={2} />{tr('cakesscreen_delivery_note', 'Bakı daxili çatdırılma · sifariş ən azı 48 saat qabaqcadan')}</p>
        </>
      }

      {totalItems > 0 &&
      <div className="ck-bar">
          <button type="button" className="ck-cta" onClick={() => setShowCart(true)}>
            <ShoppingBag size={18} strokeWidth={2.2} />
            {tr('cakesscreen_view_cart', 'Səbətə bax')} · {totalItems}
          </button>
        </div>
      }
      {cart}
    </div>);
};

export default CakesScreen;
