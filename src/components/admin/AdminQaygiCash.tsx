import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Coins, Globe, History, Package, RefreshCw, Search, ShieldCheck, Timer, TrendingDown, TrendingUp, UserRound, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// QayğıCash admin. Money is integer minor units (qəpik); rates are basis points (500 = 5%).
export type ProgramStatus = 'draft' | 'live' | 'paused';
export interface PremiumRedeem {
  enabled: boolean;
  monthly: { enabled: boolean; price_minor: number };
  yearly: { enabled: boolean; price_minor: number };
  platforms: { ios: boolean; android: boolean; web: boolean };
}
export interface Program {
  country: string; currency: string; status: ProgramStatus; hold_days_physical: number; hold_days_digital: number; expiry_months: number;
  max_redeem_pct: number; min_redeem_minor: number; monthly_earn_cap_minor: number; control_pct: number; redeem_channels: string[];
  premium_redeem: PremiumRedeem | null; terms_version: string | null; updated_at: string | null;
}
export interface Rule { country: string; channel: string; rate_bp: number; own_product: boolean; fixed_base_minor: number | null; version: number; updated_at: string | null }
export interface Overview {
  programs: Program[]; rules: Rule[]; liability_available_minor: number; liability_pending_minor: number; debt_minor: number;
  issued_30d_minor: number; redeemed_30d_minor: number; expired_minor: number; wallets: number; own_products: number;
  by_channel_30d: Record<string, number> | null; log: { id: number; admin_id: string | null; action: string; target: string | null; detail: unknown; created_at: string }[];
}
interface ProductRow { id: string; name: string; brand: string | null; store: string | null; price: number | null; is_active: boolean; cashback_own: boolean }
interface UserResult {
  found: boolean; user_id?: string; email?: string | null; available_minor?: number; pending_minor?: number;
  wallet?: { country: string; currency: string; debt_minor: number; cohort: string; created_at: string } | null;
  lots?: { id: number; channel: string; source_type: string; source_id: string; rate_bp: number; base_minor: number; amount_minor: number; remaining_minor: number; available_at: string; expires_at: string; state: string; note: string | null }[];
  redemptions?: { id: number; order_type: string; order_id: string; amount_minor: number; status: string; created_at: string; note: string | null }[];
  ledger?: { id: number; kind: string; amount_minor: number; actor: string; note: string | null; created_at: string }[];
}

type RpcResult = { data: unknown; error: { message?: string } | null };
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as unknown as (fn: string, params?: Record<string, unknown>) => Promise<RpcResult>)(name, args);
const OVERVIEW_KEY = ['admin-qaygicash-overview'];
const STATUS: Record<ProgramStatus, { label: string; cls: string }> = {
  draft: { label: 'Qaralama', cls: 'bg-orange-500/10 text-orange-700' },
  live: { label: 'Aktiv', cls: 'bg-green-500/10 text-green-700' },
  paused: { label: 'Dayandırılıb', cls: 'bg-red-500/10 text-red-700' },
};
const CHANNELS: Record<string, string> = {
  premium_yearly: 'Premium illik', premium_monthly: 'Premium aylıq', book: 'PDF kitablar', cake: 'Tortlar',
  own_shop: 'Anacan brend məhsulları (aptek/shop)', partner: 'Tərəfdaş məhsulları (aptek)', affiliate: 'Affiliate keçidlər',
};
const CHANNEL_ORDER = Object.keys(CHANNELS);
const REDEEM_CHANNELS: [string, string][] = [['aptek', 'Aptek / mağaza'], ['cake', 'Tortlar'], ['book', 'PDF kitablar']];
const PREMIUM_CHANNELS = new Set(['premium_yearly', 'premium_monthly']);
export const DEFAULT_PREMIUM: PremiumRedeem = { enabled: false, monthly: { enabled: false, price_minor: 399 }, yearly: { enabled: false, price_minor: 2699 }, platforms: { ios: false, android: false, web: false } };

