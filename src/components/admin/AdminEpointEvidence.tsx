import { useState } from 'react';
import { FileSearch, Printer, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Btn, DescriptionList, EmptyState, Notice, Page, PageHeader, Section, StatusPill, fmtDateTime, fmtMoney, type Tone } from './kit';

/**
 * Epoint compliance evidence (2026-11-11): look up a payment by Epoint transaction ID, our order ID or the buyer's
 * e-mail and get everything Epoint asks for: order, payment confirmation, delivery (access granted, e-mail sent,
 * PDF downloads), consent and subscription state. "Sübut PDF" opens a printable page (save as PDF in the dialog).
 * Data: admin_epoint_evidence_v1 (admins only, 20261111090000_epoint_evidence.sql).
 */
export interface Evidence {
  type: 'book' | 'premium' | 'cake'; order_id: string; provider_transaction: string | null; status: string; amount: number; currency: string;
  created_at: string; paid_at: string | null; email: string | null; name: string | null; phone?: string | null; user_id: string | null; product: string | null;
  provider?: string; channel?: string | null; items?: number; unit_price?: number; granted_at?: string | null; email_sent_at?: string | null;
  consent_at?: string | null; consent_version?: string | null; downloads?: Array<{ at: string; book_id: string; via: string; ip: string | null; user_agent: string | null }>;
  kind?: string; plan?: string; error?: string | null; period_start?: string | null; period_end?: string | null; subscription_status?: string;
  cancel_at_period_end?: boolean; cancelled_at?: string | null; ended_at?: string | null; card_mask?: string | null; card_saved_at?: string | null;
  payment_status?: string | null; delivery_date?: string | null; delivery_address?: string | null;
  /** Saved snapshots (epoint_evidence_archive): taken automatically on payment and on PDF delivery. */
  archive?: Array<{ captured_at: string; reason: 'paid' | 'delivered' | 'backfill'; sha256: string }>;
}
const ARCHIVE_REASON: Record<string, string> = { paid: 'ödəniş təsdiqi', delivered: 'PDF çatdırılması', backfill: 'ilkin arxiv' };

const TYPE: Record<Evidence['type'], string> = { book: 'PDF kitab', premium: 'Premium abunəlik', cake: 'Tort sifarişi' };
const STATUS: Record<string, [string, Tone]> = {
  paid: ['Ödənilib', 'success'], failed: ['Uğursuz', 'danger'], pending: ['Gözləmədə', 'warning'], cancelled: ['Ləğv', 'neutral'], refunded: ['Geri qaytarılıb', 'warning'],
};
const SUB: Record<string, string> = { active: 'Aktiv', past_due: 'Ödəniş gecikir', cancelled: 'Ləğv edilib (dövr sonuna qədər açıq)', expired: 'Bitib', pending: 'Gözləmədə' };
const CONSENT: Record<string, string> = {
  'digital-delivery-v1': 'PDF-lərin dərhal çatdırılmasına, 14 günlük imtina hüququnun itirilməsinə və İstifadə şərtlərinə razılıq',
  'premium-autorenew-v1': 'Avtomatik yenilənməyə, kartın Epoint-də saxlanmasına və İstifadə şərtlərinə razılıq',
};
const dt = (value: string | null | undefined) => (value ? fmtDateTime(value) : '—');

