import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, Copy, CreditCard, Eye, EyeOff, List, RefreshCw, RotateCcw, Save, Settings2, XCircle } from 'lucide-react';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAllPaymentTransactions } from '@/hooks/useEpointPayment';
import { epointFunctionUrl } from '@/lib/epoint';
import { AdminTabs, Btn, DataTable, EmptyState, Field, FilterChips, KpiRow, Notice, Page, PageHeader, Section, SkeletonRows, StatTile, StatusPill, fmtDateTime, fmtMoney, fmtNumber, type Column, type Tone } from './kit';

const statusConfig: Record<string, { label: string; tone: Tone; icon: typeof Clock }> = {
  pending: { label: tr('adminepoint_gozleyir_9ac18a', 'Gözləyir'), tone: 'warning', icon: Clock },
  processing: { label: 'Emal olunur', tone: 'info', icon: RefreshCw },
  success: { label: tr('adminepoint_ugurlu_7fe64c', 'Uğurlu'), tone: 'success', icon: CheckCircle },
  failed: { label: tr('adminepoint_ugursuz_541932', 'Uğursuz'), tone: 'danger', icon: XCircle },
  returned: { label: tr('adminepoint_geri_qaytarilib_d80beb', 'Geri qaytarılıb'), tone: 'warning', icon: RotateCcw },
  error: { label: tr('adminepoint_xeta_3cdbb6', 'Xəta'), tone: 'danger', icon: AlertTriangle },
};
const orderTypeLabels: Record<string, string> = { cake: 'Tort', shop: tr('adminepoint_magaza_defaa2', 'Mağaza'), album: 'Albom', premium: 'Premium', general: tr('adminepoint_umumi_1b5521', 'Ümumi'), book: 'Kitab' };
interface Txn { id: string; created_at: string; order_id: string; order_type: string; amount: string | number; status: string; card_mask: string | null }