const num = (value: unknown) => Number(value ?? 0) || 0;
/** 123456 → "1 234,56 ₼" (other currencies use their ISO code). */
export function formatMinor(minor: unknown, currency = 'AZN') {
  const value = Math.round(num(minor)), abs = Math.abs(value);
  const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${value < 0 ? '−' : ''}${whole},${String(abs % 100).padStart(2, '0')} ${currency === 'AZN' ? '₼' : currency}`;
}
/** "26,99" / "26.99" / "-2,5" → minor units; null when invalid. */
export function parseMoney(text: string, allowSign = false): number | null {
  const clean = text.trim().replace(/\s/g, '').replace('−', '-').replace(',', '.');
  if (!(allowSign ? /^[+-]?\d+(\.\d{1,2})?$/ : /^\d+(\.\d{1,2})?$/).test(clean)) return null;
  return Math.round(Number(clean) * 100);
}
/** Accepts "0" or 0,5…5 in 0,5 steps; returns basis points or null. */
export function parseRate(text: string): number | null {
  const clean = text.trim().replace('%', '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  const bp = Math.round(Number(clean) * 100);
  if (Math.abs(Number(clean) * 100 - bp) > 1e-6) return null;
  if (bp === 0) return 0;
  return bp >= 50 && bp <= 500 && bp % 50 === 0 ? bp : null;
}
const rateText = (bp: number) => String(bp / 100).replace('.', ',');
const minorText = (minor: number | null | undefined) => minor == null ? '' : (minor / 100).toFixed(2).replace('.', ',');
const date = (value: string | null | undefined) => value ? new Date(value).toLocaleString('az-AZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const errorText = (error: { message?: string } | null) => error?.message ? `: ${error.message}` : '';

function useOverview() {
  return useQuery({ queryKey: OVERVIEW_KEY, queryFn: async () => {
    const { data, error } = await rpc('qaygicash_admin_overview_v1'); if (error) throw error; return data as Overview; } });
}

export default function AdminQaygiCash() {
  const [tab, setTab] = useState('overview');
  const { data, isLoading, error, refetch } = useOverview();
  const countries = useMemo(() => (data?.programs ?? []).map(program => program.country), [data]);
  const [country, setCountry] = useState('AZ');
  useEffect(() => { if (countries.length && !countries.includes(country)) setCountry(countries[0]); }, [countries, country]);
  return (
    <div className="space-y-4" data-testid="admin-qaygicash">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Coins size={22} /></span>
        <div className="flex-1"><h1 className="text-xl font-bold">QayğıCash</h1>
          <p className="text-sm text-muted-foreground">Keşbek proqramı: öhdəlik, ölkə proqramları, dərəcələr və istifadəçi balansları. Bütün dəyərlər serverdə yoxlanır.</p></div>
        <Button size="sm" variant="ghost" aria-label="Yenilə" onClick={() => refetch()}><RefreshCw size={14} /></Button>
      </div>
      {isLoading ? <p className="p-6 text-sm text-muted-foreground">Yüklənir…</p>
        : error || !data ? <p className="p-6 text-sm text-destructive">QayğıCash məlumatları yüklənmədi{errorText(error as { message?: string } | null)}.</p>
          : <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="overview">Ümumi</TabsTrigger>
              <TabsTrigger value="programs">Proqramlar</TabsTrigger>
              <TabsTrigger value="rules">Dərəcələr</TabsTrigger>
              <TabsTrigger value="premium">Premium bonusla</TabsTrigger>
              <TabsTrigger value="products">Məhsullar</TabsTrigger>
              <TabsTrigger value="user">İstifadəçi</TabsTrigger>
            </TabsList>
            {['rules', 'premium'].includes(tab) && <CountryPicker countries={countries} value={country} onChange={setCountry} />}
            <TabsContent value="overview"><OverviewTab data={data} /></TabsContent>
            <TabsContent value="programs"><ProgramsTab data={data} /></TabsContent>
            <TabsContent value="rules"><RulesTab data={data} country={country} /></TabsContent>
            <TabsContent value="premium"><PremiumTab program={data.programs.find(program => program.country === country)} /></TabsContent>
            <TabsContent value="products"><ProductsTab /></TabsContent>
            <TabsContent value="user"><UserTab /></TabsContent>
          </Tabs>}
    </div>
  );
}

function CountryPicker({ countries, value, onChange }: { countries: string[]; value: string; onChange: (value: string) => void }) {
  return <div className="mt-3 flex items-center gap-2 text-sm"><Globe size={14} className="text-muted-foreground" />
    <label htmlFor="qc-country">Ölkə</label>
    <select id="qc-country" className="h-9 rounded-md border bg-background px-2 text-sm" value={value} onChange={event => onChange(event.target.value)}>
      {countries.map(code => <option key={code} value={code}>{code}</option>)}
    </select></div>;
}

function Kpi({ icon: Icon, label, value, hint }: { icon: typeof Wallet; label: string; value: string; hint?: string }) {
  return <Card><CardContent className="p-4">
    <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon size={14} />{label}</div>
    <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
    {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
  </CardContent></Card>;
}
function StatusPill({ status }: { status: ProgramStatus }) {
  const meta = STATUS[status] ?? { label: status, cls: 'bg-muted' };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}>{meta.label}</span>;
}

function OverviewTab({ data }: { data: Overview }) {
  const channels = Object.entries(data.by_channel_30d ?? {}).sort((a, b) => num(b[1]) - num(a[1]));
  const max = Math.max(1, ...channels.map(([, value]) => num(value)));
  return (
    <div className="space-y-4 mt-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Wallet} label="Öhdəlik: hazır balans" value={formatMinor(data.liability_available_minor)} />
        <Kpi icon={Timer} label="Öhdəlik: gözləmədə" value={formatMinor(data.liability_pending_minor)} hint="Gözləmə müddəti bitməyib" />
        <Kpi icon={AlertTriangle} label="Borc" value={formatMinor(data.debt_minor)} hint="Geri qaytarılan sifarişlərdən" />
        <Kpi icon={TrendingUp} label="Son 30 gün yazılan" value={formatMinor(data.issued_30d_minor)} />
        <Kpi icon={TrendingDown} label="Son 30 gün xərclənən" value={formatMinor(data.redeemed_30d_minor)} />
        <Kpi icon={History} label="Vaxtı bitən" value={formatMinor(data.expired_minor)} />
        <Kpi icon={UserRound} label="Cüzdan sayı" value={String(num(data.wallets))} />
        <Kpi icon={Package} label="Öz brend məhsulları" value={String(num(data.own_products))} />
      </div>
      <div className="grid lg:grid-cols-2 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Son 30 gün: kanallar üzrə yazılan</CardTitle></CardHeader><CardContent className="space-y-2">
          {channels.length ? channels.map(([channel, value]) => <div key={channel} className="flex items-center gap-3 text-sm">
            <span className="w-40 shrink-0 truncate text-muted-foreground">{CHANNELS[channel] ?? channel}</span>
            <div className="h-3 flex-1 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${(num(value) / max) * 100}%` }} /></div>
            <span className="w-24 shrink-0 text-end font-medium">{formatMinor(value)}</span>
          </div>) : <p className="text-sm text-muted-foreground">Hələ məlumat yoxdur.</p>}
        </CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Admin jurnalı</CardTitle></CardHeader><CardContent>
          {data.log?.length ? <Table><TableHeader><TableRow><TableHead>Tarix</TableHead><TableHead>Əməliyyat</TableHead><TableHead>Hədəf</TableHead><TableHead>Detallar</TableHead></TableRow></TableHeader>
            <TableBody>{data.log.map(entry => <TableRow key={entry.id}>
              <TableCell className="whitespace-nowrap text-xs">{date(entry.created_at)}</TableCell><TableCell>{entry.action}</TableCell>
              <TableCell className="text-xs">{entry.target ?? '—'}</TableCell>
              <TableCell className="max-w-[240px] truncate font-mono text-[11px]" title={JSON.stringify(entry.detail)}>{JSON.stringify(entry.detail)}</TableCell>
            </TableRow>)}</TableBody></Table> : <p className="text-sm text-muted-foreground">Jurnal boşdur.</p>}
        </CardContent></Card>
      </div>
    </div>
  );
}

