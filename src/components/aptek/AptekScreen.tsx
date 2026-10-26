import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search, ShoppingBag, Package, ChevronRight, Truck, Banknote, CreditCard, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useChildren } from '@/hooks/useChildren';
import { useUserStore } from '@/store/userStore';
import { pushBackHandler } from '@/lib/backButton';
import { hapticFeedback } from '@/lib/native';
import { confetti } from '@/lib/celebrate';
import { ap, formatAzn, type AptekKey } from '@/lib/aptek-i18n';
import { couponProblem, type AptekCoupon } from '@/lib/aptek-pricing';
import {
  aptekErrorKey, fetchAptekCoupon, useAptekAvailable, useAptekCart, useAptekOrders, useAptekProducts, useAptekTotals,
  usePlaceAptekOrder, type AptekProduct,
} from '@/hooks/useAptek';
import { Mascot } from '@/components/anacan/Mascot';
import { rd } from '@/lib/redesign-i18n';
import { BundleCard, ProductCard, QtyStepper, ageLabel, discountPct } from './AptekParts';

type View =
  | { name: 'home' }
  | { name: 'list'; kind?: string; query?: string; deals?: boolean }
  | { name: 'product'; id: string }
  | { name: 'cart' }
  | { name: 'checkout' }
  | { name: 'success'; number: string }
  | { name: 'orders' };

const KINDS = ['bottles', 'cups', 'bowls', 'cutlery', 'appliances', 'food'] as const;
const RECENT_KEY = 'anacan-aptek-recent';
const CHECKOUT_KEY = 'anacan-aptek-checkout';

const readJson = <T,>(key: string, fallback: T): T => {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
};
const writeJson = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* optional */ } };

export function initialAptekView(screen?: string | null): View {
  const sub = screen?.split('/')[1];
  if (sub === 'cart') return { name: 'cart' };
  if (sub === 'orders') return { name: 'orders' };
  if (sub?.startsWith('p:')) return { name: 'product', id: sub.slice(2) };
  return { name: 'home' };
}

export default function AptekScreen({ onBack, initialScreen }: { onBack: () => void; initialScreen?: string | null }) {
  const [stack, setStack] = useState<View[]>(() => {
    const first = initialAptekView(initialScreen);
    return first.name === 'home' ? [first] : [{ name: 'home' }, first];
  });
  const view = stack[stack.length - 1];
  const push = (v: View) => { setStack((s) => [...s, v]); };
  const pop = () => { if (stack.length > 1) setStack((s) => s.slice(0, -1)); else onBack(); };
  const reset = (v: View) => setStack(v.name === 'home' ? [v] : [{ name: 'home' }, v]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => pushBackHandler(() => { pop(); return true; }), [stack.length]);
  useEffect(() => { document.querySelector('[data-scroll-container]')?.scrollTo({ top: 0 }); }, [stack.length, view.name]);

  const { isAdmin } = useAuth();
  const { available, config } = useAptekAvailable();
  const { data: products = [], isLoading } = useAptekProducts(available);
  const cart = useAptekCart();
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const openProduct = (p: AptekProduct) => {
    const recent = readJson<string[]>(RECENT_KEY, []).filter((id) => id !== p.id);
    writeJson(RECENT_KEY, [p.id, ...recent].slice(0, 12));
    push({ name: 'product', id: p.id });
  };
  const setQty = (id: string, n: number) => {
    const wasEmpty = cart.quantityOf(id) === 0;
    cart.setQuantity(id, n).catch(() => toast.error(ap('err_generic')));
    if (wasEmpty && n > 0) toast.success(ap('added'), { duration: 1500 });
  };
  const addBundle = (skus: string[]) => {
    void hapticFeedback.medium();
    for (const sku of skus) {
      const p = products.find((x) => x.sku === sku);
      if (p && cart.quantityOf(p.id) === 0) cart.setQuantity(p.id, 1).catch(() => toast.error(ap('err_generic')));
    }
    toast.success(ap('added'), { duration: 1500 });
  };

  if (!available) {
    return (
      <Shell title={ap('title')} onBack={onBack}>
        <div className="a3-empty" style={{ paddingTop: 48 }}>
          <Mascot stage="mommy" pose="mode" width={110} />
          <p style={{ fontWeight: 700, margin: 0 }}>{ap('err_disabled')}</p>
        </div>
      </Shell>
    );
  }

  const cartButton = (
    <button type="button" className="a3-icon-btn" onClick={() => push({ name: 'cart' })} aria-label={ap('cart_n', { n: cart.count })}>
      <ShoppingBag size={19} />
      {cart.count > 0 && <span className="a3-count a3-num">{cart.count > 99 ? '99+' : cart.count}</span>}
    </button>
  );
  const common = { products, byId, cart, config, openProduct, setQty, addBundle, push, pop };

  return (
    <Shell
      title={view.name === 'cart' ? ap('cart_title') : view.name === 'checkout' ? ap('checkout') : view.name === 'orders' ? ap('my_orders') : ap('title')}
      onBack={pop}
      actions={view.name === 'cart' || view.name === 'checkout' || view.name === 'success' ? undefined : cartButton}
    >
      {isAdmin && !config?.enabled && <p className="ap-note" style={{ marginBottom: 12 }}><Info size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> {ap('admin_preview')}</p>}
      {isLoading && <div className="ap-grid" aria-busy="true">{[0, 1, 2, 3].map((i) => <div key={i} className="ap-card" style={{ height: 250, opacity: 0.5 }} />)}</div>}
      {!isLoading && view.name === 'home' && <StoreHome {...common} />}
      {!isLoading && view.name === 'list' && <ProductList {...common} initial={view} />}
      {!isLoading && view.name === 'product' && <ProductPage {...common} id={view.id} />}
      {view.name === 'cart' && <CartView {...common} onCheckout={() => push({ name: 'checkout' })} />}
      {view.name === 'checkout' && <CheckoutView {...common} onDone={(number) => { confetti(); reset({ name: 'success', number }); }} />}
      {view.name === 'success' && <SuccessView number={view.number} onOrders={() => reset({ name: 'orders' })} onHome={() => reset({ name: 'home' })} />}
      {view.name === 'orders' && <OrdersView byId={byId} />}
    </Shell>
  );
}

