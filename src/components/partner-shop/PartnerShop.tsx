/**
 * Partner storefront (src/lib/partner-shop.ts): PartnerShopSection sits at the top of the existing Mağaza screen;
 * PartnerHomeCard is the stage-aware home promo. What appears is decided on the server (shop_storefront_v1):
 * partners in admin_only/paused status are visible to admins and their own members only.
 * Every image carries the partner's small icon; the product sheet says "by <logo>". Checkout is phase 1:
 * the basket opens each product on the partner's site with Anacan UTM parameters.
 */
import { useEffect, useMemo, useState } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { ChevronRight, ExternalLink, Minus, Plus, ShoppingBag, Tag, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { useChildren } from '@/hooks/useChildren';
import { getNextPeriodDate } from '@/lib/cycle-utils';
import {
  usePartnerBasket, usePartnerStorefront, requestShopCollection, takeShopCollection, trackShopEvent, trackShopImpressions,
} from '@/hooks/usePartnerShop';
import {
  SHOP_COLLECTIONS, SHOP_COLLECTION_LABEL, formatManat, partnerLink, shopDiscount, shopPlan,
  type PartnerProduct, type ShopCollection, type ShopPartner, type ShopStageInput,
} from '@/lib/partner-shop';
import { PUSH_NAV_EVENT, type PushNavIntent } from '@/lib/pushNav';

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}
const fmtDay = (iso: string) => { try { return new Date(iso).toLocaleDateString('az-AZ', { day: 'numeric', month: 'long' }); } catch { return ''; } };

/** Stage of the signed-in user from the stores (the shop screen has no dashboard props). */
export function useShopStage(): ShopStageInput {
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

/** Small partner mark in the corner of a product image, so mixed brands stay recognisable. */
function PartnerMark({ partner, size = 18 }: { partner?: ShopPartner; size?: number }) {
  if (!partner) return null;
  return (
    <span className="absolute bottom-1.5 end-1.5 rounded-[6px] bg-white shadow-sm ring-1 ring-black/5 overflow-hidden flex items-center justify-center"
      style={{ width: size, height: size }} title={partner.name} aria-label={partner.name}>
      {partner.iconUrl ? <img src={partner.iconUrl} alt="" className="w-full h-full object-cover" /> :
        <span className="text-[9px] font-black" style={{ color: partner.brandColor }}>{partner.name.slice(0, 1)}</span>}
    </span>
  );
}

/** "by <logo>" line of the product sheet. */
export function ByPartner({ partner, className = '' }: { partner?: ShopPartner; className?: string }) {
  if (!partner) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}>
      by {partner.logoUrl ? <img src={partner.logoUrl} alt={partner.name} className="h-3.5 w-auto object-contain" /> : <b style={{ color: partner.brandColor }}>{partner.name}</b>}
    </span>
  );
}

function Price({ p, big }: { p: PartnerProduct; big?: boolean }) {
  return (
    <span className={`tabular-nums font-black text-foreground ${big ? 'text-xl' : 'text-sm'}`}>
      {formatManat(p.price)}
      {p.originalPrice && p.originalPrice > p.price &&
        <span className={`ms-1 font-medium text-muted-foreground line-through ${big ? 'text-sm' : 'text-[10px]'}`}>{formatManat(p.originalPrice)}</span>}
    </span>
  );
}