const PROGRAM_FIELDS: { key: keyof Program; label: string; min: number; max?: number; money?: boolean; hint?: string }[] = [
  { key: 'hold_days_physical', label: 'Gözləmə (fiziki), gün', min: 0, max: 60, hint: 'Qaytarma riski bitənə qədər balans gözləmədə qalır.' },
  { key: 'hold_days_digital', label: 'Gözləmə (rəqəmsal), gün', min: 0, max: 60 },
  { key: 'expiry_months', label: 'Etibarlılıq müddəti, ay', min: 1, max: 36 },
  { key: 'max_redeem_pct', label: 'Maks. istifadə, sifarişin %-i', min: 1, max: 100 },
  { key: 'min_redeem_minor', label: 'Min. istifadə məbləği', min: 0, money: true },
  { key: 'monthly_earn_cap_minor', label: 'Aylıq qazanma limiti', min: 0, money: true },
  { key: 'control_pct', label: 'Nəzarət qrupu, %', min: 0, max: 50, hint: 'Bu faiz qədər istifadəçi QayğıCash görmür; proqramın təsirini ölçmək üçündür. 0 = hamı görür.' },
];

function useSaveProgram() {
  const client = useQueryClient();
  return async (country: string, patch: Record<string, unknown>, success = 'Yadda saxlanıldı') => {
    const { error } = await rpc('qaygicash_admin_set_program_v1', { p_country: country, p_patch: patch });
    if (error) { toast.error(`Yadda saxlanılmadı${errorText(error)}`); return false; }
    toast.success(success); void client.invalidateQueries({ queryKey: OVERVIEW_KEY }); return true;
  };
}

function ProgramsTab({ data }: { data: Overview }) {
  const [editing, setEditing] = useState<string | null>(null);
  const program = data.programs.find(row => row.country === editing);
  return (
    <div className="space-y-3 mt-3">
      <Card><CardContent className="p-0">
        <Table><TableHeader><TableRow>
          <TableHead>Ölkə</TableHead><TableHead>Valyuta</TableHead><TableHead>Status</TableHead><TableHead>Gözləmə</TableHead>
          <TableHead>Müddət</TableHead><TableHead>Maks. istifadə</TableHead><TableHead>Nəzarət</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>{data.programs.map(row => <TableRow key={row.country} data-testid={`qc-program-${row.country}`}>
            <TableCell className="font-bold">{row.country}</TableCell><TableCell>{row.currency}</TableCell><TableCell><StatusPill status={row.status} /></TableCell>
            <TableCell>{row.hold_days_physical} / {row.hold_days_digital} gün</TableCell><TableCell>{row.expiry_months} ay</TableCell>
            <TableCell>{row.max_redeem_pct}%</TableCell><TableCell>{row.control_pct}%</TableCell>
            <TableCell className="text-end"><Button size="sm" variant={editing === row.country ? 'default' : 'outline'} onClick={() => setEditing(editing === row.country ? null : row.country)}>Redaktə</Button></TableCell>
          </TableRow>)}</TableBody></Table>
      </CardContent></Card>
      {program && <ProgramForm key={`${program.country}:${program.updated_at}`} program={program} onClose={() => setEditing(null)} />}
      <NewCountry existing={data.programs.map(row => row.country)} />
    </div>
  );
}