function Shell({ title, onBack, actions, children }: {
  title: string; onBack: () => void; actions?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="a-scope a3-enter" style={{ background: 'var(--a-bg)', minHeight: '100%' }}>
      <div className="a-shell" style={{ paddingBottom: 24 }}>
        <header className="a3-topbar">
          <button type="button" className="a3-icon-btn" onClick={onBack} aria-label={rd('back')}>
            <ArrowLeft size={18} className="rtl:rotate-180" />
          </button>
          <h1 className="a3-page-title" style={{ flex: 1, fontSize: 22, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h1>
          {actions}
        </header>
        {children}
      </div>
    </div>
  );
}

type Common = {
  products: AptekProduct[];
  byId: Map<string, AptekProduct>;
  cart: ReturnType<typeof useAptekCart>;
  config: ReturnType<typeof useAptekAvailable>['config'];
  openProduct: (p: AptekProduct) => void;
  setQty: (id: string, n: number) => void;
  addBundle: (skus: string[]) => void;
  push: (v: View) => void;
  pop: () => void;
};

function Rail({ title, items, c, onMore }: { title: string; items: AptekProduct[]; c: Common; onMore?: () => void }) {
  if (!items.length) return null;
  return (
    <section className="a3-sec">
      <div className="a3-sec-head">
        <h2 className="a3-sec-title">{title}</h2>
        {onMore && <button type="button" className="a3-link" onClick={onMore}>{ap('filter_all')} <ChevronRight size={14} className="rtl:rotate-180" /></button>}
      </div>
      <div className="a3-rail">
        {items.map((p) => <ProductCard key={p.id} variant="rail" product={p} qty={c.cart.quantityOf(p.id)} onOpen={() => c.openProduct(p)} onQty={(n) => c.setQty(p.id, n)} />)}
      </div>
    </section>
  );
}

function StoreHome(c: Common) {
  const [q, setQ] = useState('');
  const deals = c.products.filter((p) => discountPct(p) > 0);
  const recent = readJson<string[]>(RECENT_KEY, []).map((id) => c.byId.get(id)).filter((p): p is AptekProduct => !!p);
  const pct = c.config?.bundle_discount_pct ?? 10;
  return (
    <>
      <form className="a3-search" role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) c.push({ name: 'list', query: q.trim() }); }}>
        <Search size={18} aria-hidden="true" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={ap('search_placeholder')} aria-label={ap('search_placeholder')} enterKeyHint="search" />
      </form>

      <div className="ap-banner" role="presentation">
        <span className="ap-banner-txt">
          <span className="a3-eyebrow">{ap('with_partner')}</span>
          <b>{ap('hero_title')}</b>
          <span className="a3-meta">{ap('hero_meta', { n: c.products.length, free: c.config?.free_shipping_min ?? 30 })}</span>
        </span>
        <Mascot stage="mommy" pose="mode" width={92} />
      </div>

      <section className="a3-sec">
        <div className="a3-sec-head"><h2 className="a3-sec-title">{ap('categories')}</h2></div>
        <div className="ap-kinds">
          {KINDS.filter((k) => c.products.some((p) => p.kind === k)).map((k, i) => {
            const first = c.products.find((p) => p.kind === k);
            return (
              <button key={k} type="button" className="ap-kind" onClick={() => c.push({ name: 'list', kind: k })}>
                <span className={`a3-ico-sq sm ${['c-blue', 'c-green', 'c-peach', 'c-lav', 'c-yellow', 'c-pink'][i % 6]}`} style={{ overflow: 'hidden', padding: 3 }}>
                  {first?.images[0] && <img src={first.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
                </span>
                <span>{ap(`kind_${k}` as AptekKey)}</span>
                <small className="a3-num">{c.products.filter((p) => p.kind === k).length}</small>
              </button>
            );
          })}
        </div>
      </section>

      {!!c.config?.bundles.length && (
        <section className="a3-sec">
          <div className="a3-sec-head"><h2 className="a3-sec-title">{ap('bundles_title')}</h2><span className="a3-chip ac a3-num">−{pct}%</span></div>
          <div className="a3-rail">
            {c.config.bundles.map((b) => (
              <BundleCard key={b.id} wide bundle={b} products={c.products} pct={pct} inCart={(id) => c.cart.quantityOf(id) > 0}
                onAddAll={() => c.addBundle(b.skus)} onOpenProduct={c.openProduct} />
            ))}
          </div>
        </section>
      )}

      <Rail title={ap('bestsellers')} items={c.products.slice(0, 10)} c={c} onMore={() => c.push({ name: 'list' })} />
      <Rail title={ap('deals')} items={deals.slice(0, 10)} c={c} onMore={() => c.push({ name: 'list', deals: true })} />
      <Rail title={ap('recently_viewed')} items={recent} c={c} />

      <section className="a3-sec">
        <button type="button" className="a3-card a3-pad a3-li" style={{ border: 0, width: '100%', flexDirection: 'row' }} onClick={() => c.push({ name: 'orders' })}>
          <span className="a3-ico-sq sm c-peach"><Package size={16} /></span>
          <span className="grow" style={{ textAlign: 'start', fontWeight: 600 }}>{ap('my_orders')}</span>
          <ChevronRight size={16} className="rtl:rotate-180" />
        </button>
      </section>
      <p className="a3-meta" style={{ textAlign: 'center', marginTop: 16 }}>{ap('source_note')}</p>
    </>
  );
}

function ProductList(c: Common & { initial: { kind?: string; query?: string; deals?: boolean } }) {
  const { selectedChild, getChildAge } = useChildren();
  const lifeStage = useUserStore((s) => s.lifeStage);
  const months = lifeStage === 'mommy' && selectedChild ? getChildAge(selectedChild)?.months ?? null : null;
  const [kind, setKind] = useState<string>(c.initial.kind || 'all');
  const [query, setQuery] = useState(c.initial.query || '');
  const [anti, setAnti] = useState(false);
  const [forAge, setForAge] = useState(false);
  const [sort, setSort] = useState<'pop' | 'asc' | 'desc'>('pop');
  const fold = (v: string) => v.toLocaleLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const list = useMemo(() => {
    const q = fold(query.trim());
    const r = c.products.filter((p) => (kind === 'all' || p.kind === kind)
      && (!c.initial.deals || discountPct(p) > 0)
      && (!anti || p.tags.includes('anti_colic'))
      && (!forAge || months == null || p.min_age_months == null || p.min_age_months <= months)
      && (!q || fold(`${p.name} ${p.brand || ''}`).includes(q)));
    if (sort === 'asc') r.sort((a, b) => a.price - b.price);
    if (sort === 'desc') r.sort((a, b) => b.price - a.price);
    return r;
  }, [c.products, kind, anti, forAge, months, query, sort, c.initial.deals]);

  return (
    <>
      <form className="a3-search" role="search" onSubmit={(e) => e.preventDefault()}>
        <Search size={18} aria-hidden="true" />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={ap('search_placeholder')} aria-label={ap('search_placeholder')} />
      </form>
      <div className="a3-chips hide-scrollbar" style={{ marginTop: 0 }}>
        {(['all', ...KINDS.filter((k) => c.products.some((p) => p.kind === k))] as string[]).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} className={`a3-chip-btn${kind === k ? ' on' : ''}`} onClick={() => setKind(k)}>
            {k === 'all' ? ap('filter_all') : ap(`kind_${k}` as AptekKey)}
          </button>
        ))}
      </div>
      <div className="a3-chips hide-scrollbar" style={{ marginTop: 8 }}>
        <button type="button" aria-pressed={anti} className={`a3-chip-btn${anti ? ' on' : ''}`} onClick={() => setAnti(!anti)}>{ap('filter_anti')}</button>
        {months != null && <button type="button" aria-pressed={forAge} className={`a3-chip-btn${forAge ? ' on' : ''}`} onClick={() => setForAge(!forAge)}>{ap('filter_age')}</button>}
        <label className="a3-chip-btn" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <span className="sr-only-a3">{ap('sort_pop')}</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} style={{ border: 0, background: 'transparent', color: 'inherit', font: 'inherit' }}>
            <option value="pop">{ap('sort_pop')}</option>
            <option value="asc">{ap('sort_price_asc')}</option>
            <option value="desc">{ap('sort_price_desc')}</option>
          </select>
        </label>
      </div>
      <p className="a3-meta" style={{ margin: '12px 0 8px' }}>{ap('products_n', { n: list.length })}</p>
      {list.length
        ? <div className="ap-grid">{list.map((p) => <ProductCard key={p.id} product={p} qty={c.cart.quantityOf(p.id)} onOpen={() => c.openProduct(p)} onQty={(n) => c.setQty(p.id, n)} />)}</div>
        : <p className="a3-empty">{ap('nothing_found')}</p>}
    </>
  );
}