/** The evidence rows shared by the card and the printable page. */
export function evidenceRows(e: Evidence): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ['Məhsul növü', TYPE[e.type] + (e.type === 'premium' ? ` (${e.plan === 'yearly' ? 'illik' : 'aylıq'}, ${e.kind === 'renewal' ? 'yenilənmə' : 'ilk ödəniş'})` : '')],
    ['Epoint əməliyyat ID', e.provider_transaction || '—'], ['Sifariş ID (Epoint order_id)', e.order_id],
    ['Sifariş yaradılıb', dt(e.created_at)], ['Ödəniş təsdiqlənib (Epoint imzalı cavabı)', dt(e.paid_at)],
    ['Status', (STATUS[e.status]?.[0] ?? e.status) + (e.error ? ` · ${e.error}` : '')], ['Məbləğ', `${fmtMoney(e.amount)} ${e.currency}`],
    ['Məhsul', e.product || '—'], ['Alıcı', e.name || '—'], ['Alıcının e-poçtu', e.email || '—'],
  ];
  if (e.phone) rows.push(['Telefon', e.phone]);
  rows.push(['Anacan hesab ID', e.user_id || '—']);
  if (e.type === 'book') {
    rows.push(['Kanal', e.channel === 'web' ? 'anacan.az saytı' : 'Anacan tətbiqi'], ['Kitablar hesaba əlavə olunub', dt(e.granted_at)],
      ['PDF linkləri olan e-poçt göndərilib', dt(e.email_sent_at)], ['PDF yükləmələri', e.downloads?.length ? `${e.downloads.length} dəfə, ilk: ${dt(e.downloads[0].at)}` : 'Qeyd yoxdur']);
  }
  if (e.type === 'premium') {
    rows.push(['Premium aktivləşib', dt(e.paid_at)], ['Xidmət dövrü', `${dt(e.period_start)} – ${dt(e.period_end)}`],
      ['Kartın saxlanmasına razılıq (Epoint kart qeydiyyatı)', e.card_saved_at ? dt(e.card_saved_at) + (e.card_mask ? ` · ${e.card_mask}` : '') : '—'],
      ['Abunəliyin statusu', (SUB[e.subscription_status ?? ''] ?? e.subscription_status ?? '—') + (e.cancelled_at ? ` · ləğv: ${dt(e.cancelled_at)}` : '')]);
  }
  if (e.type === 'cake') rows.push(['Ödəniş statusu', e.payment_status || '—'], ['Çatdırılma tarixi', e.delivery_date || '—'], ['Ünvan', e.delivery_address || '—']);
  rows.push(['Saxlanmış sübut (arxiv)', e.archive?.length
    ? e.archive.map((a) => `${dt(a.captured_at)} · ${ARCHIVE_REASON[a.reason] ?? a.reason} · SHA-256 ${a.sha256.slice(0, 16)}…`).join('\n') : 'Hələ yoxdur']);
  if (e.type !== 'cake') rows.push(['Alıcının razılığı', e.consent_at ? `${dt(e.consent_at)} · ${CONSENT[e.consent_version ?? ''] ?? e.consent_version}` : 'Qeyd yoxdur (razılıq qeydi 11.11.2026-dan saxlanır)']);
  return rows;
}

const esc = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Printable evidence page (one transaction), opened in a new window; the admin saves it as PDF. */
export function evidenceHtml(e: Evidence): string {
  const rows = evidenceRows(e).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v).replace(/\n/g, '<br>')}</td></tr>`).join('');
  const dl = e.downloads?.length ? `<h2>PDF yükləmələri</h2><table><tr><th>Vaxt</th><td><b>Kitab · kanal · IP · cihaz</b></td></tr>${e.downloads.map((d) =>
    `<tr><th>${esc(dt(d.at))}</th><td>${esc(`${d.book_id} · ${d.via === 'email_link' ? 'e-poçt linki' : 'hesabdan'} · ${d.ip ?? '—'} · ${(d.user_agent ?? '—').slice(0, 120)}`)}</td></tr>`).join('')}</table>` : '';
  return `<!doctype html><html lang="az"><meta charset="utf-8"><title>Epoint sübutu ${esc(e.provider_transaction || e.order_id)}</title><style>
