/**
 * Olivia.az storefront (admin-only while the partnership is negotiated, see src/lib/olivia-shop.ts):
 * OliviaShopSection sits at the top of the existing Mağaza screen; OliviaHomeCard is the stage-aware home promo.
 * Checkout is phase 1: the basket lists the products and opens each one on olivia.az with Anacan UTM parameters.
 */
import { useEffect, useMemo, useState } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { ChevronRight, ExternalLink, Minus, Plus, ShoppingBag, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { useChildren } from '@/hooks/useChildren';
import { getNextPeriodDate } from '@/lib/cycle-utils';
import { trackEvent } from '@/hooks/useScreenAnalytics';
import { useOliviaBasket, useOliviaProducts, requestOliviaCollection, takeOliviaCollection } from '@/hooks/useOliviaShop';
import {
  OLIVIA_COLLECTIONS, OLIVIA_COLLECTION_LABEL, formatManat, oliviaDiscount, oliviaLink, oliviaPlan,
  type OliviaCollection, type OliviaProduct, type OliviaStageInput,
} from '@/lib/olivia-shop';
import { PUSH_NAV_EVENT, type PushNavIntent } from '@/lib/pushNav';

const track = (name: string, params: Record<string, string | number> = {}) => {
  try { trackEvent(name, { partner: 'olivia', ...params }); } catch { /* analytics never blocks */ }
};

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Stage of the signed-in user from the stores (used by the shop screen, which has no dashboard props). */
export function useOliviaStage(): OliviaStageInput {
  const { profile } = useAuth();
  const lifeStage = useUserStore((s) => s.lifeStage);
  const getPregnancyData = useUserStore((s) => s.getPregnancyData);
  const lastPeriodDate = useUserStore((s) => s.lastPeriodDate);
  const cycleLength = useUserStore((s) => s.cycleLength);
  const { selectedChild, getChildAge } = useChildren();
  const age = selectedChild ? getChildAge(selectedChild) : null;
  let daysUntilPeriod: number | null = null;
  if (lifeStage === 'flow' && lastPeriodDate) {
    try { daysUntilPeriod = differenceInCalendarDays(getNextPeriodDate(new Date(lastPeriodDate), cycleLength), new Date()); } catch { daysUntilPeriod = null; }
  }
  return {
    lifeStage,
    pregnancyWeek: lifeStage === 'bump' ? getPregnancyData()?.currentWeek ?? null : null,
    babyMonths: lifeStage === 'mommy' ? age?.months ?? null : null,
    daysUntilPeriod,
    recovering: !!(profile as { loss_recovery_active?: boolean } | null)?.loss_recovery_active,
  };
}

function Price({ p, big }: { p: OliviaProduct; big?: boolean }) {
  return (
    <span className={`tabular-nums font-black text-foreground ${big ? 'text-xl' : 'text-sm'}`}>
      {formatManat(p.price)}
      {p.originalPrice && p.originalPrice > p.price &&
        <span className={`ms-1 font-medium text-muted-foreground line-through ${big ? 'text-sm' : 'text-[10px]'}`}>{formatManat(p.originalPrice)}</span>}
    </span>
  );
}

function QtyControl({ id, compact }: { id: string; compact?: boolean }) {
  const basket = useOliviaBasket();
  const q = basket.qty(id);
  const size = compact ? 'w-7 h-7' : 'w-8 h-8';
  if (!q) {
    return (
      <button type="button" aria-label="Səbətə at" className={`${size} rounded-lg gradient-primary text-white flex items-center justify-center shrink-0`}
        onClick={(e) => { e.stopPropagation(); basket.set(id, 1); track('olivia_add', { product: id }); toast.success('Səbətə əlavə olundu', { duration: 1200 }); }}>
        <Plus className="w-4 h-4" />
      </button>
    );
  }
  return (
    <div className="flex items-center rounded-lg bg-primary/10 shrink-0" onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label="Azalt" className={`${size} flex items-center justify-center text-primary`} onClick={() => basket.set(id, q - 1)}><Minus className="w-3.5 h-3.5" /></button>
      <span className="min-w-[14px] text-center text-xs font-black tabular-nums">{q}</span>
      <button type="button" aria-label="Artır" className={`${size} flex items-center justify-center text-primary`} onClick={() => basket.set(id, q + 1)}><Plus className="w-3.5 h-3.5" /></button>
    </div>
  );
}

function ProductCard({ p, col, onOpen }: { p: OliviaProduct; col?: OliviaCollection; onOpen: (p: OliviaProduct) => void }) {
  const off = oliviaDiscount(p);
  const why = (col && p.why[col]) || Object.values(p.why)[0] || '';
  return (
    <div className="bg-card rounded-xl border border-border/50 p-2 flex flex-col gap-1.5 relative">
      <button type="button" onClick={() => onOpen(p)} className="aspect-square rounded-lg bg-white flex items-center justify-center overflow-hidden" aria-label={p.name}>
        {p.image && <img src={p.image} alt="" loading="lazy" className="w-[86%] h-[86%] object-contain" />}
      </button>
      {off > 0 && <span className="absolute top-3 start-3 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-black text-white">-{off}%</span>}
      <button type="button" onClick={() => onOpen(p)} className="text-start">
        <span className="block text-xs font-bold leading-tight line-clamp-2 min-h-[2.5em]">{p.name}</span>
        <span className="block text-[10.5px] text-muted-foreground leading-snug line-clamp-2 min-h-[2.6em] mt-0.5">{why}</span>
      </button>
      <div className="flex items-center justify-between gap-1 mt-auto">
        <Price p={p} />
        <QtyControl id={p.id} compact />
      </div>
    </div>
  );
}

function Sheet({ onClose, label, children }: { onClose: () => void; label: string; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-end" onClick={onClose}>
      <div role="dialog" aria-label={label} onClick={(e) => e.stopPropagation()}
        className="w-full max-h-[88vh] overflow-y-auto rounded-t-3xl bg-background px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+20px)]">
        <div className="flex items-center justify-between mb-2">
          <span className="w-10 h-1.5 rounded-full bg-border mx-auto" />
          <button type="button" onClick={onClose} aria-label="Bağla" className="absolute end-4 w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ProductSheet({ p, col, onClose }: { p: OliviaProduct; col?: OliviaCollection; onClose: () => void }) {
  const basket = useOliviaBasket();
  const off = oliviaDiscount(p);
  const why = (col && p.why[col]) || Object.values(p.why)[0];
  const q = basket.qty(p.id);
  return (
    <Sheet onClose={onClose} label={p.name}>
      <div className="rounded-2xl bg-white aspect-[5/4] flex items-center justify-center mb-3">
        {p.image && <img src={p.image} alt="" className="max-h-[85%] max-w-[70%] object-contain" />}
      </div>
      <div className="flex items-center justify-between mb-1">
        <Price p={p} big />
        {off > 0 && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-black text-primary">-{off}%</span>}
      </div>
      <h3 className="text-lg font-black leading-snug">{p.name}</h3>
      <p className="text-xs text-muted-foreground mb-3">{p.fullName}</p>
      {why && <div className="rounded-xl bg-primary/10 px-3 py-2.5 text-[13px] mb-3"><b className="text-primary">Niyə sənə: </b>{why}</div>}
      <div className="grid gap-2">
        <button type="button" className="w-full rounded-2xl gradient-primary py-3 text-sm font-black text-white"
          onClick={() => { basket.set(p.id, q + 1); track('olivia_add', { product: p.id, from: 'sheet' }); toast.success('Səbətə əlavə olundu', { duration: 1200 }); onClose(); }}>
          {q ? `Səbətdə ${q} ədəd · bir dənə də at` : 'Səbətə at'}
        </button>
        <button type="button" className="w-full rounded-2xl border border-border bg-card py-3 text-sm font-bold flex items-center justify-center gap-2"
          onClick={() => { track('olivia_open_site', { product: p.id }); openExternal(oliviaLink(p.url, `shop_${col || 'product'}`)); }}>
          Olivia.az-da bax <ExternalLink className="w-4 h-4" />
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground text-center mt-3">Məhsul, qiymət və çatdırılma Olivia.az-dandır.</p>
    </Sheet>
  );
}

function BasketSheet({ products, onClose }: { products: OliviaProduct[]; onClose: () => void }) {
  const basket = useOliviaBasket();
  const lines = products.filter((p) => basket.items[p.id]).map((p) => ({ p, q: basket.items[p.id] }));
  const total = lines.reduce((a, l) => a + l.p.price * l.q, 0);
  const old = lines.reduce((a, l) => a + (l.p.originalPrice || l.p.price) * l.q, 0);
  return (
    <Sheet onClose={onClose} label="Olivia səbəti">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-black">Səbət</h3>
        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">Olivia ilə</span>
      </div>
      {!lines.length ?
        <p className="text-sm text-muted-foreground text-center py-8">Səbət boşdur. Məhsul əlavə et.</p> :
        <div className="grid gap-3">
          {lines.map(({ p }) => (
            <div key={p.id} className="flex items-center gap-3">
              <span className="w-12 h-12 rounded-xl bg-white border border-border/50 flex items-center justify-center shrink-0">{p.image && <img src={p.image} alt="" className="w-[85%] h-[85%] object-contain" />}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-bold leading-tight line-clamp-2">{p.name}</span>
                <button type="button" className="mt-0.5 text-[11px] font-bold text-primary inline-flex items-center gap-1"
                  onClick={() => { track('olivia_open_site', { product: p.id, from: 'basket' }); openExternal(oliviaLink(p.url, 'basket')); }}>
                  {formatManat(p.price)} · Olivia-da al <ExternalLink className="w-3 h-3" />
                </button>
              </span>
              <QtyControl id={p.id} compact />
            </div>
          ))}
          <div className="border-t border-dashed border-border pt-3 grid gap-1 text-sm tabular-nums">
            {old > total && <div className="flex justify-between text-emerald-700 dark:text-emerald-300"><span>Olivia endirimi</span><span>−{formatManat(old - total)}</span></div>}
            <div className="flex justify-between text-base font-black"><span>Cəmi</span><span>{formatManat(total)}</span></div>
          </div>
          <p className="text-[11px] text-muted-foreground">Birinci mərhələ: sifariş Olivia.az-da tamamlanır. Hər məhsulun yanındakı "Olivia-da al" düyməsi onun səhifəsini açır.</p>
          <button type="button" className="w-full rounded-2xl border border-border bg-card py-2.5 text-xs font-bold" onClick={() => basket.clear()}>Səbəti boşalt</button>
        </div>}
    </Sheet>
  );
}

/** Storefront block at the top of the Mağaza screen. Renders nothing for non-admins or without Olivia rows. */
export function OliviaShopSection() {
  const { isAdmin } = useAuth();
  const stage = useOliviaStage();
  const { data: products = [], isLoading } = useOliviaProducts();
  const basket = useOliviaBasket();
  const plan = oliviaPlan(stage);
  const [col, setCol] = useState<OliviaCollection | 'for'>(() => takeOliviaCollection() || 'for');
  const [open, setOpen] = useState<{ p: OliviaProduct; col?: OliviaCollection } | null>(null);
  const [showBasket, setShowBasket] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => { if (isAdmin && products.length) track('olivia_shop_view', { stage: String(stage.lifeStage || '') }); }, [isAdmin, products.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const byCol = useMemo(() => {
    const m = new Map<OliviaCollection, OliviaProduct[]>();
    OLIVIA_COLLECTIONS.forEach((c) => m.set(c, products.filter((p) => p.collections.includes(c)).sort((a, b) => b.sort - a.sort)));
    return m;
  }, [products]);

  if (!isAdmin || isLoading || !products.length || !plan) return null;

  const order = [...plan.order, ...OLIVIA_COLLECTIONS.filter((c) => !plan.order.includes(c))].filter((c) => (byCol.get(c) || []).length);
  const heroItems = byCol.get(plan.hero.collection) || [];
  const lead = plan.hero.lead ? heroItems.find((p) => p.sku === plan.hero.lead) : undefined;
  const thumbs = (lead ? [lead, ...heroItems.filter((p) => p !== lead)] : heroItems).slice(0, 5);
  const heroMissing = heroItems.filter((p) => !basket.qty(p.id));
  const fold = (v: string) => v.toLocaleLowerCase('az');
  const hits = query.trim() ? products.filter((p) => fold(`${p.name} ${p.fullName}`).includes(fold(query.trim()))) : [];
  const openProduct = (p: OliviaProduct, c?: OliviaCollection) => { setOpen({ p, col: c }); track('olivia_product_open', { product: p.id }); };

  return (
    <section className="mb-5" aria-label="Olivia mağazası">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />Olivia ilə
          </span>
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">Yalnız admin</span>
        </div>
        <button type="button" onClick={() => setShowBasket(true)} className="relative w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center" aria-label={`Olivia səbəti, ${basket.count} məhsul`}>
          <ShoppingBag className="w-4.5 h-4.5 text-primary" />
          {basket.count > 0 && <span className="absolute -top-1 -end-1 min-w-4 h-4 px-1 rounded-full bg-primary text-[9px] font-black text-white flex items-center justify-center">{basket.count}</span>}
        </button>
      </div>

      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Olivia-da axtar: salfet, krem, bez..." aria-label="Olivia məhsullarında axtar"
        className="w-full h-10 px-3 mb-3 rounded-xl bg-muted/50 border border-transparent focus:border-primary/30 text-sm outline-none" />

      {query.trim() ?
        (hits.length ?
          <div className="grid grid-cols-2 gap-2">{hits.map((p) => <ProductCard key={p.id} p={p} onOpen={(x) => openProduct(x)} />)}</div> :
          <p className="text-sm text-muted-foreground text-center py-6">"{query}" tapılmadı.</p>) :
        <>
          <div className="rounded-2xl gradient-primary p-4 text-white mb-3">
            <p className="text-[10.5px] font-black uppercase tracking-wider opacity-90">{plan.hero.eyebrow}</p>
            <h3 className="text-lg font-black leading-tight mt-1">{plan.hero.title}</h3>
            <p className="text-xs opacity-95 mt-1 max-w-[30ch]">{plan.hero.text}</p>
            <div className="flex gap-1.5 mt-3">
              {thumbs.map((p) => <span key={p.id} className="w-10 h-10 rounded-lg bg-white p-0.5 flex items-center justify-center">{p.image && <img src={p.image} alt="" className="max-w-full max-h-full object-contain" />}</span>)}
            </div>
            <div className="flex items-center justify-between gap-2 mt-3">
              <span className="text-xs font-bold">{heroItems.length} məhsul</span>
              {plan.hero.collection === 'bag' ?
                <button type="button" disabled={!heroMissing.length} className="rounded-full bg-white px-3.5 py-2 text-xs font-black text-primary disabled:opacity-80"
                  onClick={() => { basket.addMany(heroMissing.map((p) => p.id)); track('olivia_bundle_add', { collection: 'bag', n: heroMissing.length }); toast.success('Dəst səbətə əlavə olundu', { duration: 1400 }); }}>
                  {heroMissing.length ? 'Hamısını səbətə at' : 'Səbətdədir ✓'}
                </button> :
                <button type="button" className="rounded-full bg-white px-3.5 py-2 text-xs font-black text-primary" onClick={() => setCol(plan.hero.collection)}>Bax</button>}
            </div>
          </div>

          <div className="flex gap-1.5 mb-3 overflow-x-auto hide-scrollbar pb-1" role="group" aria-label="Olivia kateqoriyaları">
            {(['for', ...order] as Array<OliviaCollection | 'for'>).map((c) =>
              <button key={c} type="button" aria-pressed={col === c} onClick={() => setCol(c)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap ${col === c ? 'gradient-primary text-white' : 'bg-card border border-border/50 text-muted-foreground'}`}>
                {c === 'for' ? 'Sənin üçün' : OLIVIA_COLLECTION_LABEL[c]}
              </button>)}
          </div>

          {col === 'for' ?
            plan.order.filter((c) => (byCol.get(c) || []).length).map((c) =>
              <div key={c} className="mb-4">
                <div className="flex items-baseline justify-between mb-2">
                  <h4 className="text-sm font-black">{OLIVIA_COLLECTION_LABEL[c]}</h4>
                  <button type="button" className="text-[11px] font-bold text-primary inline-flex items-center" onClick={() => setCol(c)}>Hamısı <ChevronRight className="w-3 h-3 rtl:rotate-180" /></button>
                </div>
                <div className="grid grid-cols-2 gap-2">{(byCol.get(c) || []).slice(0, 4).map((p) => <ProductCard key={p.id} p={p} col={c} onOpen={(x) => openProduct(x, c)} />)}</div>
              </div>) :
            <div className="grid grid-cols-2 gap-2">{(byCol.get(col) || []).map((p) => <ProductCard key={p.id} p={p} col={col} onOpen={(x) => openProduct(x, col)} />)}</div>}
        </>}

      <p className="text-[10.5px] text-muted-foreground mt-3">Qiymətlər Olivia.az-dandır və dəyişə bilər. Sifariş Olivia.az-da tamamlanır.</p>

      {open && <ProductSheet p={open.p} col={open.col} onClose={() => setOpen(null)} />}
      {showBasket && <BasketSheet products={products} onClose={() => setShowBasket(false)} />}
    </section>
  );
}

/** Stage-aware home promo (admin-only). Opens the Mağaza screen on the matching collection. */
export function OliviaHomeCard(props: Omit<OliviaStageInput, 'recovering'> & { recovering?: boolean; onOpen?: (screen: string) => void }) {
  const { isAdmin } = useAuth();
  const { data: products = [] } = useOliviaProducts();
  const plan = oliviaPlan(props);
  if (!isAdmin || !products.length || !plan) return null;
  const items = products.filter((p) => p.collections.includes(plan.hero.collection)).sort((a, b) => b.sort - a.sort);
  if (!items.length) return null;
  const lead = plan.hero.lead ? items.find((p) => p.sku === plan.hero.lead) : undefined;
  const thumbs = (lead ? [lead, ...items.filter((p) => p !== lead)] : items).slice(0, 4);
  const go = () => {
    track('olivia_home_click', { collection: plan.hero.collection });
    requestOliviaCollection(plan.hero.collection);
    if (props.onOpen) props.onOpen('shop');
    else window.dispatchEvent(new CustomEvent<PushNavIntent>(PUSH_NAV_EVENT, { detail: { screen: 'shop' } }));
  };
  return (
    <section className="a-section" style={{ marginTop: 12 }}>
      <button type="button" onClick={go} className="w-full text-start rounded-2xl border border-border/60 bg-card p-3.5 flex flex-col gap-2.5">
        <span className="flex items-center justify-between gap-2">
          <span className="text-[10.5px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Olivia ilə · {plan.hero.eyebrow}</span>
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9.5px] font-bold text-amber-700 dark:text-amber-300">Admin</span>
        </span>
        <span className="block">
          <b className="block text-[15px] leading-snug">{plan.hero.title}</b>
          <span className="block text-xs text-muted-foreground mt-0.5">{plan.hero.text}</span>
        </span>
        <span className="flex items-center gap-1.5">
          {thumbs.map((p) => <span key={p.id} className="w-11 h-11 rounded-xl bg-white border border-border/50 p-0.5 flex items-center justify-center">{p.image && <img src={p.image} alt="" className="max-w-full max-h-full object-contain" />}</span>)}
          <span className="ms-auto inline-flex items-center gap-1 rounded-xl bg-primary/10 px-3 py-2 text-xs font-black text-primary">
            {formatManat(Math.min(...items.map((p) => p.price)))}-dan <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </span>
        </span>
      </button>
    </section>
  );
}
