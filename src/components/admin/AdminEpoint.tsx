import { useState, useEffect } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import { CreditCard, Save, RefreshCw, Eye, EyeOff, Settings2, List, RotateCcw, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAllPaymentTransactions } from '@/hooks/useEpointPayment';
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";
import { epointFunctionUrl } from '@/lib/epoint';

const statusConfig: Record<string, {label: string;color: string;icon: any;}> = {
  pending: { label: tr("adminepoint_gozleyir_9ac18a", "Gözləyir"), color: 'bg-yellow-500/10 text-yellow-600', icon: Clock },
  processing: { label: 'Emal olunur', color: 'bg-blue-500/10 text-blue-600', icon: RefreshCw },
  success: { label: tr("adminepoint_ugurlu_7fe64c", "Uğurlu"), color: 'bg-green-500/10 text-green-600', icon: CheckCircle },
  failed: { label: tr("adminepoint_ugursuz_541932", "Uğursuz"), color: 'bg-red-500/10 text-red-600', icon: XCircle },
  returned: { label: tr("adminepoint_geri_qaytarilib_d80beb", "Geri qaytarılıb"), color: 'bg-orange-500/10 text-orange-600', icon: RotateCcw },
  error: { label: tr("adminepoint_xeta_3cdbb6", "Xəta"), color: 'bg-red-500/10 text-red-600', icon: AlertTriangle }
};

const orderTypeLabels: Record<string, string> = {
  cake: 'Tort',
  shop: tr("adminepoint_magaza_defaa2", "Ma\u011Faza"),
  album: 'Albom',
  premium: 'Premium',
  general: tr("adminepoint_umumi_1b5521", "\xDCmumi")
};