body{font-family:Arial,sans-serif;color:#24181a;margin:28px;font-size:12px}h1{font-size:18px;margin:0 0 4px}h2{font-size:14px;margin:18px 0 6px;color:#c93c43}
.m{color:#7a6b63;font-size:11px;margin:0 0 14px}table{border-collapse:collapse;width:100%}th,td{text-align:left;vertical-align:top;padding:6px 8px;border-bottom:1px solid #eee}th{width:40%;color:#5a4a4d}
</style><h1>Əməliyyat sübutu: ${esc(e.provider_transaction || e.order_id)}</h1>
<p class="m">"ANACAN" MMC · VÖEN 1407578211 · Şamil Əzizbəyov 150, Bakı · info@anacan.az · +994 10 321 65 07 · Hazırlanıb: ${esc(fmtDateTime(new Date().toISOString()))} (Anacan verilənlər bazası)</p>
<table>${rows}</table>${dl}<script>window.onload=function(){window.print()}</script></html>`;
}

function EvidenceCard({ e }: { e: Evidence }) {
  const [label, tone] = STATUS[e.status] ?? [e.status, 'neutral' as Tone];
  const print = () => {
    const w = window.open('', '_blank', 'noopener=no');
    if (!w) return;
    w.document.open(); w.document.write(evidenceHtml(e)); w.document.close();
  };
  return <Section title={`${TYPE[e.type]} · ${e.provider_transaction || e.order_id}`} actions={<><StatusPill tone={tone}>{label}</StatusPill>
    <Btn size="sm" onClick={print}><Printer size={14} />Sübut PDF</Btn></>} testId="epoint-evidence-card">
    <DescriptionList items={evidenceRows(e).map(([k, v]) => [k, <span key={k} className="whitespace-pre-line break-words">{v}</span>])} />
    {!!e.downloads?.length && <div className="mt-3 text-xs text-muted-foreground">
      {e.downloads.map((d) => <div key={d.at + d.book_id}>{dt(d.at)} · {d.book_id} · {d.via === 'email_link' ? 'e-poçt linki' : 'hesabdan'} · {d.ip ?? '—'}</div>)}
    </div>}
  </Section>;
}

const AdminEpointEvidence = () => {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Evidence[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const search = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const q = query.trim();
    if (q.length < 4) { setError('Epoint əməliyyat ID, sifariş ID və ya e-poçt yazın.'); return; }
    setBusy(true); setError('');
    const { data, error: rpcError } = await (supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>)('admin_epoint_evidence_v1', { p_query: q });
    setBusy(false);
    if (rpcError) { setError('Axtarış alınmadı. Admin hüququnu və bağlantını yoxlayın.'); setItems(null); return; }
    setItems(Array.isArray(data) ? data as Evidence[] : []);
  };
  return <Page testId="admin-epoint-evidence">
    <PageHeader title="Epoint sübutu" subtitle="Epoint compliance sorğuları üçün hər əməliyyatın sübutu: sifariş, ödəniş təsdiqi, çatdırılma, razılıq" icon={<FileSearch size={20} />} />
    <Section title="Axtar">
      <form className="flex flex-wrap gap-2" onSubmit={search}>
        <input className="h-10 min-w-[260px] flex-1 rounded-lg border bg-background px-3 text-sm" value={query} onChange={(event) => setQuery(event.target.value)}
          placeholder="te023782504 · sifariş ID · alici@example.com" aria-label="Epoint əməliyyat ID, sifariş ID və ya e-poçt" />
        <Btn type="submit" variant="primary" disabled={busy}><Search size={14} />{busy ? 'Axtarılır…' : 'Axtar'}</Btn>
      </form>
      {error && <div className="mt-3"><Notice tone="warning">{error}</Notice></div>}
      <p className="mt-3 text-xs text-muted-foreground">Epoint kabinetindəki "Transaction" (te…) nömrəsi, bizim sifariş ID (Epoint-də order_id) və ya alıcının e-poçtu ilə axtarın. PDF kitab, Premium abunəlik və tort ödənişləri.</p>
    </Section>
    {items && !items.length && <EmptyState title="Tapılmadı" description="Bu ID və ya e-poçtla əməliyyat yoxdur." />}
    {items?.map((item) => <EvidenceCard key={item.type + item.order_id} e={item} />)}
  </Page>;
};

export default AdminEpointEvidence;