function ProductPage(c: Common & { id: string }) {
  const p = c.byId.get(c.id);
  const [slide, setSlide] = useState(0);
  const [qty, setQty] = useState(1);
  if (!p) return <p className="a3-empty">{ap('nothing_found')}</p>;
  const off = discountPct(p);
  const inCart = c.cart.quantityOf(p.id);
  const bundle = c.config?.bundles.find((b) => p.sku && b.skus.includes(p.sku));
  const similar = c.products.filter((x) => x.id !== p.id && x.kind === p.kind).slice(0, 8);
  const isFormula = p.tags.includes('infant_formula');
  return (
    <>
      <div className="ap-gallery-wrap">
        <div className="ap-gallery" onScroll={(e) => { const el = e.currentTarget; setSlide(Math.round(Math.abs(el.scrollLeft) / el.clientWidth)); }}>
          {p.images.map((src) => <img key={src} src={src} alt={p.name} decoding="async" />)}
        </div>
        {off > 0 && <span className="ap-off a3-num" style={{ top: 14, insetInlineStart: 14, fontSize: 13 }}>−{off}%</span>}
        {p.images.length > 1 && <div className="ap-dots" aria-hidden="true">{p.images.map((s, i) => <i key={s} className={i === slide ? 'on' : undefined} />)}</div>}
      </div>
      <section className="a3-sec" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {p.brand && <p className="a3-eyebrow" style={{ margin: 0 }}>{p.brand}</p>}
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>{p.name}</h2>
        <p className="ap-pd-price a3-num"><b>{formatAzn(p.price)}</b>{off > 0 && p.original_price && <s>{formatAzn(p.original_price)}</s>}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <span className="a3-chip">{ap('age')}: {ageLabel(p.min_age_months)}</span>
          {p.volume && <span className="a3-chip">{ap('volume')}: {p.volume}</span>}
          {p.tags.includes('anti_colic') && <span className="a3-chip ok">{ap('filter_anti')}</span>}
          {p.sales_count > 0 && <span className="a3-chip a3-num">{ap('sold_n', { n: p.sales_count })}</span>}
        </div>
        {isFormula && <p className="ap-note">{ap('formula_note')}</p>}
        {p.description && <p style={{ margin: 0, lineHeight: 1.55 }}>{p.description}</p>}
      </section>
      {bundle && (
        <section className="a3-sec">
          <div className="a3-sec-head"><h2 className="a3-sec-title">{ap('bought_together')}</h2></div>
          <BundleCard bundle={bundle} products={c.products} pct={c.config?.bundle_discount_pct ?? 10} inCart={(id) => c.cart.quantityOf(id) > 0}
            onAddAll={() => c.addBundle(bundle.skus)} onOpenProduct={c.openProduct} />
        </section>
      )}
      <Rail title={ap(`kind_${p.kind || 'bottles'}` as AptekKey)} items={similar} c={c} />
      <div className="ap-bar">
        {inCart > 0
          ? <>
              <QtyStepper value={inCart} onChange={(n) => c.setQty(p.id, n)} />
              <button type="button" className="a3-btn accent" style={{ flex: 1 }} onClick={() => c.push({ name: 'cart' })}>{ap('cart_n', { n: c.cart.count })}</button>
            </>
          : <>
              <QtyStepper value={qty} onChange={(n) => setQty(Math.max(1, n))} />
              <button type="button" className="a3-btn accent" style={{ flex: 1 }} onClick={() => { void hapticFeedback.medium(); c.setQty(p.id, qty); }}>
                <ShoppingBag size={18} />{ap('add_to_cart')} · {formatAzn(p.price * qty)}
              </button>
            </>}
      </div>
    </>
  );
}

