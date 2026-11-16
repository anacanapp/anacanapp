/**
 * Olivia.az partner storefront (owner 2026-11-16): import the curated catalog or remove it in one click.
 * Rows are public.products with store = 'olivia' and is_active = false, so only admins see them
 * (RLS "Anyone can view active products" hides inactive rows). The app shows them in Mağaza and on the
 * home screens of admins only. Removing is one click; "Kataloqu yüklə" brings everything back.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, ExternalLink, Store, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Btn, EmptyState, Page, PageHeader, Section, StatusPill } from './kit';
import { ADMIN_QUERY } from './data/rpc';
import {
  OLIVIA_CATALOG, OLIVIA_COLLECTIONS, OLIVIA_COLLECTION_LABEL, OLIVIA_STORE, formatManat, oliviaFromRow, oliviaImportRows,
  type OliviaProduct,
} from '@/lib/olivia-shop';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const AdminOliviaShop = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: rows = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-olivia-products'], ...ADMIN_QUERY,
    queryFn: async (): Promise<OliviaProduct[]> => {
      const { data, error } = await db.from('products').select('*').eq('store', OLIVIA_STORE).order('sales_count', { ascending: false });
      if (error) throw error;
      return ((data || []) as Record<string, unknown>[]).map(oliviaFromRow).filter((p): p is OliviaProduct => !!p);
    },
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-olivia-products'] });
    qc.invalidateQueries({ queryKey: ['olivia-products'] });
  };

  const clear = useMutation({
    mutationFn: async () => {
      const { error } = await db.from('products').delete().eq('store', OLIVIA_STORE);
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast({ title: 'Olivia məhsulları silindi', description: 'Mağaza və ana səhifə promoları gizləndi.' }); },
    onError: (e: Error) => toast({ title: 'Silinmədi', description: e.message, variant: 'destructive' }),
  });

  const importAll = useMutation({
    mutationFn: async () => {
      // Replace, never duplicate: delete the current Olivia rows, then insert the bundled catalog.
      const del = await db.from('products').delete().eq('store', OLIVIA_STORE);
      if (del.error) throw del.error;
      const { error } = await db.from('products').insert(oliviaImportRows());
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast({ title: `${OLIVIA_CATALOG.products.length} məhsul yükləndi`, description: 'Yalnız adminlər görür.' }); },
    onError: (e: Error) => toast({ title: 'Yüklənmədi', description: e.message, variant: 'destructive' }),
  });

  const busy = clear.isPending || importAll.isPending;
  const counts = OLIVIA_COLLECTIONS.map((c) => [c, rows.filter((p) => p.collections.includes(c)).length] as const);

  return (
    <Page testId="admin-olivia">
      <PageHeader
        title="Olivia mağazası"
        subtitle="Olivia.az tərəfdaşlığı: Mağaza bölməsi və ana səhifə promoları. Hələlik yalnız adminlər görür."
        icon={<Store size={18} />}
        meta={rows.length ? <StatusPill tone="success">{rows.length} məhsul · yalnız admin</StatusPill> : <StatusPill tone="neutral">Söndürülüb</StatusPill>}
        actions={<>
          <Btn variant="primary" disabled={busy} onClick={() => importAll.mutate()}><Download size={15} />{rows.length ? 'Kataloqu yenilə' : 'Kataloqu yüklə'}</Btn>
          <Btn variant="danger" disabled={busy || !rows.length} onClick={() => clear.mutate()} data-testid="olivia-clear"><Trash2 size={15} />Hamısını təmizlə</Btn>
        </>} />

      <Section title="Necə işləyir">
        <ul className="list-disc ps-5 text-sm grid gap-1">
          <li>"Hamısını təmizlə" bütün Olivia məhsullarını bir kliklə silir. Mağaza bölməsi və ana səhifə kartları dərhal yox olur.</li>
          <li>"Kataloqu yüklə" seçilmiş {OLIVIA_CATALOG.products.length} məhsulu qaytarır (qiymətlər {OLIVIA_CATALOG.captured} tarixinə aiddir). Mövcud Olivia sətirləri əvəz olunur, təkrarlanmır.</li>
          <li>Məhsullar aktiv deyil, ona görə serverdə yalnız adminlərə görünür. Qiyməti və adı "Məhsullar" bölməsindən dəyişmək olar.</li>
          <li>Sifariş hələlik Olivia.az-da tamamlanır. Linklərdə utm_source=anacan var, satışları Olivia UTM üzrə görə bilər.</li>
        </ul>
      </Section>

      {isError ?
        <Section><EmptyState title="Məhsullar oxunmadı" action={<Btn onClick={() => refetch()}>Yenidən yoxla</Btn>} /></Section> :
        isLoading ? null :
        !rows.length ?
          <Section><EmptyState icon={<Store size={20} />} title="Olivia məhsulu yoxdur" description="Mağaza bölməsi və promolar gizlidir."
            action={<Btn variant="primary" disabled={busy} onClick={() => importAll.mutate()}><Download size={14} />Kataloqu yüklə</Btn>} /></Section> :
          <>
            <Section title="Kolleksiyalar">
              <div className="flex flex-wrap gap-2">
                {counts.map(([c, n]) => <StatusPill key={c} tone={n ? 'info' : 'neutral'}>{OLIVIA_COLLECTION_LABEL[c]}: {n}</StatusPill>)}
              </div>
            </Section>
            <Section title="Məhsullar" flush>
              <div className="grid gap-px">
                {rows.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50">
                    <span className="w-11 h-11 rounded-lg bg-white border border-border/50 flex items-center justify-center shrink-0">{p.image && <img src={p.image} alt="" className="max-w-[90%] max-h-[90%] object-contain" loading="lazy" />}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold truncate">{p.name}</span>
                      <span className="block text-xs text-muted-foreground truncate">{p.collections.map((c) => OLIVIA_COLLECTION_LABEL[c]).join(' · ')}</span>
                    </span>
                    <span className="text-sm font-bold tabular-nums whitespace-nowrap">{formatManat(p.price)}</span>
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground" aria-label="olivia.az-da aç"><ExternalLink size={15} /></a>
                  </div>
                ))}
              </div>
            </Section>
          </>}
    </Page>
  );
};

export default AdminOliviaShop;
