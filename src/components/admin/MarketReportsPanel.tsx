import { useCallback, useEffect, useState } from 'react';
import { Flag, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { tr } from '@/lib/tr';
import { getPublicProfileCards } from '@/lib/public-profile-cards';
import { isMissingRelation } from '@/lib/marketSafety';
import { marketReasonLabel } from '@/components/tools/market/marketReasonLabel';

interface MarketReportRow {
  id: string;
  reporter_id: string;
  target_type: 'listing' | 'user' | 'conversation';
  listing_id: string | null;
  reported_user_id: string | null;
  reason: string;
  note: string | null;
  evidence: { listing?: { title?: string; description?: string; status?: string }; messages?: { sender_id: string; content: string; created_at: string }[] } | null;
  status: string;
  created_at: string;
}

// market_reports is not in the generated types yet (generated types.ts stays untouched).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (table: string) => any };

const targetLabel = (t: string) =>
  t === 'listing' ? tr('market_admin_target_listing', 'Elan') :
  t === 'conversation' ? tr('market_admin_target_conversation', 'Yazışma') : tr('market_user_fallback', 'İstifadəçi');

/**
 * Second-hand market reports (public.market_reports, admin RLS via has_role). Pending first; an admin
 * marks a report reviewed or dismissed and can hide the reported listing (status 'rejected').
 * Shows nothing until the migration 20261108120000_market_reports_and_height.sql is applied.
 */
export default function MarketReportsPanel({ onListingHidden }: { onListingHidden?: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<MarketReportRow[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await db.from('market_reports').select('*')
      .eq('status', 'pending').order('created_at', { ascending: false }).limit(100);
    if (error) { setRows(isMissingRelation(error) ? null : []); return; }
    const list = (data ?? []) as MarketReportRow[];
    setRows(list);
    const ids = list.flatMap((r) => [r.reporter_id, r.reported_user_id].filter(Boolean) as string[]);
    getPublicProfileCards(ids).then((cards) => setNames(Object.fromEntries(Object.entries(cards).map(([id, c]) => [id, c.name || id.slice(0, 8)])))).catch(() => {});
  }, []);
  useEffect(() => { void load(); }, [load]);

  const decide = async (row: MarketReportRow, status: 'reviewed' | 'dismissed', hideListing = false) => {
    setBusy(row.id);
    try {
      if (hideListing && row.listing_id) {
        const { error } = await db.from('marketplace_listings').update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: user?.id ?? null }).eq('id', row.listing_id);
        if (error) throw error;
        onListingHidden?.();
      }
      const { error } = await db.from('market_reports')
        .update({ status, reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() }).eq('id', row.id);
      if (error) throw error;
      setRows((prev) => (prev ?? []).filter((r) => r.id !== row.id));
    } catch {
      toast({ title: tr('secondhandmarket_xeta_3cdbb6', 'Xəta'), variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  if (rows === null) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Flag className="w-4 h-4" />
          {tr('market_admin_reports_title', 'Bazar şikayətləri')}
          <Badge variant="secondary">{rows.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">{tr('market_admin_no_reports', 'Gözləyən şikayət yoxdur')}</p>}
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline">{targetLabel(r.target_type)}</Badge>
              <Badge>{marketReasonLabel(r.reason)}</Badge>
              <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {names[r.reporter_id] || r.reporter_id.slice(0, 8)} → {r.reported_user_id ? names[r.reported_user_id] || r.reported_user_id.slice(0, 8) : '-'}
            </p>
            {r.evidence?.listing?.title && <p className="text-sm font-medium">{r.evidence.listing.title}</p>}
            {r.note && <p className="text-sm whitespace-pre-wrap">{r.note}</p>}
            {!!r.evidence?.messages?.length && (
              <div className="max-h-40 overflow-y-auto rounded bg-muted p-2 space-y-1 text-xs">
                {r.evidence.messages.map((m, i) => (
                  <p key={i}><b>{m.sender_id === r.reported_user_id ? names[m.sender_id] || m.sender_id.slice(0, 8) : names[r.reporter_id] || r.reporter_id.slice(0, 8)}:</b> {m.content}</p>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {busy === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <>
                <Button size="sm" onClick={() => decide(r, 'reviewed')}>{tr('market_admin_reviewed', 'Baxıldı')}</Button>
                {r.listing_id && <Button size="sm" variant="destructive" onClick={() => decide(r, 'reviewed', true)}>{tr('market_admin_hide_listing', 'Elanı gizlət')}</Button>}
                <Button size="sm" variant="outline" onClick={() => decide(r, 'dismissed')}>{tr('market_admin_dismiss', 'Rədd et')}</Button>
              </>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