function useCoupon() {
  const [code, setCode] = useState<string>(() => readJson<{ coupon?: string }>(CHECKOUT_KEY, {}).coupon || '');
  const [coupon, setCoupon] = useState<AptekCoupon | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apply = async (subtotal: number) => {
    const found = await fetchAptekCoupon(code);
    const problem = couponProblem(found, subtotal);
    setError(problem); setCoupon(problem ? null : found);
    if (!problem) { void hapticFeedback.medium(); writeJson(CHECKOUT_KEY, { ...readJson(CHECKOUT_KEY, {}), coupon: code.trim().toUpperCase() }); }
  };
  return { code, setCode, coupon, error, apply, clear: () => { setCoupon(null); setError(null); } };
}

function Summary({ totals }: { totals: ReturnType<typeof useAptekTotals> }) {
  return (
    <div className="ap-sum a3-num">
      <div><span>{ap('subtotal')}</span><b>{formatAzn(totals.subtotal)}</b></div>
      {totals.bundleDiscount > 0 && <div className="ok"><span>{ap('bundle_discount')}</span><b>−{formatAzn(totals.bundleDiscount)}</b></div>}
      {totals.couponDiscount > 0 && <div className="ok"><span>{ap('coupon_discount')}</span><b>−{formatAzn(totals.couponDiscount)}</b></div>}
      <div><span>{ap('shipping')}</span><b>{totals.shipping ? formatAzn(totals.shipping) : ap('free')}</b></div>
      <div className="total"><span>{ap('total')}</span><b>{formatAzn(totals.total)}</b></div>
    </div>
  );
}