const AdminEpoint = () => {
  const [publicKey, setPublicKey] = useState(''), [privateKey, setPrivateKey] = useState(''), [mode, setMode] = useState('live');
  const [initial, setInitial] = useState({ publicKey: '', privateKey: '', mode: 'live' });
  const [showPrivateKey, setShowPrivateKey] = useState(false), [saving, setSaving] = useState(false), [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'settings' | 'transactions'>('settings');
  const [statusFilter, setStatusFilter] = useState('all');
  const { toast } = useToast();
  const { data: transactions, isLoading: txnLoading, isError: txnError, refetch: refetchTxns, isFetching } = useAllPaymentTransactions(200);

  useEffect(() => { void fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.from('app_settings').select('key, value').in('key', ['epoint_public_key', 'epoint_private_key', 'epoint_mode']);
      const next = { publicKey: '', privateKey: '', mode: 'live' };
      data?.forEach((s: any) => {
        let val = s.value;
        if (typeof val === 'string') { try { val = JSON.parse(val); } catch { /* keep */ } }
        const cleanVal = String(val).replace(/^"|"$/g, '');
        if (s.key === 'epoint_public_key') next.publicKey = cleanVal === 'null' ? '' : cleanVal;
        if (s.key === 'epoint_private_key') next.privateKey = cleanVal === 'null' ? '' : cleanVal;
        if (s.key === 'epoint_mode') next.mode = cleanVal === 'null' ? 'live' : cleanVal;
      });
      setPublicKey(next.publicKey); setPrivateKey(next.privateKey); setMode(next.mode); setInitial(next);
    } catch (error) {
      console.error('Error fetching Epoint settings:', error);
    } finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const settingsToSave = [
        { key: 'epoint_public_key', value: JSON.stringify(publicKey) },
        { key: 'epoint_private_key', value: JSON.stringify(privateKey) },
        { key: 'epoint_mode', value: JSON.stringify(mode) },
      ];
      for (const setting of settingsToSave) {
        const { data: existing } = await supabase.from('app_settings').select('id').eq('key', setting.key).single();
        if (existing) {
          const { error } = await supabase.from('app_settings').update({ value: setting.value }).eq('key', setting.key);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('app_settings').insert({ key: setting.key, value: setting.value, description: `Epoint ${setting.key}` });
          if (error) throw error;
        }
      }
      setInitial({ publicKey, privateKey, mode });
      toast({ title: tr('adminepoint_ugurlu_7fe64c', 'Uğurlu'), description: tr('adminepoint_epoint_tenzimlemeleri_yadda_saxlanildi_63ea10', 'Epoint tənzimləmələri yadda saxlanıldı') });
    } catch (error) {
      toast({ title: tr('adminepoint_xeta_3cdbb6', 'Xəta'), description: tr('adminepoint_tenzimlemeler_saxlanila_bilmedi_85e734', 'Tənzimləmələr saxlanıla bilmədi'), variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const txns = (transactions ?? []) as Txn[];
  const totalAmount = txns.filter(t => t.status === 'success').reduce((sum, t) => sum + parseFloat(String(t.amount || 0)), 0);
  const successCount = txns.filter(t => t.status === 'success').length;
  const failedCount = txns.filter(t => t.status === 'failed' || t.status === 'error').length;
  const visible = txns.filter(t => statusFilter === 'all' || t.status === statusFilter);
  const dirty = publicKey !== initial.publicKey || privateKey !== initial.privateKey || mode !== initial.mode;
  const copy = (text: string) => { void navigator.clipboard?.writeText(text); toast({ title: 'Kopyalandı' }); };

  const columns = useMemo<Column<Txn>[]>(() => [
    { key: 'date', header: 'Tarix', mobile: 'subtitle', sortable: true, sortValue: t => t.created_at, cell: t => <span className="ak-num">{fmtDateTime(t.created_at)}</span> },
    { key: 'order', header: tr('adminepoint_sifaris_id_f7533c', 'Sifariş ID'), mobile: 'title', cell: t => <span className="ak-mono">{t.order_id}</span> },
    { key: 'type', header: tr('adminepoint_nov_98ad7c', 'Növ'), cell: t => <StatusPill dot={false}>{orderTypeLabels[t.order_type] || t.order_type}</StatusPill> },
    { key: 'amount', header: tr('adminepoint_mebleg_479276', 'Məbləğ'), align: 'end', sortable: true, sortValue: t => Number(t.amount), cell: t => <strong className="ak-num">{fmtMoney(parseFloat(String(t.amount)))}</strong> },
    { key: 'status', header: 'Status', cell: t => { const sc = statusConfig[t.status] || statusConfig.pending; return <StatusPill tone={sc.tone}>{sc.label}</StatusPill>; } },
    { key: 'card', header: 'Kart', cell: t => <span className="ak-mono ak-cell-sub">{t.card_mask || '-'}</span> },
  ], []);

  return (
    <Page testId="admin-epoint">
      <PageHeader title={tr('adminepoint_epoint_odenis_sistemi_d87137', 'Epoint Ödəniş Sistemi')} subtitle={tr('adminepoint_kartla_odenis_konfiqurasiyasi_ve_emeliyy_aaf22f', 'Kartla ödəniş konfiqurasiyası və əməliyyatlar')}
        meta={!loading && <StatusPill tone={initial.mode === 'live' ? 'success' : 'warning'}>{initial.mode === 'live' ? 'Canlı' : 'Test'}</StatusPill>} />
      <AdminTabs value={activeTab} onChange={value => { setActiveTab(value); if (value === 'transactions') void refetchTxns(); }}
        items={[{ value: 'settings', label: tr('adminepoint_tenzimlemeler_085659', 'Tənzimləmələr'), icon: <Settings2 size={14} /> }, { value: 'transactions', label: tr('adminepoint_emeliyyatlar_54d70c', 'Əməliyyatlar'), icon: <List size={14} /> }]} />
      {activeTab === 'settings' ? (
        <div className="ak-grid ak-grid-2">
          <Section title={<span className="flex items-center gap-2"><CreditCard size={15} />{tr('adminepoint_epoint_api_acarlari_3a89d6', 'Epoint API Açarları')}</span>} description={tr('adminepoint_epoint_az_dashboard_dan_elde_edilen_acar_9ab01a', 'Epoint.az dashboard-dan əldə edilən açarlar')}>
            {loading ? <SkeletonRows rows={3} columns={1} /> : (
              <div className="grid gap-3.5">
                <Field label="Rejim" hint={tr('adminepoint_test_rejiminde_real_odenis_apa_0bbcf3', 'Test rejimində real ödəniş aparılmır')}>{id => (
                  <select id={id} className="ak-select w-full" value={mode} onChange={event => setMode(event.target.value)}>
                    <option value="live">{tr('adminepoint_canli_production_1d0736', '🟢 Canlı (Production)')}</option><option value="test">🟡 Test (Sandbox)</option>
                  </select>)}</Field>
                <Field label="Public Key" hint={tr('adminepoint_epoint_dashboard_da_tacir_iden_48b270', 'Epoint dashboard-da "Tacir identifikatoru" olaraq göstərilir')}>{id => (
                  <input id={id} className="ak-input ak-mono" value={publicKey} onChange={event => setPublicKey(event.target.value)} placeholder={tr('adminepoint_meselen_i000000001_56e9a2', 'Məsələn: i000000001')} />)}</Field>
                <Field label="Private Key" hint={tr('adminepoint_epoint_dashboard_da_verilen_gi_c85785', 'Epoint dashboard-da verilən gizli API açarı')}>{id => (
                  <div className="relative">
                    <input id={id} className="ak-input ak-mono pe-10" type={showPrivateKey ? 'text' : 'password'} autoComplete="off" value={privateKey} onChange={event => setPrivateKey(event.target.value)} placeholder={tr('adminepoint_api_giris_acari_34edbe', 'API giriş açarı')} />
                    <button type="button" className="ak-icon-btn absolute end-1 top-1/2 -translate-y-1/2" aria-label={showPrivateKey ? 'Gizlət' : 'Göstər'} onClick={() => setShowPrivateKey(!showPrivateKey)}>{showPrivateKey ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                  </div>)}</Field>
                <div className="flex justify-end"><Btn variant="primary" onClick={() => void handleSave()} disabled={saving || !dirty}>{saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}Yadda saxla</Btn></div>
              </div>
            )}
          </Section>
          <Section title={tr('adminepoint_epoint_dashboard_da_qeyd_edilmeli_url_le_7d11e1', 'Epoint Dashboard-da Qeyd Edilməli URL-lər')}
            description={tr('adminepoint_bu_url_leri_epoint_az_sexsi_ka_703d38', 'Bu URL-ləri Epoint.az şəxsi kabinetinizdə tacir tənzimləmələrində qeyd edin.')}>
            <div className="grid gap-2">
              {[['Success URL', `${window.location.origin}/payment/success`], ['Error URL', `${window.location.origin}/payment/error`], ['Result URL (Callback)', epointFunctionUrl('callback')]].map(([label, url]) => (
                <div key={label} className="ak-card-row flex items-center gap-2">
                  <span className="min-w-0 flex-1"><span className="ak-label block">{label}</span><code className="ak-mono text-primary break-all">{url}</code></span>
                  <button type="button" className="ak-icon-btn" aria-label={`${label} kopyala`} onClick={() => copy(url)}><Copy size={14} /></button>
                </div>
              ))}
            </div>
          </Section>
        </div>
      ) : (
        <>
          <KpiRow columns={3}>
            <StatTile label={tr('adminepoint_umumi_gelir_175bcb', 'Ümumi gəlir')} tone="success" loading={txnLoading} value={fmtMoney(totalAmount)} hint="son 200 əməliyyat" />
            <StatTile label={tr('adminepoint_ugurlu_7fe64c', 'Uğurlu')} tone="success" icon={<CheckCircle size={13} />} loading={txnLoading} value={fmtNumber(successCount)} />
            <StatTile label={tr('adminepoint_ugursuz_541932', 'Uğursuz')} tone={failedCount ? 'danger' : 'default'} icon={<XCircle size={13} />} loading={txnLoading} value={fmtNumber(failedCount)} />
          </KpiRow>
          <Section flush actions={<Btn size="sm" onClick={() => void refetchTxns()} disabled={isFetching}><RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />Yenilə</Btn>}
            title="Əməliyyatlar" description="Ən son 200 Epoint əməliyyatı">
            <div className="px-4 pb-3"><FilterChips label="Status" value={statusFilter} onChange={setStatusFilter}
              options={[{ value: 'all', label: 'Hamısı', count: txns.length }, ...Object.entries(statusConfig).map(([value, item]) => ({ value, label: item.label, count: txns.filter(t => t.status === value).length }))]} /></div>
            <DataTable testId="admin-epoint-table" columns={columns} rows={txnLoading ? undefined : visible} rowKey={t => t.id} loading={txnLoading} error={txnError ? true : null} onRetry={() => void refetchTxns()}
              pageSize={25} empty={<EmptyState title={tr('adminepoint_emeliyyat_tapilmadi_1ddf69', 'Əməliyyat tapılmadı')} />} />
          </Section>
          <Notice>Geri qaytarma Epoint kabinetində edilir.</Notice>
        </>
      )}
    </Page>
  );
};

export default AdminEpoint;