const AdminEpoint = () => {
    const localize = useAdminLocalize();
  const [publicKey, setPublicKey] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [mode, setMode] = useState('live');
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'settings' | 'transactions'>('settings');
  const { toast } = useToast();
  const { data: transactions, isLoading: txnLoading, refetch: refetchTxns } = useAllPaymentTransactions(200);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.
      from('app_settings').
      select('key, value').
      in('key', ['epoint_public_key', 'epoint_private_key', 'epoint_mode']);

      data?.forEach((s: any) => {
        let val = s.value;
        if (typeof val === 'string') {
          try {val = JSON.parse(val);} catch {/* keep */}
        }
        const cleanVal = String(val).replace(/^"|"$/g, '');
        if (s.key === 'epoint_public_key') setPublicKey(cleanVal === 'null' ? '' : cleanVal);
        if (s.key === 'epoint_private_key') setPrivateKey(cleanVal === 'null' ? '' : cleanVal);
        if (s.key === 'epoint_mode') setMode(cleanVal === 'null' ? 'live' : cleanVal);
      });
    } catch (error) {
      console.error('Error fetching Epoint settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const settingsToSave = [
      { key: 'epoint_public_key', value: JSON.stringify(publicKey) },
      { key: 'epoint_private_key', value: JSON.stringify(privateKey) },
      { key: 'epoint_mode', value: JSON.stringify(mode) }];


      for (const setting of settingsToSave) {
        const { data: existing } = await supabase.
        from('app_settings').
        select('id').
        eq('key', setting.key).
        single();

        if (existing) {
          const { error } = await supabase.from('app_settings').update({ value: setting.value }).eq('key', setting.key);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('app_settings').insert({ key: setting.key, value: setting.value, description: `Epoint ${setting.key}` });
          if (error) throw error;
        }
      }

      toast({ title: tr("adminepoint_ugurlu_7fe64c", "Uğurlu"), description: tr("adminepoint_epoint_tenzimlemeleri_yadda_saxlanildi_63ea10", "Epoint tənzimləmələri yadda saxlanıldı") });
    } catch (error) {
      toast({ title: tr("adminepoint_xeta_3cdbb6", "Xəta"), description: tr("adminepoint_tenzimlemeler_saxlanila_bilmedi_85e734", "Tənzimləmələr saxlanıla bilmədi"), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const totalAmount = transactions?.filter((t) => t.status === 'success').
  reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0) || 0;

  const successCount = transactions?.filter((t) => t.status === 'success').length || 0;
  const failedCount = transactions?.filter((t) => t.status === 'failed' || t.status === 'error').length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{tr("adminepoint_epoint_odenis_sistemi_d87137", "Epoint Ödəniş Sistemi")}</h1>
          <p className="text-muted-foreground">{tr("adminepoint_kartla_odenis_konfiqurasiyasi_ve_emeliyy_aaf22f", "Kartla ödəniş konfiqurasiyası və əməliyyatlar")}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'settings' ? 'default' : 'outline'}
          onClick={() => setActiveTab('settings')}
          className="gap-2">
          
          <Settings2 className="w-4 h-4" />
          {tr("adminepoint_tenzimlemeler_085659", "T\u0259nziml\u0259m\u0259l\u0259r")}
        </Button>
        <Button
          variant={activeTab === 'transactions' ? 'default' : 'outline'}
          onClick={() => {setActiveTab('transactions');refetchTxns();}}
          className="gap-2">
          
          <List className="w-4 h-4" />
          {tr("adminepoint_emeliyyatlar_54d70c", "\u018Fm\u0259liyyatlar")}
        </Button>
      </div>

      {activeTab === 'settings' ?
      <div className="grid gap-6">
          {/* API Keys */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10">
                  <CreditCard className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{tr("adminepoint_epoint_api_acarlari_3a89d6", "Epoint API Açarları")}</h3>
                  <p className="text-sm text-muted-foreground">{tr("adminepoint_epoint_az_dashboard_dan_elde_edilen_acar_9ab01a", "Epoint.az dashboard-dan əldə edilən açarlar")}</p>
                </div>
              </div>

              {loading ?
            <div className="flex justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                </div> :

            <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block text-foreground">Rejim</label>
                    <Select value={mode} onValueChange={setMode}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="live">{tr("adminepoint_canli_production_1d0736", "🟢 Canlı (Production)")}</SelectItem>
                        <SelectItem value="test">🟡 Test (Sandbox)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {tr("adminepoint_test_rejiminde_real_odenis_apa_0bbcf3", "Test rejimind\u0259 real \xF6d\u0259ni\u015F apar\u0131lm\u0131r")}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block text-foreground">Public Key</label>
                    <Input
                  value={publicKey}
                  onChange={(e) => setPublicKey(e.target.value)}
                  placeholder={tr("adminepoint_meselen_i000000001_56e9a2", "Məsələn: i000000001")} />
                
                    <p className="text-xs text-muted-foreground mt-1">
                      {tr("adminepoint_epoint_dashboard_da_tacir_iden_48b270", "Epoint dashboard-da \"Tacir identifikatoru\" olaraq g\xF6st\u0259rilir")}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block text-foreground">Private Key</label>
                    <div className="relative">
                      <Input
                    type={showPrivateKey ? 'text' : 'password'}
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                    placeholder={tr("adminepoint_api_giris_acari_34edbe", "API giriş açarı")}
                    className="pe-10" />
                  
                      <Button
                    variant="ghost"
                    size="icon"
                    className="absolute end-0 top-0 h-full"
                    onClick={() => setShowPrivateKey(!showPrivateKey)}>
                    
                        {showPrivateKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {tr("adminepoint_epoint_dashboard_da_verilen_gi_c85785", "Epoint dashboard-da veril\u0259n gizli API a\xE7ar\u0131")}
                    </p>
                  </div>

                  <Button onClick={handleSave} disabled={saving} className="gap-2 w-full">
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Yadda saxla
                  </Button>
                </div>
            }
            </Card>
          </motion.div>

          {/* Setup Guide */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <AlertTriangle className="w-5 h-5 text-blue-500" />
                </div>
                <h3 className="font-semibold text-foreground">{tr("adminepoint_epoint_dashboard_da_qeyd_edilmeli_url_le_7d11e1", "Epoint Dashboard-da Qeyd Edilməli URL-lər")}</h3>
              </div>

              <div className="space-y-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="font-medium text-foreground mb-1">Success URL</p>
                  <code className="text-xs text-primary break-all">
                    {window.location.origin}/payment/success
                  </code>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="font-medium text-foreground mb-1">Error URL</p>
                  <code className="text-xs text-primary break-all">
                    {window.location.origin}/payment/error
                  </code>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="font-medium text-foreground mb-1">Result URL (Callback)</p>
                  <code className="text-xs text-primary break-all">
                    {epointFunctionUrl('callback')}
                  </code>
                </div>
                <p className="text-muted-foreground">
                  {tr("adminepoint_bu_url_leri_epoint_az_sexsi_ka_703d38", "Bu URL-l\u0259ri Epoint.az \u015F\u0259xsi kabinetinizd\u0259 tacir t\u0259nziml\u0259m\u0259l\u0259rind\u0259 qeyd edin.")}
                </p>
              </div>
            </Card>
          </motion.div>
        </div> :

      <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{totalAmount.toFixed(2)} ₼</p>
              <p className="text-xs text-muted-foreground">{tr("adminepoint_umumi_gelir_175bcb", "Ümumi gəlir")}</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{successCount}</p>
              <p className="text-xs text-muted-foreground">{tr("adminepoint_ugurlu_7fe64c", "Uğurlu")}</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{failedCount}</p>
              <p className="text-xs text-muted-foreground">{tr("adminepoint_ugursuz_541932", "Uğursuz")}</p>
            </Card>
          </div>

          {/* Transaction List */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-start p-3 font-medium text-muted-foreground">Tarix</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{tr("adminepoint_sifaris_id_f7533c", "Sifariş ID")}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">{tr("adminepoint_nov_98ad7c", "Növ")}</th>
                    <th className="text-end p-3 font-medium text-muted-foreground">{tr("adminepoint_mebleg_479276", "Məbləğ")}</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">Kart</th>
                  </tr>
                </thead>
                <tbody>
                  {txnLoading ?
                <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                        {tr("adminepoint_yuklenir_5557de", "Y\xFCkl\u0259nir...")}
                      </td>
                    </tr> :
                !transactions?.length ?
                <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">
                        {tr("adminepoint_emeliyyat_tapilmadi_1ddf69", "\u018Fm\u0259liyyat tap\u0131lmad\u0131")}
                      </td>
                    </tr> :

                transactions.map((txn: any) => {
                  const sc = statusConfig[txn.status] || statusConfig.pending;
                  const StatusIcon = sc.icon;
                  return (
                    <tr key={txn.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="p-3 text-foreground whitespace-nowrap">
                            {new Date(txn.created_at).toLocaleDateString('az-AZ', {
                          day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
                        })}
                          </td>
                          <td className="p-3">
                            <code className="text-xs text-muted-foreground">{txn.order_id}</code>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-xs">
                              {orderTypeLabels[txn.order_type] || txn.order_type}
                            </Badge>
                          </td>
                          <td className="p-3 text-end font-medium text-foreground">
                            {parseFloat(txn.amount).toFixed(2)} ₼
                          </td>
                          <td className="p-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {sc.label}
                            </span>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {txn.card_mask || '-'}
                          </td>
                        </tr>);

                })
                }
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      }
    </div>);

};

export default AdminEpoint;
