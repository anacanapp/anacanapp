import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeCanvas } from 'qrcode.react';
import { Copy, Download, Plus, QrCode, RefreshCw, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PROMO_CODE_RE, PROMO_DURATIONS, promoRpc, type PromoDuration, type PromoState } from '@/lib/promo';

// QR kampaniyalar: each QR carries its own Premium duration, eligibility, use limit and date window (docs/PROMO_QR.md).
export interface PromoCampaign {
  id: string; code: string; title: string; duration: PromoDuration; eligibility: 'new_users' | 'everyone'; new_user_days: number;
  max_uses: number | null; starts_at: string; ends_at: string | null; is_active: boolean; notes: string | null; created_at: string;
  state: PromoState; granted: number; failed: number; last_granted_at: string | null;
}
interface Redemption { id: string; user_id: string; status: 'reserved' | 'granted' | 'failed'; note: string | null; created_at: string; finished_at: string | null; name: string | null; email: string | null }

export const promoLink = (code: string) => `https://app.anacan.az/h/${encodeURIComponent(code)}`;
export const DURATION_LABEL: Record<PromoDuration, string> = {
  weekly: '1 həftə', monthly: '1 ay', two_month: '2 ay', three_month: '3 ay', six_month: '6 ay', yearly: '1 il', lifetime: 'Ömürlük',
};
const STATE_LABEL: Record<PromoState, { label: string; cls: string }> = {
  active: { label: 'Aktiv', cls: 'bg-emerald-100 text-emerald-800' },
  inactive: { label: 'Söndürülüb', cls: 'bg-zinc-200 text-zinc-700' },
  not_started: { label: 'Başlamayıb', cls: 'bg-sky-100 text-sky-800' },
  expired: { label: 'Bitib', cls: 'bg-zinc-200 text-zinc-700' },
  full: { label: 'Limit dolub', cls: 'bg-amber-100 text-amber-800' },
};
const fmt = (value: string | null) => value ? new Date(value).toLocaleString('az-AZ', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
// <input type="datetime-local"> works in local time; the server stores timestamptz.
const toLocalInput = (value: string | null) => {
  if (!value) return '';
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocalInput = (value: string) => value ? new Date(value).toISOString() : '';

type Draft = { code: string; title: string; duration: PromoDuration; eligibility: 'new_users' | 'everyone'; new_user_days: string; max_uses: string; starts_at: string; ends_at: string; is_active: boolean; notes: string };
const emptyDraft = (): Draft => ({ code: '', title: '', duration: 'monthly', eligibility: 'new_users', new_user_days: '7', max_uses: '', starts_at: toLocalInput(new Date().toISOString()), ends_at: '', is_active: true, notes: '' });
const draftOf = (c: PromoCampaign): Draft => ({ code: c.code, title: c.title, duration: c.duration, eligibility: c.eligibility, new_user_days: String(c.new_user_days),
  max_uses: c.max_uses == null ? '' : String(c.max_uses), starts_at: toLocalInput(c.starts_at), ends_at: toLocalInput(c.ends_at), is_active: c.is_active, notes: c.notes ?? '' });

/** Validation shared by the form and its tests. Returns an Azerbaijani message or null. */
export function validateDraft(d: Draft, isNew: boolean): string | null {
  if (isNew && !PROMO_CODE_RE.test(d.code)) return 'Kod 3–32 simvol olmalıdır: böyük hərf, rəqəm və "-".';
  if (!d.title.trim()) return 'Kampaniya adını yazın.';
  const days = Number(d.new_user_days);
  if (d.eligibility === 'new_users' && (!Number.isInteger(days) || days < 1 || days > 90)) return 'Yeni hesab müddəti 1–90 gün olmalıdır.';
  if (d.max_uses && (!Number.isInteger(Number(d.max_uses)) || Number(d.max_uses) < 1)) return 'Limit müsbət tam ədəd olmalıdır.';
  if (d.ends_at && d.starts_at && new Date(d.ends_at) <= new Date(d.starts_at)) return 'Bitmə tarixi başlanğıcdan sonra olmalıdır.';
  return null;
}

function CampaignForm({ campaign, onDone }: { campaign: PromoCampaign | null; onDone: () => void }) {
  const [d, setD] = useState<Draft>(() => campaign ? draftOf(campaign) : emptyDraft());
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((prev) => ({ ...prev, [key]: value }));
  const save = async () => {
    const problem = validateDraft(d, !campaign);
    if (problem) { toast.error(problem); return; }
    setBusy(true);
    const payload = { title: d.title.trim(), duration: d.duration, eligibility: d.eligibility, new_user_days: Number(d.new_user_days) || 7,
      max_uses: d.max_uses, starts_at: fromLocalInput(d.starts_at), ends_at: fromLocalInput(d.ends_at), is_active: d.is_active, notes: d.notes,
      ...(campaign ? {} : { code: d.code }) };
    const { error } = await promoRpc('promo_admin_save_v1', { p_id: campaign?.id ?? null, p_data: payload });
    setBusy(false);
    if (error) { toast.error(error.message?.includes('duplicate') || error.message?.includes('PROMO_CODE_TAKEN') ? 'Bu kod artıq var.' : `Saxlanmadı: ${error.message}`); return; }
    toast.success('Saxlanıldı');
    onDone();
  };
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>Kod</Label>
          <Input value={d.code} disabled={!!campaign} placeholder="ROSSMANN-2026" className="font-mono uppercase"
            onChange={(e) => set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 32))} />
        </div>
        <div className="grid gap-1.5">
          <Label>Premium müddəti</Label>
          <Select value={d.duration} onValueChange={(v) => set('duration', v as PromoDuration)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PROMO_DURATIONS.map((k) => <SelectItem key={k} value={k}>{DURATION_LABEL[k]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label>Kampaniya adı (istifadəçi görür)</Label>
        <Input value={d.title} maxLength={80} placeholder="Rossmann hədiyyəsi" onChange={(e) => set('title', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>Kim ala bilər</Label>
          <Select value={d.eligibility} onValueChange={(v) => set('eligibility', v as Draft['eligibility'])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="new_users">Yalnız yeni hesablar</SelectItem>
              <SelectItem value="everyone">Hamı (köhnə hesablar da)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Yeni hesab: son neçə gün</Label>
          <Input type="number" min={1} max={90} value={d.new_user_days} disabled={d.eligibility !== 'new_users'} onChange={(e) => set('new_user_days', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-1.5">
          <Label>Maks. istifadə</Label>
          <Input type="number" min={1} value={d.max_uses} placeholder="Limitsiz" onChange={(e) => set('max_uses', e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Başlanğıc</Label>
          <Input type="datetime-local" value={d.starts_at} onChange={(e) => set('starts_at', e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Bitmə</Label>
          <Input type="datetime-local" value={d.ends_at} onChange={(e) => set('ends_at', e.target.value)} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label>Qeyd (yalnız admin)</Label>
        <Textarea rows={2} value={d.notes} placeholder="Harada paylanır, kim üçündür…" onChange={(e) => set('notes', e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm"><Switch checked={d.is_active} onCheckedChange={(v) => set('is_active', v)} /> Aktivdir</label>
      <p className="text-xs text-muted-foreground">
        Premium RevenueCat promosu kimi verilir və sinxronizasiyada itmir. App Store / Google Play-də aktiv abunəliyi olanlara verilmir.
        Hər hesab yalnız bir QR hədiyyəsi ala bilər. Kod yaradıldıqdan sonra dəyişmir.
      </p>
      <Button onClick={save} disabled={busy}>{busy ? 'Saxlanılır…' : 'Saxla'}</Button>
    </div>
  );
}

function QrPanel({ campaign }: { campaign: PromoCampaign }) {
  const ref = useRef<HTMLDivElement>(null);
  const link = promoLink(campaign.code);
  const download = () => {
    const canvas = ref.current?.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `anacan-qr-${campaign.code}.png`;
    a.click();
  };
  const copy = async () => { try { await navigator.clipboard.writeText(link); toast.success('Link kopyalandı'); } catch { toast.error('Kopyalanmadı'); } };
  return (
    <div className="flex flex-col items-center gap-3">
      <div ref={ref} className="rounded-2xl bg-white p-4">
        {/* 1024 px canvas for print; shown smaller. */}
        <QRCodeCanvas value={link} size={1024} level="M" marginSize={2} style={{ width: 240, height: 240 }} />
      </div>
      <code className="text-xs break-all text-center">{link}</code>
      <div className="flex gap-2">
        <Button size="sm" onClick={download}><Download className="w-4 h-4 me-1" />PNG yüklə</Button>
        <Button size="sm" variant="outline" onClick={copy}><Copy className="w-4 h-4 me-1" />Linki kopyala</Button>
      </div>
    </div>
  );
}

function Redemptions({ campaign }: { campaign: PromoCampaign }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-promo-redemptions', campaign.id],
    queryFn: async () => {
      const { data, error } = await promoRpc('promo_admin_redemptions_v1', { p_campaign: campaign.id });
      if (error) throw error;
      return (data ?? []) as Redemption[];
    },
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Yüklənir…</p>;
  if (!data.length) return <p className="text-sm text-muted-foreground">Hələ istifadə olunmayıb.</p>;
  return (
    <div className="max-h-[50vh] overflow-auto">
      <Table>
        <TableHeader><TableRow><TableHead>İstifadəçi</TableHead><TableHead>Status</TableHead><TableHead>Tarix</TableHead></TableRow></TableHeader>
        <TableBody>
          {data.map((r) => (
            <TableRow key={r.id}>
              <TableCell><div className="font-medium">{r.name || '—'}</div><div className="text-xs text-muted-foreground">{r.email}</div></TableCell>
              <TableCell>{r.status === 'granted' ? 'Verildi' : r.status === 'failed' ? `Alınmadı${r.note ? ` (${r.note})` : ''}` : 'Gözləyir'}</TableCell>
              <TableCell className="text-xs">{fmt(r.finished_at ?? r.created_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function AdminPromoQr() {
  const client = useQueryClient();
  const [editing, setEditing] = useState<PromoCampaign | 'new' | null>(null);
  const [qr, setQr] = useState<PromoCampaign | null>(null);
  const [users, setUsers] = useState<PromoCampaign | null>(null);
  const { data = [], isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ['admin-promo-campaigns'],
    queryFn: async () => {
      const { data, error } = await promoRpc('promo_admin_list_v1');
      if (error) throw error;
      return (data ?? []) as PromoCampaign[];
    },
  });
  const totals = useMemo(() => ({ active: data.filter((c) => c.state === 'active').length, granted: data.reduce((n, c) => n + Number(c.granted), 0) }), [data]);
  const toggle = async (c: PromoCampaign, on: boolean) => {
    const { error } = await promoRpc('promo_admin_save_v1', { p_id: c.id, p_data: { is_active: on } });
    if (error) toast.error(error.message); else void client.invalidateQueries({ queryKey: ['admin-promo-campaigns'] });
  };
  const done = () => { setEditing(null); void client.invalidateQueries({ queryKey: ['admin-promo-campaigns'] }); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><QrCode className="w-5 h-5" />QR kampaniyalar</h1>
          <p className="text-sm text-muted-foreground">QR ilə qeydiyyatdan keçənlərə avtomatik Premium. {totals.active} aktiv kampaniya, {totals.granted} hədiyyə verilib.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} aria-label="Yenilə"><RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} /></Button>
          <Button onClick={() => setEditing('new')}><Plus className="w-4 h-4 me-1" />Yeni kampaniya</Button>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">Yüklənmədi: {(error as Error).message}</p> : null}
      {isLoading ? <p className="text-sm text-muted-foreground">Yüklənir…</p> : !data.length ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Hələ kampaniya yoxdur. "Yeni kampaniya" ilə başlayın.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((c) => (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{c.title}</CardTitle>
                    <code className="text-sm font-bold">{c.code}</code>
                  </div>
                  <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${STATE_LABEL[c.state]?.cls ?? ''}`}>{STATE_LABEL[c.state]?.label ?? c.state}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{DURATION_LABEL[c.duration]} Premium</Badge>
                  <Badge variant="secondary">{c.eligibility === 'new_users' ? `Yeni hesablar (${c.new_user_days} gün)` : 'Hamı'}</Badge>
                </div>
                <div>
                  <div className="flex justify-between"><span>İstifadə</span><span className="font-semibold">{c.granted}{c.max_uses ? ` / ${c.max_uses}` : ''}</span></div>
                  {c.max_uses ? <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${Math.min(100, (Number(c.granted) / c.max_uses) * 100)}%` }} /></div> : null}
                  {Number(c.failed) > 0 && <div className="text-xs text-destructive mt-1">{c.failed} cəhd alınmadı</div>}
                </div>
                <div className="text-xs text-muted-foreground">{fmt(c.starts_at)} → {c.ends_at ? fmt(c.ends_at) : 'müddətsiz'}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 me-auto"><Switch checked={c.is_active} onCheckedChange={(v) => toggle(c, v)} />Aktiv</label>
                  <Button size="sm" variant="outline" onClick={() => setQr(c)}><QrCode className="w-4 h-4 me-1" />QR</Button>
                  <Button size="sm" variant="outline" onClick={() => setUsers(c)}><Users className="w-4 h-4 me-1" />{c.granted}</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(c)}>Redaktə</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing === 'new' ? 'Yeni QR kampaniya' : 'Kampaniyanı redaktə et'}</DialogTitle></DialogHeader>
          {editing !== null && <CampaignForm key={editing === 'new' ? 'new' : editing.id} campaign={editing === 'new' ? null : editing} onDone={done} />}
        </DialogContent>
      </Dialog>
      <Dialog open={!!qr} onOpenChange={(open) => { if (!open) setQr(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{qr?.title}</DialogTitle></DialogHeader>
          {qr && <QrPanel campaign={qr} />}
        </DialogContent>
      </Dialog>
      <Dialog open={!!users} onOpenChange={(open) => { if (!open) setUsers(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{users?.code}: istifadə edənlər</DialogTitle></DialogHeader>
          {users && <Redemptions campaign={users} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