function ProgramForm({ program, onClose }: { program: Program; onClose: () => void }) {
  const save = useSaveProgram();
  const initial = () => Object.fromEntries(PROGRAM_FIELDS.map(field => [field.key, field.money ? minorText(num(program[field.key])) : String(program[field.key] ?? '')])) as Record<string, string>;
  const [values, setValues] = useState(initial);
  const [status, setStatus] = useState<ProgramStatus>(program.status);
  const [channels, setChannels] = useState<string[]>(program.redeem_channels ?? []);
  const [terms, setTerms] = useState(program.terms_version ?? '');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const errors: Record<string, string> = {};
  const patch: Record<string, unknown> = {};
  for (const field of PROGRAM_FIELDS) {
    const raw = values[field.key];
    const parsed = field.money ? parseMoney(raw) : /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : null;
    if (parsed == null || parsed < field.min || (field.max != null && parsed > field.max)) {
      errors[field.key] = field.money ? 'Məbləğ düzgün deyil' : `${field.min}–${field.max} aralığında tam ədəd`; continue;
    }
    if (parsed !== num(program[field.key])) patch[field.key] = parsed;
  }
  if (status !== program.status) patch.status = status;
  const sortedChannels = [...channels].sort();
  if (sortedChannels.join() !== [...(program.redeem_channels ?? [])].sort().join()) patch.redeem_channels = sortedChannels;
  if (terms.trim() !== (program.terms_version ?? '')) patch.terms_version = terms.trim() || null;
  const invalid = Object.keys(errors).length > 0;
  const submit = async () => {
    if (invalid) return;
    if (!Object.keys(patch).length) { toast.info('Dəyişiklik yoxdur'); return; }
    if (patch.status && patch.status !== 'draft' && !confirming) { setConfirming(true); return; }
    setBusy(true); const ok = await save(program.country, patch, `${program.country} proqramı yeniləndi`); setBusy(false); setConfirming(false);
    if (ok) onClose();
  };
  return (
    <Card data-testid="qc-program-form"><CardHeader className="pb-2"><CardTitle className="text-sm">{program.country} proqramı · {program.currency}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PROGRAM_FIELDS.map(field => <div key={field.key} className="space-y-1">
            <Label htmlFor={`qc-${field.key}`}>{field.label}{field.money ? ` (${program.currency === 'AZN' ? '₼' : program.currency})` : ''}</Label>
            <Input id={`qc-${field.key}`} inputMode="decimal" value={values[field.key]} aria-invalid={!!errors[field.key]}
              onChange={event => { setConfirming(false); setValues(previous => ({ ...previous, [field.key]: event.target.value })); }} />
            {errors[field.key] ? <p className="text-xs text-destructive">{errors[field.key]}</p> : field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
          </div>)}
          <div className="space-y-1"><Label htmlFor="qc-status">Status</Label>
            <select id="qc-status" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={status} onChange={event => { setConfirming(false); setStatus(event.target.value as ProgramStatus); }}>
              {(Object.keys(STATUS) as ProgramStatus[]).map(value => <option key={value} value={value}>{STATUS[value].label}</option>)}
            </select></div>
          <div className="space-y-1"><Label htmlFor="qc-terms">Qaydaların versiyası</Label>
            <Input id="qc-terms" value={terms} onChange={event => setTerms(event.target.value)} placeholder="məs. 2026-11-v1" /></div>
        </div>
        <div className="space-y-2"><p className="text-sm font-medium">Balansın istifadə oluna biləcəyi yerlər</p>
          <div className="flex flex-wrap gap-4">{REDEEM_CHANNELS.map(([id, label]) => <label key={id} className="flex items-center gap-2 text-sm">
            <Checkbox checked={channels.includes(id)} onCheckedChange={checked => setChannels(previous => checked ? [...new Set([...previous, id])] : previous.filter(value => value !== id))} />{label}</label>)}</div>
        </div>
        {confirming && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-orange-300 bg-orange-500/10 p-3 text-sm text-orange-900">
          <AlertTriangle size={16} />
          <span className="flex-1">{status === 'live'
            ? `${program.country} proqramı aktiv ediləcək: tətbiq yeniləməsi olmadan bu ölkədəki istifadəçilər QayğıCash görəcək.`
            : `${program.country} proqramı dayandırılacaq: yeni keşbek yazılmayacaq və balans istifadəsi bağlanacaq.`}</span>
          <Button size="sm" disabled={busy} onClick={submit}>Bəli, təsdiqlə</Button>
          <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>Ləğv et</Button>
        </div>}
        <div className="flex gap-2"><Button disabled={busy || invalid || confirming} onClick={submit}>Yadda saxla</Button><Button variant="ghost" onClick={onClose}>Bağla</Button></div>
      </CardContent></Card>
  );
}

function NewCountry({ existing }: { existing: string[] }) {
  const save = useSaveProgram();
  const [code, setCode] = useState(''), [currency, setCurrency] = useState(''), [busy, setBusy] = useState(false);
  const codeError = code && !/^[A-Z]{2}$/.test(code) ? 'ISO-2 kod (məs. TR)' : existing.includes(code) ? 'Bu ölkə artıq var' : '';
  const currencyError = currency && !/^[A-Z]{3}$/.test(currency) ? 'ISO-3 valyuta (məs. TRY)' : '';
  const valid = !!code && !!currency && !codeError && !currencyError;
  const create = async () => {
    setBusy(true); const ok = await save(code, { currency }, `${code} qaralama kimi yaradıldı`); setBusy(false);
    if (ok) { setCode(''); setCurrency(''); }
  };
  return (
    <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Yeni ölkə</CardTitle></CardHeader><CardContent className="space-y-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="space-y-1"><Label htmlFor="qc-new-code">Ölkə kodu</Label>
          <Input id="qc-new-code" className="w-28" maxLength={2} value={code} placeholder="TR" onChange={event => setCode(event.target.value.toUpperCase())} />
          {codeError && <p className="text-xs text-destructive">{codeError}</p>}</div>
        <div className="space-y-1"><Label htmlFor="qc-new-currency">Valyuta</Label>
          <Input id="qc-new-currency" className="w-28" maxLength={3} value={currency} placeholder="TRY" onChange={event => setCurrency(event.target.value.toUpperCase())} />
          {currencyError && <p className="text-xs text-destructive">{currencyError}</p>}</div>
        <Button className="mt-6" disabled={!valid || busy} onClick={create}>Qaralama yarat</Button>
      </div>
      <p className="text-xs text-muted-foreground">Yeni ölkə "Qaralama" statusunda və bütün dərəcələr 0% ilə yaradılır. Dərəcələri və qaydaların versiyasını tənzimləyin, sonra statusu "Aktiv" edin: ölkə tətbiq buraxılışı olmadan açılır.</p>
    </CardContent></Card>
  );
}