function QtyControl({ id, placement, compact }: { id: string; placement: string; compact?: boolean }) {
  const basket = usePartnerBasket();
  const q = basket.qty(id);
  const size = compact ? 'w-7 h-7' : 'w-8 h-8';
  if (!q) {
    return (
      <button type="button" aria-label="Səbətə at" className={`${size} rounded-lg gradient-primary text-white flex items-center justify-center shrink-0`}
        onClick={(e) => { e.stopPropagation(); basket.set(id, 1); trackShopEvent(id, 'add', placement); toast.success('Səbətə əlavə olundu', { duration: 1200 }); }}>
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

function ProductCard({ p, partner, col, placement, onOpen }: { p: PartnerProduct; partner?: ShopPartner; col?: ShopCollection; placement: string; onOpen: (p: PartnerProduct) => void }) {
  const off = shopDiscount(p);
  const why = (col && p.why[col]) || Object.values(p.why)[0] || '';
  return (
    <div className="bg-card rounded-xl border border-border/50 p-2 flex flex-col gap-1.5 relative">
      <button type="button" onClick={() => onOpen(p)} className="relative aspect-square rounded-lg bg-white flex items-center justify-center overflow-hidden" aria-label={p.name}>
        {p.image && <img src={p.image} alt="" loading="lazy" className="w-[86%] h-[86%] object-contain" />}
        <PartnerMark partner={partner} />
      </button>
      {off > 0 && <span className="absolute top-3 start-3 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-black text-white">-{off}%</span>}
      <button type="button" onClick={() => onOpen(p)} className="text-start">
        <span className="block text-xs font-bold leading-tight line-clamp-2 min-h-[2.5em]">{p.name}</span>
        <span className="block text-[10.5px] text-muted-foreground leading-snug line-clamp-2 min-h-[2.6em] mt-0.5">
          {p.campaign ? <span className="font-bold text-primary">{p.campaign.title} · </span> : null}{why}
        </span>
      </button>
      <div className="flex items-center justify-between gap-1 mt-auto">
        <Price p={p} />
        <QtyControl id={p.id} placement={placement} compact />
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
        className="relative w-full max-h-[88vh] overflow-y-auto rounded-t-3xl bg-background px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+20px)]">
        <div className="flex items-center justify-center mb-2">
          <span className="w-10 h-1.5 rounded-full bg-border" />
          <button type="button" onClick={onClose} aria-label="Bağla" className="absolute top-2.5 end-4 w-8 h-8 rounded-full bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ProductSheet({ p, partner, col, placement, onClose }: { p: PartnerProduct; partner?: ShopPartner; col?: ShopCollection; placement: string; onClose: () => void }) {
  const basket = usePartnerBasket();
  const off = shopDiscount(p);
  const why = (col && p.why[col]) || Object.values(p.why)[0];
  const q = basket.qty(p.id);
  return (
    <Sheet onClose={onClose} label={p.name}>
      <div className="relative rounded-2xl bg-white aspect-[5/4] flex items-center justify-center mb-3">
        {p.image && <img src={p.image} alt="" className="max-h-[85%] max-w-[70%] object-contain" />}
        <PartnerMark partner={partner} size={26} />
      </div>
      <ByPartner partner={partner} className="mb-1.5" />
      <div className="flex items-center justify-between mb-1">
        <Price p={p} big />
        {off > 0 && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-black text-primary">-{off}%</span>}
      </div>
      <h3 className="text-lg font-black leading-snug mb-2">{p.name}</h3>
      {p.campaign && (
        <div className="rounded-xl border border-primary/30 px-3 py-2 text-[12.5px] mb-2 flex items-center gap-2">
          <Tag className="w-4 h-4 text-primary shrink-0" />
          <span><b>{p.campaign.title}</b> · {fmtDay(p.campaign.endsAt)} tarixinə qədər</span>
        </div>
      )}
      {why && <div className="rounded-xl bg-primary/10 px-3 py-2.5 text-[13px] mb-3"><b className="text-primary">Niyə sənə: </b>{why}</div>}
      <div className="grid gap-2">
        <button type="button" className="w-full rounded-2xl gradient-primary py-3 text-sm font-black text-white"
          onClick={() => { basket.set(p.id, q + 1); trackShopEvent(p.id, 'add', placement); toast.success('Səbətə əlavə olundu', { duration: 1200 }); onClose(); }}>
          {q ? `Səbətdə ${q} ədəd · bir dənə də at` : 'Səbətə at'}
        </button>
        <button type="button" className="w-full rounded-2xl border border-border bg-card py-3 text-sm font-bold flex items-center justify-center gap-2"
          onClick={() => { trackShopEvent(p.id, 'site', placement); openExternal(partnerLink(p.url, `${placement}_${col || 'product'}`)); }}>
          {partner ? `${partner.name} saytında bax` : 'Saytda bax'} <ExternalLink className="w-4 h-4" />
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground text-center mt-3">Məhsul, qiymət və çatdırılma {partner?.name || 'partnyor'} tərəfindəndir.</p>
    </Sheet>
  );
}

function BasketSheet({ products, partners, onClose }: { products: PartnerProduct[]; partners: Map<string, ShopPartner>; onClose: () => void }) {
  const basket = usePartnerBasket();
  const lines = products.filter((p) => basket.items[p.id]).map((p) => ({ p, q: basket.items[p.id] }));
  const groups = [...new Set(lines.map((l) => l.p.partnerId))].map((id) => ({ partner: partners.get(id), lines: lines.filter((l) => l.p.partnerId === id) }));
  const total = lines.reduce((a, l) => a + l.p.price * l.q, 0);
  const old = lines.reduce((a, l) => a + (l.p.originalPrice || l.p.price) * l.q, 0);
  return (
    <Sheet onClose={onClose} label="Partnyor səbəti">
      <h3 className="text-lg font-black mb-3">Səbət</h3>
      {!lines.length ?
        <p className="text-sm text-muted-foreground text-center py-8">Səbət boşdur. Məhsul əlavə et.</p> :
        <div className="grid gap-4">
          {groups.map(({ partner, lines: ls }) => (
            <div key={partner?.id || 'x'} className="grid gap-3">
              <ByPartner partner={partner} />
              {ls.map(({ p }) => (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="relative w-12 h-12 rounded-xl bg-white border border-border/50 flex items-center justify-center shrink-0">{p.image && <img src={p.image} alt="" className="w-[85%] h-[85%] object-contain" />}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-bold leading-tight line-clamp-2">{p.name}</span>
                    <button type="button" className="mt-0.5 text-[11px] font-bold text-primary inline-flex items-center gap-1"
                      onClick={() => { trackShopEvent(p.id, 'site', 'basket'); openExternal(partnerLink(p.url, 'basket')); }}>
                      {formatManat(p.price)} · {partner?.name || 'Partnyor'} saytında al <ExternalLink className="w-3 h-3" />
                    </button>
                  </span>
                  <QtyControl id={p.id} placement="basket" compact />
                </div>
              ))}
            </div>
          ))}
          <div className="border-t border-dashed border-border pt-3 grid gap-1 text-sm tabular-nums">
            {old > total && <div className="flex justify-between text-emerald-700 dark:text-emerald-300"><span>Endirim</span><span>−{formatManat(old - total)}</span></div>}
            <div className="flex justify-between text-base font-black"><span>Cəmi</span><span>{formatManat(total)}</span></div>
          </div>
          <p className="text-[11px] text-muted-foreground">Birinci mərhələ: sifariş partnyorun saytında tamamlanır. Hər məhsulun yanındakı düymə onun səhifəsini açır.</p>
          <button type="button" className="w-full rounded-2xl border border-border bg-card py-2.5 text-xs font-bold" onClick={() => basket.clear()}>Səbəti boşalt</button>
        </div>}
    </Sheet>
  );
}

function useImpressions(ids: string[], placement: string) {
  const key = ids.join(',');
  useEffect(() => { if (ids.length) trackShopImpressions(ids, placement); }, [key, placement]); // eslint-disable-line react-hooks/exhaustive-deps
}

function ProductGrid({ items, partners, col, placement, onOpen }: { items: PartnerProduct[]; partners: Map<string, ShopPartner>; col?: ShopCollection; placement: string; onOpen: (p: PartnerProduct, c?: ShopCollection) => void }) {
  useImpressions(items.map((p) => p.id), placement);
  return <div className="grid grid-cols-2 gap-2">{items.map((p) => <ProductCard key={p.id} p={p} partner={partners.get(p.partnerId)} col={col} placement={placement} onOpen={(x) => onOpen(x, col)} />)}</div>;
}

/** Storefront block at the top of the Mağaza screen. Renders nothing when the server returns no partner products. */
export function PartnerShopSection() {
  const stage = useShopStage();
  const { data, isLoading } = usePartnerStorefront();
  const products = data?.products || [];
  const partners = data?.partners || new Map<string, ShopPartner>();
  const basket = usePartnerBasket();
  const plan = shopPlan(stage);
  const [col, setCol] = useState<ShopCollection | 'for'>(() => takeShopCollection() || 'for');
  const [open, setOpen] = useState<{ p: PartnerProduct; col?: ShopCollection } | null>(null);
  const [showBasket, setShowBasket] = useState(false);
  const [query, setQuery] = useState('');

  const byCol = useMemo(() => {
    const m = new Map<ShopCollection, PartnerProduct[]>();
    SHOP_COLLECTIONS.forEach((c) => m.set(c, products.filter((p) => p.collections.includes(c)).sort((a, b) => b.sort - a.sort)));
    return m;
  }, [products]);

  if (isLoading || !products.length || !plan) return null;

  const partnerList = [...partners.values()].filter((p) => products.some((x) => x.partnerId === p.id));
  const preview = partnerList.some((p) => p.status !== 'live');
  const order = [...plan.order, ...SHOP_COLLECTIONS.filter((c) => !plan.order.includes(c))].filter((c) => (byCol.get(c) || []).length);
  const heroItems = byCol.get(plan.hero.collection) || [];
  const lead = plan.hero.lead ? heroItems.find((p) => p.sku === plan.hero.lead) : undefined;
  const thumbs = (lead ? [lead, ...heroItems.filter((p) => p !== lead)] : heroItems).slice(0, 5);
  const heroMissing = heroItems.filter((p) => !basket.qty(p.id));
  const fold = (v: string) => v.toLocaleLowerCase('az');
  const hits = query.trim() ? products.filter((p) => fold(`${p.name} ${p.description || ''} ${partners.get(p.partnerId)?.name || ''}`).includes(fold(query.trim()))) : [];
  const openProduct = (p: PartnerProduct, c?: ShopCollection) => { setOpen({ p, col: c }); trackShopEvent(p.id, 'open', 'shop'); };

  return (
    <section className="mb-5" aria-label="Partnyor mağazaları">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="rounded-full bg-card border border-border/60 px-2.5 py-1 text-[11px] font-bold inline-flex items-center gap-1.5">
            {partnerList.slice(0, 3).map((p) => p.iconUrl ? <img key={p.id} src={p.iconUrl} alt="" className="w-4 h-4 rounded-[4px]" /> : null)}
            {partnerList.length === 1 ? `${partnerList[0].name} ilə` : 'Partnyor mağazaları'}
          </span>
          {preview && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">Önizləmə · yalnız admin</span>}
        </div>
        <button type="button" onClick={() => setShowBasket(true)} className="relative w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0" aria-label={`Partnyor səbəti, ${basket.count} məhsul`}>
          <ShoppingBag className="w-4.5 h-4.5 text-primary" />
          {basket.count > 0 && <span className="absolute -top-1 -end-1 min-w-4 h-4 px-1 rounded-full bg-primary text-[9px] font-black text-white flex items-center justify-center">{basket.count}</span>}
        </button>
      </div>

      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Axtar: salfet, krem, bez..." aria-label="Partnyor məhsullarında axtar"
        className="w-full h-10 px-3 mb-3 rounded-xl bg-muted/50 border border-transparent focus:border-primary/30 text-sm outline-none" />

      {query.trim() ?
        (hits.length ?
          <ProductGrid items={hits} partners={partners} placement="search" onOpen={openProduct} /> :
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
                  onClick={() => { basket.addMany(heroMissing.map((p) => p.id)); trackShopEvent(heroMissing.map((p) => p.id), 'bundle', 'shop_hero'); toast.success('Dəst səbətə əlavə olundu', { duration: 1400 }); }}>
                  {heroMissing.length ? 'Hamısını səbətə at' : 'Səbətdədir ✓'}
                </button> :
                <button type="button" className="rounded-full bg-white px-3.5 py-2 text-xs font-black text-primary" onClick={() => setCol(plan.hero.collection)}>Bax</button>}
            </div>
          </div>

          <div className="flex gap-1.5 mb-3 overflow-x-auto hide-scrollbar pb-1" role="group" aria-label="Kateqoriyalar">
            {(['for', ...order] as Array<ShopCollection | 'for'>).map((c) =>
              <button key={c} type="button" aria-pressed={col === c} onClick={() => setCol(c)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap ${col === c ? 'gradient-primary text-white' : 'bg-card border border-border/50 text-muted-foreground'}`}>
                {c === 'for' ? 'Sənin üçün' : SHOP_COLLECTION_LABEL[c]}
              </button>)}
          </div>

          {col === 'for' ?
            plan.order.filter((c) => (byCol.get(c) || []).length).map((c) =>
              <div key={c} className="mb-4">
                <div className="flex items-baseline justify-between mb-2">
                  <h4 className="text-sm font-black">{SHOP_COLLECTION_LABEL[c]}</h4>
                  <button type="button" className="text-[11px] font-bold text-primary inline-flex items-center" onClick={() => setCol(c)}>Hamısı <ChevronRight className="w-3 h-3 rtl:rotate-180" /></button>
                </div>
                <ProductGrid items={(byCol.get(c) || []).slice(0, 4)} partners={partners} col={c} placement="shop_for" onOpen={openProduct} />
              </div>) :
            <ProductGrid items={byCol.get(col) || []} partners={partners} col={col} placement={`shop_${col}`} onOpen={openProduct} />}
        </>}

      <p className="text-[10.5px] text-muted-foreground mt-3">Qiymətləri partnyorlar idarə edir və dəyişə bilər. Sifariş partnyorun saytında tamamlanır.</p>

      {open && <ProductSheet p={open.p} partner={partners.get(open.p.partnerId)} col={open.col} placement="shop" onClose={() => setOpen(null)} />}
      {showBasket && <BasketSheet products={products} partners={partners} onClose={() => setShowBasket(false)} />}
    </section>
  );
}

/** Stage-aware home promo. Opens the Mağaza screen on the matching collection. */
export function PartnerHomeCard(props: Omit<ShopStageInput, 'recovering'> & { recovering?: boolean; onOpen?: (screen: string) => void }) {
  const { data } = usePartnerStorefront();
  const plan = shopPlan(props);
  const items = useMemo(() => plan ? (data?.products || []).filter((p) => p.collections.includes(plan.hero.collection)).sort((a, b) => b.sort - a.sort) : [],
    [data, plan?.hero.collection]); // eslint-disable-line react-hooks/exhaustive-deps
  const lead = plan?.hero.lead ? items.find((p) => p.sku === plan.hero.lead) : undefined;
  const thumbs = (lead ? [lead, ...items.filter((p) => p !== lead)] : items).slice(0, 4);
  const placement = `home_${props.lifeStage || 'x'}`;
  useImpressions(thumbs.map((p) => p.id), placement);
  if (!plan || !items.length || !data) return null;
  const owners = [...new Set(items.map((p) => p.partnerId))].map((id) => data.partners.get(id)).filter((p): p is ShopPartner => !!p);
  const preview = owners.some((p) => p.status !== 'live');
  const go = () => {
    trackShopEvent(thumbs.map((p) => p.id), 'open', placement);
    requestShopCollection(plan.hero.collection);
    if (props.onOpen) props.onOpen('shop');
    else window.dispatchEvent(new CustomEvent<PushNavIntent>(PUSH_NAV_EVENT, { detail: { screen: 'shop' } }));
  };
  return (
    <section className="a-section" style={{ marginTop: 12 }}>
      <button type="button" onClick={go} className="w-full text-start rounded-2xl border border-border/60 bg-card p-3.5 flex flex-col gap-2.5">
        <span className="flex items-center justify-between gap-2">
          <span className="text-[10.5px] font-black uppercase tracking-wider text-primary inline-flex items-center gap-1.5">
            {owners.length === 1 && owners[0].iconUrl && <img src={owners[0].iconUrl} alt="" className="w-4 h-4 rounded-[4px]" />}
            {owners.length === 1 ? `${owners[0].name} ilə` : 'Partnyorlar'} · {plan.hero.eyebrow}
          </span>
          {preview && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9.5px] font-bold text-amber-700 dark:text-amber-300">Önizləmə</span>}
        </span>
        <span className="block">
          <b className="block text-[15px] leading-snug">{plan.hero.title}</b>
          <span className="block text-xs text-muted-foreground mt-0.5">{plan.hero.text}</span>
        </span>
        <span className="flex items-center gap-1.5">
          {thumbs.map((p) => <span key={p.id} className="relative w-11 h-11 rounded-xl bg-white border border-border/50 p-0.5 flex items-center justify-center">{p.image && <img src={p.image} alt="" className="max-w-full max-h-full object-contain" />}<PartnerMark partner={data.partners.get(p.partnerId)} size={14} /></span>)}
          <span className="ms-auto inline-flex items-center gap-1 rounded-xl bg-primary/10 px-3 py-2 text-xs font-black text-primary">
            {formatManat(Math.min(...items.map((p) => p.price)))}-dan <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </span>
        </span>
      </button>
    </section>
  );
}
