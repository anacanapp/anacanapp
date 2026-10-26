import { tr } from "@/lib/tr";import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Sparkles, CheckCircle2, Clock, XCircle } from 'lucide-react';

export default function AdminPartnerRedemptions() {
  const [rows, setRows] = useState<any[]>([]);
  const [stats, setStats] = useState({ today: 0, week: 0, month: 0 });
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const load = async () => {
    let q = supabase.
    from('partner_redemptions').
    select('id, status, created_at, expires_at, verified_at, verified_ip, venue:partner_venues(name), user_id').
    order('created_at', { ascending: false }).
    limit(300);
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    const { data } = await q;
    setRows(data || []);

    const since = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
    const { count: today } = await supabase.from('partner_redemptions').select('*', { head: true, count: 'exact' }).eq('status', 'verified').gte('verified_at', since(1));
    const { count: week } = await supabase.from('partner_redemptions').select('*', { head: true, count: 'exact' }).eq('status', 'verified').gte('verified_at', since(7));
    const { count: month } = await supabase.from('partner_redemptions').select('*', { head: true, count: 'exact' }).eq('status', 'verified').gte('verified_at', since(30));
    setStats({ today: today || 0, week: week || 0, month: month || 0 });
  };

  useEffect(() => {load(); /* eslint-disable-next-line */}, [statusFilter]);

  const statusIcon = (s: string) => s === 'verified' ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : s === 'pending' ? <Clock className="w-4 h-4 text-amber-500" /> : <XCircle className="w-4 h-4 text-destructive" />;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" /> {tr("adminpartnerredemptions_endirim_hesabati_d6c2f2", "Endirim Hesabat\u0131")}</h1>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">{tr("adminpartnerredemptions_bu_gun_786fd4", "Bu g\xFCn")}</p><p className="text-2xl font-bold">{stats.today}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">{tr("adminpartnerredemptions_bu_hefte_a5f60b", "Bu h\u0259ft\u0259")}</p><p className="text-2xl font-bold">{stats.week}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Bu ay</p><p className="text-2xl font-bold">{stats.month}</p></Card>
      </div>

      <div className="flex gap-2">
        {['all', 'verified', 'pending', 'expired', 'cancelled'].map((s) =>
        <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 text-xs rounded-full font-medium ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{s}</button>
        )}
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-2 text-start">Status</th>
              <th className="p-2 text-start">{tr("adminpartnerredemptions_mekan_90b8af", "M\u0259kan")}</th>
              <th className="p-2 text-start">{tr("adminpartnerredemptions_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i")}</th>
              <th className="p-2 text-start">{tr("adminpartnerredemptions_yaradilib_0230e2", "Yarad\u0131l\u0131b")}</th>
              <th className="p-2 text-start">{tr("adminpartnerredemptions_tesdiqlenib_96c431", "T\u0259sdiql\u0259nib")}</th>
              <th className="p-2 text-start">IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) =>
            <tr key={r.id} className="border-t border-border">
                <td className="p-2"><div className="flex items-center gap-1">{statusIcon(r.status)} <span className="text-xs">{r.status}</span></div></td>
                <td className="p-2">{r.venue?.name || '—'}</td>
                <td className="p-2 text-xs font-mono">{String(r.user_id).slice(0, 8)}…</td>
                <td className="p-2 text-xs">{new Date(r.created_at).toLocaleString('az-AZ')}</td>
                <td className="p-2 text-xs">{r.verified_at ? new Date(r.verified_at).toLocaleString('az-AZ') : '—'}</td>
                <td className="p-2 text-xs">{r.verified_ip || '—'}</td>
              </tr>
            )}
            {rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Qeyd yoxdur</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>);

}