// Coupon state is shared between cart and checkout through a module-level holder.
let sharedCoupon: AptekCoupon | null = null;

function CartView(c: Common & { onCheckout: () => void }) {
  const cp = useCoupon();
  const totals = useAptekTotals(c.cart.lines, cp.coupon);
  const free = c.config?.free_shipping_min ?? 30;
  useEffect(() => { sharedCoupon = cp.coupon; }, [cp.coupon]);
  if (!c.cart.lines.length) {
    return (
      <div className="a3-empty" style={{ paddingTop: 40 }}>
        <Mascot stage="mommy" pose="mode" width={110} />
        <p style={{ fontWeight: 700, margin: 0 }}>{ap('cart_empty')}</p>
        <p className="a3-meta" style={{ margin: 0 }}>{ap('cart_empty_sub')}</p>
        <button type="button" className="a3-btn accent" onClick={() => c.push({ name: 'list' })}>{ap('go_shopping')}</button>
      </div>
    );
  }
  return (
    <>
      <div className="a3-card a3-pad" style={{ gap: 8 }}>
        <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
          <Truck size={16} />{totals.toFreeShipping > 0 ? ap('to_free', { amount: formatAzn(totals.toFreeShipping) }) : ap('free_reached')}
        </p>
        <div className="ap-meter"><i style={{ width: `${Math.min(100, ((free - totals.toFreeShipping) / free) * 100)}%` }} /></div>
      </div>
      <section className="a3-sec">
        <div className="a3-card a3-pad" style={{ paddingBlock: 0 }}>
          {c.cart.lines.map((l) => (
            <div key={l.id} className="ap-line">
              <button type="button" className="ap-thumb" onClick={() => c.openProduct(l.product)} aria-label={l.product.name}>
                {l.product.images[0] && <img src={l.product.images[0]} alt="" />}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="ap-name" style={{ minHeight: 0 }}>{l.product.name}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
                  <QtyStepper small value={l.quantity} onChange={(n) => c.setQty(l.product_id, n)} />
                  <b className="a3-num">{formatAzn(l.product.price * l.quantity)}</b>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="a3-sec">
        <form className="a3-search" style={{ paddingInlineEnd: 4, marginBottom: 6 }} onSubmit={(e) => { e.preventDefault(); void cp.apply(totals.subtotal); }}>
          <input value={cp.code} onChange={(e) => { cp.setCode(e.target.value); cp.clear(); }} placeholder={ap('coupon_placeholder')} aria-label={ap('coupon_placeholder')} autoCapitalize="characters" />
          <button type="submit" className="a3-btn sm soft" disabled={!cp.code.trim()}>{ap('apply')}</button>
        </form>
        {cp.error && <p className="a3-meta" role="alert" style={{ color: 'var(--a-bad)', margin: '0 0 8px' }}>{ap(cp.error as AptekKey)}</p>}
        {cp.coupon && <p className="a3-meta" style={{ color: 'var(--a-green-ink)', margin: '0 0 8px' }}>{ap('coupon_applied', { code: cp.coupon.code })}</p>}
        <div className="a3-card a3-pad"><Summary totals={totals} /></div>
      </section>
      <div className="ap-bar">
        <button type="button" className="a3-btn accent block" onClick={c.onCheckout}>{ap('checkout')} · {formatAzn(totals.total)}</button>
      </div>
    </>
  );
}

function CheckoutView(c: Common & { onDone: (orderNumber: string) => void }) {
  const { profile } = useAuth();
  const saved = readJson<{ address?: string; phone?: string; name?: string; coupon?: string }>(CHECKOUT_KEY, {});
  const [address, setAddress] = useState(saved.address || '');
  const [phone, setPhone] = useState(saved.phone || (profile as { phone?: string } | null)?.phone || '');
  const [name, setName] = useState(saved.name || (profile as { name?: string } | null)?.name || '');
  const [notes, setNotes] = useState('');
  const slots = c.config?.slots || [];
  const [slot, setSlot] = useState<string>(slots[0] || '');
  const [payment, setPayment] = useState<'cash' | 'card_on_delivery'>('card_on_delivery');
  const [touched, setTouched] = useState(false);
  const totals = useAptekTotals(c.cart.lines, sharedCoupon);
  const place = usePlaceAptekOrder();
  const phoneOk = /^\+?[0-9][0-9 ()-]{6,19}$/.test(phone.trim());
  const addressOk = address.trim().length >= 5;

  const submit = async () => {
    setTouched(true);
    if (!phoneOk || !addressOk || !slot || !c.cart.lines.length) return;
    writeJson(CHECKOUT_KEY, { ...saved, address: address.trim(), phone: phone.trim(), name: name.trim() });
    try {
      const res = await place.mutateAsync({
        items: c.cart.lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity })),
        coupon: sharedCoupon?.code || null, slot, payment,
        address: { line: address.trim(), ...(name.trim() ? { name: name.trim() } : {}) }, phone: phone.trim(), notes: notes.trim() || undefined,
      });
      sharedCoupon = null;
      writeJson(CHECKOUT_KEY, { address: address.trim(), phone: phone.trim(), name: name.trim() });
      c.onDone(res.order_number);
    } catch (e) {
      toast.error(ap(aptekErrorKey(e) as AptekKey));
    }
  };

  return (
    <>
      <section className="a3-sec" style={{ marginTop: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 className="a3-sec-title">{ap('address_title')}</h2>
        <label className="ap-field"><span>{ap('address_title')}</span>
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder={ap('address_placeholder')} autoComplete="street-address" aria-invalid={touched && !addressOk} />
        </label>
        <label className="ap-field"><span>{ap('name_label')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </label>
        <label className="ap-field"><span>{ap('phone_label')}</span>
          <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+994 50 000 00 00" autoComplete="tel" aria-invalid={touched && !phoneOk} />
        </label>
        {touched && !phoneOk && <p className="a3-meta" role="alert" style={{ color: 'var(--a-bad)', margin: 0 }}>{ap('err_phone')}</p>}
        {touched && !addressOk && <p className="a3-meta" role="alert" style={{ color: 'var(--a-bad)', margin: 0 }}>{ap('err_address')}</p>}
      </section>
      <section className="a3-sec">
        <h2 className="a3-sec-title" style={{ marginBottom: 10 }}>{ap('slot_title')}</h2>
        <div className="ap-slots" role="radiogroup" aria-label={ap('slot_title')}>
          {slots.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={slot === s} className="ap-slot" onClick={() => setSlot(s)}>{ap(`slot_${s}` as AptekKey)}</button>
          ))}
        </div>
      </section>
      <section className="a3-sec">
        <h2 className="a3-sec-title" style={{ marginBottom: 10 }}>{ap('payment_title')}</h2>
        <div className="ap-slots" role="radiogroup" aria-label={ap('payment_title')}>
          <button type="button" role="radio" aria-checked={payment === 'card_on_delivery'} className="ap-slot" onClick={() => setPayment('card_on_delivery')}><CreditCard size={18} />{ap('pay_card')}</button>
          <button type="button" role="radio" aria-checked={payment === 'cash'} className="ap-slot" onClick={() => setPayment('cash')}><Banknote size={18} />{ap('pay_cash')}</button>
        </div>
        <label className="ap-field" style={{ marginTop: 12 }}><span className="sr-only-a3">{ap('notes_placeholder')}</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 500))} placeholder={ap('notes_placeholder')} />
        </label>
      </section>
      <section className="a3-sec"><div className="a3-card a3-pad"><Summary totals={totals} /></div></section>
      <div className="ap-bar">
        <button type="button" className="a3-btn accent block" onClick={() => void submit()} disabled={place.isPending || !c.cart.lines.length}>
          {place.isPending ? ap('placing') : ap('place_order', { amount: formatAzn(totals.total) })}
        </button>
      </div>
    </>
  );
}