function RulesTab({ data, country }: { data: Overview; country: string }) {
  const program = data.programs.find(row => row.country === country);
  const rules = data.rules.filter(rule => rule.country === country)
    .sort((a, b) => (CHANNEL_ORDER.indexOf(a.channel) + 1 || 99) - (CHANNEL_ORDER.indexOf(b.channel) + 1 || 99));
  return (
    <div className="space-y-3 mt-3">
      <Card><CardContent className="p-0">
        <Table><TableHeader><TableRow><TableHead>Kateqoriya</TableHead><TableHead>Qrup</TableHead><TableHead>Dərəcə %</TableHead>
          <TableHead>Sabit baza</TableHead><TableHead>100 {program?.currency === 'AZN' || !program ? '₼' : program.currency} alışda</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>{rules.length ? rules.map(rule => <RuleRow key={`${rule.country}:${rule.channel}:${rule.version}`} rule={rule} currency={program?.currency ?? 'AZN'} />)
            : <TableRow><TableCell colSpan={6} className="text-muted-foreground">Bu ölkə üçün qayda yoxdur.</TableCell></TableRow>}</TableBody></Table>
      </CardContent></Card>
      <p className="text-xs text-muted-foreground">Dərəcə ya 0%, ya da 0,5–5% (0,5 addımla) olmalıdır. Tərəfdaş məhsulları kilidlidir (0%). App Store / Google Play Premium keşbeki mağaza qiymətinə deyil, sabit bazaya hesablanır. Dəyişiklik dərhal tətbiqdəki nişanlara və ödəniş ekranına təsir edir; hər dəyişiklik versiya və müəlliflə yazılır.</p>
    </div>
  );
}

function RuleRow({ rule, currency }: { rule: Rule; currency: string }) {
  const client = useQueryClient();
  const [rate, setRate] = useState(rateText(rule.rate_bp));
  const [own, setOwn] = useState(rule.own_product);
  const [base, setBase] = useState(minorText(rule.fixed_base_minor));
  const [busy, setBusy] = useState(false);
  const premium = PREMIUM_CHANNELS.has(rule.channel);
  const bp = own ? parseRate(rate) : 0;
  const baseMinor = premium && base.trim() ? parseMoney(base) : null;
  const baseError = premium && base.trim() && baseMinor == null;
  const dirty = bp !== rule.rate_bp || own !== rule.own_product || (premium && baseMinor !== (rule.fixed_base_minor ?? null));
  const save = async () => {
    if (bp == null || baseError) return;
    setBusy(true);
    const { error } = await rpc('qaygicash_admin_set_rule_v1', { p_country: rule.country, p_channel: rule.channel, p_rate_bp: bp, p_own: own, p_fixed_base_minor: premium ? baseMinor : null });
    setBusy(false);
    if (error) toast.error(`Dərəcə saxlanılmadı${errorText(error)}`);
    else { toast.success(`${CHANNELS[rule.channel] ?? rule.channel}: ${rateText(bp)}%`); void client.invalidateQueries({ queryKey: OVERVIEW_KEY }); }
  };
  return (
    <TableRow data-testid={`qc-rule-${rule.channel}`}>
      <TableCell>{CHANNELS[rule.channel] ?? rule.channel}<span className="block text-[11px] text-muted-foreground">v{rule.version}</span></TableCell>
      <TableCell><label className="flex items-center gap-2 text-xs">
        <Switch aria-label={`${CHANNELS[rule.channel] ?? rule.channel}: öz məhsul`} checked={own} onCheckedChange={value => { setOwn(value); if (!value) setRate('0'); }} />
        <span className={`rounded-full px-2 py-0.5 font-medium ${own ? 'bg-green-500/10 text-green-700' : 'bg-orange-500/10 text-orange-700'}`}>{own ? 'Öz məhsul' : 'Tərəfdaş'}</span></label></TableCell>
      <TableCell><Input aria-label={`${CHANNELS[rule.channel] ?? rule.channel}: dərəcə %`} className="w-20" inputMode="decimal" value={own ? rate : '0'} disabled={!own}
        aria-invalid={bp == null} onChange={event => setRate(event.target.value)} />
        {bp == null && <p className="mt-1 text-xs text-destructive">0 və ya 0,5–5 (0,5 addımla)</p>}</TableCell>
      <TableCell>{premium ? <><Input aria-label={`${CHANNELS[rule.channel]}: sabit baza`} className="w-24" inputMode="decimal" value={base} placeholder="—" onChange={event => setBase(event.target.value)} />
        {baseError ? <p className="mt-1 text-xs text-destructive">Məbləğ düzgün deyil</p> : baseMinor != null && bp != null && <p className="mt-1 text-[11px] text-muted-foreground">Mağaza alışı: {formatMinor(Math.floor(baseMinor * bp / 10000), currency)}</p>}</>
        : <span className="text-muted-foreground">—</span>}</TableCell>
      <TableCell className="whitespace-nowrap">{bp == null ? '—' : formatMinor(bp, currency)}</TableCell>
      <TableCell className="text-end"><Button size="sm" variant={dirty ? 'default' : 'outline'} disabled={busy || bp == null || !!baseError || !dirty} onClick={save}>Saxla</Button></TableCell>
    </TableRow>
  );
}