function SuccessView({ number, onOrders, onHome }: { number: string; onOrders: () => void; onHome: () => void }) {
  return (
    <div className="a3-empty" style={{ paddingTop: 40, gap: 10 }}>
      <Mascot stage="mommy" pose="welcome" width={130} bob />
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{ap('success_title')}</h2>
      <p className="a3-meta" style={{ margin: 0 }}>{ap('success_text', { number })}</p>
      <button type="button" className="a3-btn accent" onClick={onOrders}>{ap('my_orders')}</button>
      <button type="button" className="a3-btn ghost" onClick={onHome}>{ap('go_shopping')}</button>
    </div>
  );
}

const STEPS = ['pending', 'confirmed', 'shipped', 'delivered'] as const;

function OrdersView({ byId }: { byId: Map<string, AptekProduct> }) {
  const { data: orders = [], isLoading } = useAptekOrders();
  if (isLoading) return null;
  if (!orders.length) return <p className="a3-empty">{ap('orders_empty')}</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {orders.map((o) => {
        const step = o.status === 'processing' ? 1 : STEPS.indexOf(o.status as typeof STEPS[number]);
        const items = o.order_items || [];
        return (
          <article key={o.id} className="a3-card a3-pad" style={{ gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <b className="a3-num">{o.order_number}</b>
              <span className={`a3-chip ${o.status === 'cancelled' ? 'bad' : o.status === 'delivered' ? 'ok' : 'ac'}`}>{ap(`status_${o.status}` as AptekKey)}</span>
            </div>
            {o.status !== 'cancelled' && (
              <div className="ap-track">
                {STEPS.map((s, i) => <span key={s} className={`ap-tstep${i <= step ? ' on' : ''}`}><i />{ap(`status_${s}` as AptekKey)}</span>)}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {items.slice(0, 4).map((it) => {
                const p = byId.get(it.product_id);
                return <span key={it.id} className="ap-thumb sm">{p?.images[0] && <img src={p.images[0]} alt={it.product_name} />}</span>;
              })}
              <span className="a3-meta" style={{ marginInlineStart: 'auto' }}>{ap('items_n', { n: items.reduce((s, it) => s + it.quantity, 0) })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="a3-meta">{o.delivery_slot ? ap(`slot_${o.delivery_slot}` as AptekKey) : ''}</span>
              <b className="a3-num">{formatAzn(Number(o.total_amount))}</b>
            </div>
          </article>
        );
      })}
    </div>
  );
}