function PremiumTab({ program }: { program?: Program }) {
  if (!program) return <p className="p-6 text-sm text-muted-foreground">Ölkə seçin.</p>;
  return <PremiumForm key={`${program.country}:${program.updated_at}`} program={program} />;
}

function PremiumForm({ program }: { program: Program }) {
  const save = useSaveProgram();
  const source = program.premium_redeem ?? DEFAULT_PREMIUM;
  const [config, setConfig] = useState<PremiumRedeem>({
    enabled: !!source.enabled,
    monthly: { enabled: !!source.monthly?.enabled, price_minor: num(source.monthly?.price_minor ?? DEFAULT_PREMIUM.monthly.price_minor) },
    yearly: { enabled: !!source.yearly?.enabled, price_minor: num(source.yearly?.price_minor ?? DEFAULT_PREMIUM.yearly.price_minor) },
    platforms: { ios: !!source.platforms?.ios, android: !!source.platforms?.android, web: !!source.platforms?.web },
  });
  const [prices, setPrices] = useState({ monthly: minorText(config.monthly.price_minor), yearly: minorText(config.yearly.price_minor) });
  const [busy, setBusy] = useState(false);
  const monthlyPrice = parseMoney(prices.monthly), yearlyPrice = parseMoney(prices.yearly);
  const priceInvalid = !monthlyPrice || !yearlyPrice;
  const symbol = program.currency === 'AZN' ? '₼' : program.currency;
  const submit = async () => {
    if (priceInvalid) return;
    const premium_redeem: PremiumRedeem = { enabled: config.enabled, monthly: { enabled: config.monthly.enabled, price_minor: monthlyPrice },
      yearly: { enabled: config.yearly.enabled, price_minor: yearlyPrice }, platforms: { ...config.platforms } };
    setBusy(true); await save(program.country, { premium_redeem }, 'Premium bonusla ayarları yadda saxlanıldı'); setBusy(false);
  };
  const plan = (key: 'monthly' | 'yearly', label: string) => <div className="flex flex-wrap items-center gap-3 border-b py-3 last:border-0">
    <Switch aria-label={label} checked={config[key].enabled} onCheckedChange={value => setConfig(previous => ({ ...previous, [key]: { ...previous[key], enabled: value } }))} />
    <span className="flex-1 text-sm font-medium">{label}</span>
    <Label htmlFor={`qc-premium-${key}`} className="text-xs text-muted-foreground">Qiymət ({symbol})</Label>
    <Input id={`qc-premium-${key}`} className="w-28" inputMode="decimal" value={prices[key]} aria-invalid={!parseMoney(prices[key])}
      onChange={event => setPrices(previous => ({ ...previous, [key]: event.target.value }))} />
  </div>;
  return (
    <div className="space-y-3 mt-3">
      <div role="note" className="flex gap-3 rounded-xl border border-orange-300 bg-orange-500/10 p-3 text-sm text-orange-900">
        <AlertTriangle size={18} className="shrink-0" />
        <div><b>Diqqət: mağaza qaydaları.</b> Rəqəmsal məzmunun (Premium) iOS/Android tətbiqinin içində tətbiqdaxili bonusla alınması App Store 3.1.1 və Google Play ödəniş qaydalarını poza bilər və tətbiqin rədd edilməsinə səbəb ola bilər. Əvvəlcə yalnız Web platformasını aktiv etmək tövsiyə olunur; iOS/Android-i hüquqi yoxlamadan sonra açın.</div>
      </div>
      <Card><CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-4">
          <div><b className="text-sm">Premium-u QayğıCash ilə almaq ({program.country})</b><p className="text-xs text-muted-foreground mt-1">Söndürülü olanda heç bir plan və platformada balansla Premium alınmır.</p></div>
          <Switch aria-label="Premium bonusla: əsas açar" checked={config.enabled} onCheckedChange={value => setConfig(previous => ({ ...previous, enabled: value }))} />
        </div>
      </CardContent></Card>
      <Card><CardHeader className="pb-0"><CardTitle className="text-sm">Planlar</CardTitle></CardHeader><CardContent>
        {plan('monthly', 'Aylıq plan')}{plan('yearly', 'İllik plan')}
        {priceInvalid && <p className="text-xs text-destructive mt-2">Qiymət müsbət məbləğ olmalıdır (məs. 3,99).</p>}
      </CardContent></Card>
      <Card><CardHeader className="pb-0"><CardTitle className="text-sm">Platformalar</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-6 pt-4">
        {([['web', 'Web'], ['ios', 'iOS'], ['android', 'Android']] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm">
          <Switch aria-label={`Platforma: ${label}`} checked={config.platforms[key]} onCheckedChange={value => setConfig(previous => ({ ...previous, platforms: { ...previous.platforms, [key]: value } }))} />{label}</label>)}
      </CardContent></Card>
      <Button disabled={busy || priceInvalid} onClick={submit}>Premium ayarlarını saxla</Button>
    </div>
  );
}

function ProductsTab() {
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const { data = [], isLoading, error } = useQuery({ queryKey: ['admin-qaygicash-products'], queryFn: async () => {
    const { data, error } = await rpc('qaygicash_admin_products_v1'); if (error) throw error; return (data ?? []) as ProductRow[]; } });
  const rows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('az');
    return query ? data.filter(row => `${row.name} ${row.brand ?? ''} ${row.store ?? ''}`.toLocaleLowerCase('az').includes(query)) : data;
  }, [data, search]);
  const toggle = async (row: ProductRow, own: boolean) => {
    setBusy(row.id);
    const { error } = await rpc('qaygicash_admin_set_product_own_v1', { p_product: row.id, p_own: own });
    setBusy(null);
    if (error) toast.error(`Yadda saxlanılmadı${errorText(error)}`);
    else { toast.success(own ? `${row.name}: Anacan brendi` : `${row.name}: tərəfdaş məhsulu`); void client.invalidateQueries({ queryKey: ['admin-qaygicash-products'] }); void client.invalidateQueries({ queryKey: OVERVIEW_KEY }); }
  };
  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Yüklənir…</p>;
  if (error) return <p className="p-6 text-sm text-destructive">Məhsullar yüklənmədi.</p>;
  return (
    <div className="space-y-3 mt-3">
      <p className="text-xs text-muted-foreground">Anacan brendi kimi işarələnən aptek məhsulları "öz məhsul" dərəcəsi ilə keşbek qazandırır; qalanları tərəfdaş məhsuludur (0%).</p>
      <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-8" placeholder="Məhsul, brend və ya mağaza" value={search} onChange={event => setSearch(event.target.value)} /></div>
      <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Məhsul</TableHead><TableHead>Brend</TableHead><TableHead>Mağaza</TableHead>
        <TableHead>Qiymət</TableHead><TableHead>Anacan brendi (QayğıCash)</TableHead></TableRow></TableHeader>
        <TableBody>{rows.length ? rows.map(row => <TableRow key={row.id}>
          <TableCell>{row.name}{!row.is_active && <span className="ms-2 rounded-full bg-muted px-2 py-0.5 text-[11px]">deaktiv</span>}</TableCell>
          <TableCell>{row.brand ?? '—'}</TableCell><TableCell>{row.store ?? '—'}</TableCell>
          <TableCell className="whitespace-nowrap">{row.price == null ? '—' : formatMinor(Math.round(num(row.price) * 100))}</TableCell>
          <TableCell><Switch aria-label={`${row.name}: Anacan brendi`} checked={row.cashback_own} disabled={busy === row.id} onCheckedChange={value => toggle(row, value)} /></TableCell>
        </TableRow>) : <TableRow><TableCell colSpan={5} className="text-muted-foreground">Məhsul tapılmadı.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
    </div>
  );
}

function UserTab() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<UserResult | null>(null);
  const [busy, setBusy] = useState(false);
  const lookup = async (value = query) => {
    if (!value.trim()) return;
    setBusy(true);
    const { data, error } = await rpc('qaygicash_admin_user_v1', { p_query: value.trim() });
    setBusy(false);
    if (error) { toast.error(`Axtarış alınmadı${errorText(error)}`); return; }
    setResult(data as UserResult);
  };
  const currency = result?.wallet?.currency ?? 'AZN';
  return (
    <div className="space-y-3 mt-3">
      <form className="flex gap-2" onSubmit={event => { event.preventDefault(); void lookup(); }}>
        <Input aria-label="E-poçt və ya istifadəçi ID" placeholder="E-poçt və ya istifadəçi ID (uuid)" value={query} onChange={event => setQuery(event.target.value)} />
        <Button type="submit" disabled={busy || !query.trim()}><Search size={14} className="me-1" />Axtar</Button>
      </form>
      {result && !result.found && <p className="text-sm text-muted-foreground">İstifadəçi tapılmadı.</p>}
      {result?.found && <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi icon={UserRound} label="İstifadəçi" value={result.email ?? '—'} hint={result.user_id} />
          <Kpi icon={Wallet} label="Hazır balans" value={formatMinor(result.available_minor, currency)} />
          <Kpi icon={Timer} label="Gözləmədə" value={formatMinor(result.pending_minor, currency)} />
          <Kpi icon={ShieldCheck} label="Cüzdan" value={result.wallet ? `${result.wallet.country} · ${result.wallet.cohort === 'control' ? 'nəzarət qrupu' : 'üzv'}` : 'yoxdur'}
            hint={result.wallet ? `Borc: ${formatMinor(result.wallet.debt_minor, currency)} · ${date(result.wallet.created_at)}` : undefined} />
        </div>
        <AdjustForm userId={result.user_id!} currency={currency} onDone={() => lookup(result.user_id!)} />
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Lotlar (qazanılan keşbek)</CardTitle></CardHeader><CardContent>
          <Table><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Kanal</TableHead><TableHead>Mənbə</TableHead><TableHead>Dərəcə</TableHead><TableHead>Məbləğ</TableHead>
            <TableHead>Qalıq</TableHead><TableHead>Hazır olur</TableHead><TableHead>Bitir</TableHead><TableHead>Vəziyyət</TableHead></TableRow></TableHeader>
            <TableBody>{result.lots?.length ? result.lots.map(lot => <TableRow key={lot.id}>
              <TableCell>{lot.id}</TableCell><TableCell>{CHANNELS[lot.channel] ?? lot.channel}</TableCell><TableCell className="text-xs">{lot.source_type}:{lot.source_id}</TableCell>
              <TableCell>{rateText(lot.rate_bp)}%</TableCell><TableCell className="whitespace-nowrap">{formatMinor(lot.amount_minor, currency)}</TableCell>
              <TableCell className="whitespace-nowrap">{formatMinor(lot.remaining_minor, currency)}</TableCell><TableCell className="text-xs">{date(lot.available_at)}</TableCell>
              <TableCell className="text-xs">{date(lot.expires_at)}</TableCell><TableCell>{lot.state === 'reversed' ? 'geri alınıb' : 'aktiv'}</TableCell>
            </TableRow>) : <TableRow><TableCell colSpan={9} className="text-muted-foreground">Lot yoxdur.</TableCell></TableRow>}</TableBody></Table>
        </CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">İstifadələr</CardTitle></CardHeader><CardContent>
          <Table><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Sifariş</TableHead><TableHead>Məbləğ</TableHead><TableHead>Status</TableHead><TableHead>Tarix</TableHead></TableRow></TableHeader>
            <TableBody>{result.redemptions?.length ? result.redemptions.map(row => <TableRow key={row.id}>
              <TableCell>{row.id}</TableCell><TableCell className="text-xs">{row.order_type}:{row.order_id}</TableCell>
              <TableCell className="whitespace-nowrap">{formatMinor(row.amount_minor, currency)}</TableCell>
              <TableCell>{({ reserved: 'rezerv', committed: 'istifadə edilib', released: 'buraxılıb' } as Record<string, string>)[row.status] ?? row.status}</TableCell>
              <TableCell className="text-xs">{date(row.created_at)}</TableCell>
            </TableRow>) : <TableRow><TableCell colSpan={5} className="text-muted-foreground">İstifadə yoxdur.</TableCell></TableRow>}</TableBody></Table>
        </CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Jurnal</CardTitle></CardHeader><CardContent>
          <Table><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Növ</TableHead><TableHead>Məbləğ</TableHead><TableHead>İcraçı</TableHead><TableHead>Qeyd</TableHead><TableHead>Tarix</TableHead></TableRow></TableHeader>
            <TableBody>{result.ledger?.length ? result.ledger.map(row => <TableRow key={row.id}>
              <TableCell>{row.id}</TableCell><TableCell>{row.kind}</TableCell>
              <TableCell className={`whitespace-nowrap ${row.amount_minor < 0 ? 'text-destructive' : 'text-green-700'}`}>{formatMinor(row.amount_minor, currency)}</TableCell>
              <TableCell className="text-xs">{row.actor}</TableCell><TableCell className="text-xs">{row.note ?? '—'}</TableCell><TableCell className="text-xs">{date(row.created_at)}</TableCell>
            </TableRow>) : <TableRow><TableCell colSpan={6} className="text-muted-foreground">Jurnal boşdur.</TableCell></TableRow>}</TableBody></Table>
        </CardContent></Card>
      </>}
    </div>
  );
}

function AdjustForm({ userId, currency, onDone }: { userId: string; currency: string; onDone: () => void }) {
  const [amount, setAmount] = useState(''), [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false), [busy, setBusy] = useState(false);
  const minor = parseMoney(amount, true);
  const amountError = amount.trim() && (minor == null || minor === 0 || Math.abs(minor) > 10000) ? 'Məbləğ ±0,01 – ±100,00 aralığında olmalıdır' : '';
  const valid = minor != null && !amountError && reason.trim().length >= 5;
  const apply = async () => {
    setBusy(true);
    const { error } = await rpc('qaygicash_admin_adjust_v1', { p_user: userId, p_amount_minor: minor, p_reason: reason.trim() });
    setBusy(false); setConfirming(false);
    if (error) { toast.error(`Düzəliş alınmadı${errorText(error)}`); return; }
    toast.success('Balans düzəlişi yazıldı'); setAmount(''); setReason(''); onDone();
  };
  return (
    <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Əl ilə düzəliş</CardTitle></CardHeader><CardContent className="space-y-2">
      <div className="flex flex-wrap items-start gap-3">
        <div className="space-y-1"><Label htmlFor="qc-adjust-amount">Məbləğ ({currency === 'AZN' ? '₼' : currency}, işarə ilə)</Label>
          <Input id="qc-adjust-amount" className="w-36" inputMode="decimal" placeholder="+5,00 və ya -2,50" value={amount} onChange={event => { setConfirming(false); setAmount(event.target.value); }} />
          {amountError && <p className="text-xs text-destructive">{amountError}</p>}</div>
        <div className="space-y-1 flex-1 min-w-[220px]"><Label htmlFor="qc-adjust-reason">Səbəb (ən azı 5 simvol)</Label>
          <Input id="qc-adjust-reason" value={reason} onChange={event => { setConfirming(false); setReason(event.target.value); }} placeholder="məs. Dəstək: gecikmiş sifariş kompensasiyası" /></div>
        <Button className="mt-6" disabled={!valid || busy || confirming} onClick={() => setConfirming(true)}>Düzəliş et</Button>
      </div>
      {confirming && minor != null && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-orange-300 bg-orange-500/10 p-3 text-sm text-orange-900">
        <span className="flex-1">{minor > 0 ? `${formatMinor(minor, currency)} dərhal hazır balansa əlavə olunacaq.` : `${formatMinor(-minor, currency)} balansdan çıxılacaq.`} Əməliyyat jurnala yazılır.</span>
        <Button size="sm" disabled={busy} onClick={apply}>Bəli, təsdiqlə</Button>
        <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>Ləğv et</Button>
      </div>}
      <p className="text-xs text-muted-foreground">Müsbət düzəliş dərhal istifadə oluna bilər; mənfi düzəliş balansdan çıxılır.</p>
    </CardContent></Card>
  );
}
