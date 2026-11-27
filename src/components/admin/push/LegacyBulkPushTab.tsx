// Split out of AdminPushNotifications.tsx (admin redesign). Logic unchanged; shared imports kept verbatim.
import { useState } from 'react';
import { tr } from '@/lib/tr';
import { Bell, Send, Users, Zap, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useBulkPushNotifications, useCreateBulkPushNotification, useSendBulkPushNotification, useAudienceStats } from '@/hooks/useAdvancedNotifications';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { audienceLabels, LoadingSpinner } from './shared';

const LegacyBulkPushTab = () => {
  const { data: history = [], isLoading, refetch: refetchHistory } = useBulkPushNotifications();
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useAudienceStats();
  const createBulk = useCreateBulkPushNotification();
  const sendBulk = useSendBulkPushNotification();

  const [form, setForm] = useState({
    title: '',
    body: '',
    target_audience: 'all'
  });
  const [isSending, setIsSending] = useState(false);
  const [showDevices, setShowDevices] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  const getTargetStats = (audience: string) => {
    if (!stats) return { users: 0, tokens: 0 };
    return stats.by_audience[audience as keyof typeof stats.by_audience] || { users: 0, tokens: 0 };
  };

  const currentTargetStats = getTargetStats(form.target_audience);

  const loadDevices = async () => {
    setLoadingDevices(true);
    try {
      const { data, error } = await supabase.
      from('device_tokens').
      select(`
          id,
          token,
          platform,
          device_name,
          created_at,
          updated_at,
          user_id
        `).
      order('created_at', { ascending: false }).
      limit(50);

      if (error) throw error;

      // Get profile info for each device
      const userIds = [...new Set(data?.map((d) => d.user_id) || [])];
      const { data: profiles } = await supabase.
      from('profiles').
      select('user_id, name, life_stage, role').
      in('user_id', userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      setDevices(data?.map((d) => ({
        ...d,
        profile: profileMap.get(d.user_id) || null
      })) || []);
    } catch (error) {
      console.error('Error loading devices:', error);
      toast.error(tr("adminpushnotifications_cihaz_siyahisi_yuklenmedi_6016ee", "Cihaz siyah\u0131s\u0131 y\xFCkl\u0259nm\u0259di"));
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleRefreshStats = async () => {
    await Promise.all([refetchStats(), refetchHistory()]);
    toast.success(tr("adminpushnotifications_statistika_yenilendi_844bd5", "Statistika yenil\u0259ndi"));
  };

  const handleSendNow = async () => {
    if (!form.title || !form.body) {
      toast.error(tr("adminpushnotifications_basliq_ve_metn_teleb_olunur_defdc8", "Ba\u015Fl\u0131q v\u0259 m\u0259tn t\u0259l\u0259b olunur"));
      return;
    }

    if (currentTargetStats.tokens === 0) {
      toast.error(tr("adminpushnotifications_secilmis_auditoriyada_hec_bir__0b165d", "Se\xE7ilmi\u015F auditoriyada he\xE7 bir qeydiyyatl\u0131 cihaz yoxdur!"));
      return;
    }

    setIsSending(true);
    try {
      // Create the bulk notification record
      const notification = await createBulk.mutateAsync(form);

      // Trigger send
      const result = await sendBulk.mutateAsync(notification.id);

      if (result.sent > 0) {
        toast.success(`${result.sent} cihaza göndərildi!`);
      } else {
        toast.warning(tr("adminpushnotifications_hec_bir_cihaza_gonderile_bilme_e9abd6", "He\xE7 bir cihaza g\xF6nd\u0259ril\u0259 bilm\u0259di. Qeydiyyatl\u0131 cihaz yoxdur."));
      }
      setForm({ title: '', body: '', target_audience: 'all' });
      refetchHistory();
    } catch (error: any) {
      toast.error(error.message || tr("adminpushnotifications_gonderme_xetasi_2db326", "G\xF6nd\u0259rm\u0259 x\u0259tas\u0131"));
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading || statsLoading) {
    return <LoadingSpinner />;
  }

  const audienceOptions = [
  { value: 'all', label: tr("adminpushnotifications_hami_e07585", "🌍 Hamı"), color: 'bg-blue-500' },
  { value: 'flow', label: '🌙 Menstruasiya', color: 'bg-pink-500' },
  { value: 'bump', label: tr("adminpushnotifications_hamile_b562bf", "🤰 Hamilə"), color: 'bg-orange-500' },
  { value: 'mommy', label: '👩‍👧 Ana', color: 'bg-red-500' },
  { value: 'partner', label: '💑 Partnyor', color: 'bg-purple-500' }];


  return (
    <div className="space-y-6">
      {/* Global Stats */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold">{tr("adminpushnotifications_push_statistikasi_c99aca", "Push Statistikası")}</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {setShowDevices(!showDevices);if (!showDevices) loadDevices();}}>
            
            📱 Cihazlar ({stats?.users_with_tokens || 0})
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefreshStats}>
            <RefreshCw className="h-4 w-4 me-1" />
            {tr("adminpushnotifications_yenile_570ce2", "Yenil\u0259")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-primary">{stats?.total_users || 0}</div>
          <div className="text-sm text-muted-foreground">{tr("adminpushnotifications_umumi_istifadeci_bae9ad", "Ümumi İstifadəçi")}</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-green-500">{stats?.users_with_tokens || 0}</div>
          <div className="text-sm text-muted-foreground">{tr("adminpushnotifications_qeydiyyatli_cihaz_94133b", "Qeydiyyatlı Cihaz")}</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-yellow-500">
            {stats?.total_users ? Math.round(stats.users_with_tokens / stats.total_users * 100) : 0}%
          </div>
          <div className="text-sm text-muted-foreground">{tr("adminpushnotifications_ehate_dairesi_ada093", "Əhatə Dairəsi")}</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-blue-500">{history.length}</div>
          <div className="text-sm text-muted-foreground">{tr("adminpushnotifications_gonderilmis_kampaniya_2c34f3", "Göndərilmiş Kampaniya")}</div>
        </Card>
      </div>

      {/* Device List */}
      {showDevices &&
      <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium">{tr("adminpushnotifications_qeydiyyatli_cihazlar_4c85f5", "Qeydiyyatlı Cihazlar")}</h4>
            <Button variant="ghost" size="sm" onClick={loadDevices} disabled={loadingDevices}>
              {loadingDevices ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
          {loadingDevices ?
        <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div> :
        devices.length === 0 ?
        <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>{tr("adminpushnotifications_hec_bir_cihaz_qeydiyyatda_deyil_75d504", "Heç bir cihaz qeydiyyatda deyil")}</p>
              <p className="text-xs mt-1">{tr("adminpushnotifications_istifadeciler_mobil_tetbiqi_acmali_ve_bi_b0748a", "İstifadəçilər mobil tətbiqi açmalı və bildiriş icazəsi verməlidir")}</p>
            </div> :

        <ScrollArea className="h-64">
              <div className="space-y-2">
                {devices.map((device) =>
            <div key={device.id} className="flex items-center justify-between p-3 bg-muted rounded-lg text-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">
                        {device.platform === 'ios' ? '🍎' : '🤖'}
                      </span>
                      <div>
                        <div className="font-medium">{device.profile?.name || 'İsimsiz'}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {device.profile?.life_stage || 'unknown'}
                          </Badge>
                          <span>{device.platform}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-end text-xs text-muted-foreground">
                      <div>Token: ...{device.token.slice(-8)}</div>
                      <div>{new Date(device.created_at).toLocaleDateString('az-AZ')}</div>
                    </div>
                  </div>
            )}
              </div>
            </ScrollArea>
        }
        </Card>
      }

      {/* Audience Breakdown */}
      <Card className="p-4">
        <h4 className="font-medium mb-4 flex items-center gap-2">
          <Users className="h-4 w-4" />
          {tr("adminpushnotifications_auditoriya_statistikasi_a1a500", "Auditoriya Statistikas\u0131")}
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {audienceOptions.map(({ value, label, color }) => {
            const audienceStats = getTargetStats(value);
            const percentage = audienceStats.users > 0 ? Math.round(audienceStats.tokens / audienceStats.users * 100) : 0;
            return (
              <div
                key={value}
                className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                form.target_audience === value ?
                'border-primary bg-primary/5' :
                'border-transparent bg-muted/50 hover:bg-muted'}`
                }
                onClick={() => setForm({ ...form, target_audience: value })}>
                
                <div className="text-sm font-medium mb-1">{label}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{audienceStats.users} 👤</span>
                  <span className="text-green-500">{audienceStats.tokens} 📱</span>
                </div>
                <Progress value={percentage} className="h-1 mt-2" />
              </div>);

          })}
        </div>
      </Card>

      {/* Send Form */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          {tr("adminpushnotifications_bulk_push_gonder_547a93", "Bulk Push G\xF6nd\u0259r")}
        </h3>

        <div className="space-y-4">
          {/* Target Preview */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <div className="text-2xl">
                {form.target_audience === 'all' ? '🌍' :
                form.target_audience === 'flow' ? '🌙' :
                form.target_audience === 'bump' ? '🤰' :
                form.target_audience === 'mommy' ? '👩‍👧' : '💑'}
              </div>
              <div>
                <div className="font-medium">
                  {audienceOptions.find((a) => a.value === form.target_audience)?.label || tr("adminpushnotifications_hami_c33b89", "Ham\u0131")}
                </div>
                <div className="text-sm text-muted-foreground">
                  {currentTargetStats.tokens > 0 ?
                  `${currentTargetStats.tokens} cihaza göndəriləcək` : tr("adminpushnotifications_bu_auditoriyada_qeydiyyatli_ci_31e27d", "\u26A0\uFE0F Bu auditoriyada qeydiyyatl\u0131 cihaz yoxdur!")

                  }
                </div>
              </div>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            currentTargetStats.tokens > 0 ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`
            }>
              {currentTargetStats.tokens} 📱
            </div>
          </div>

          <div className="space-y-2">
            <Label>{tr("adminpushnotifications_hedef_auditoriya_50154d", "Hədəf Auditoriya")}</Label>
            <Select value={form.target_audience} onValueChange={(v) => setForm({ ...form, target_audience: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {audienceOptions.map(({ value, label }) =>
                <SelectItem key={value} value={value}>
                    {label} ({getTargetStats(value).tokens} cihaz)
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{tr("adminpushnotifications_basliq_e1f6c5", "Başlıq")}</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={tr("adminpushnotifications_xususi_xeber_00380f", "🎉 Xüsusi Xəbər!")} />
            
          </div>

          <div className="space-y-2">
            <Label>{tr("adminpushnotifications_metn_6e9f0f", "Mətn")}</Label>
            <Textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder={tr("adminpushnotifications_butun_istifadecilere_gonderilecek_mesaj_75e61e", "Bütün istifadəçilərə göndəriləcək mesaj...")}
              rows={4} />
            
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={handleSendNow}
            disabled={isSending || !form.title || !form.body || currentTargetStats.tokens === 0}>
            
            {isSending ?
            <>
                <Loader2 className="h-4 w-4 me-2 animate-spin" />
                {tr("adminpushnotifications_gonderilir_1d548c", "G\xF6nd\u0259rilir...")}
              </> :

            <>
                <Send className="h-4 w-4 me-2" />
                {currentTargetStats.tokens} {tr("adminpushnotifications_cihaza_gonder_4ef80f", "Cihaza G\xF6nd\u0259r")}
              </>
            }
          </Button>

          {currentTargetStats.tokens === 0 &&
          <p className="text-sm text-center text-amber-500">
              {tr("adminpushnotifications_bu_auditoriyada_push_notificat_8775b1", "\u26A0\uFE0F Bu auditoriyada push notification almaq \xFC\xE7\xFCn qeydiyyatdan ke\xE7mi\u015F cihaz yoxdur. \n              \u0130stifad\u0259\xE7il\u0259r t\u0259tbiqi mobil cihazlar\u0131ndan a\xE7mal\u0131 v\u0259 bildiri\u015F icaz\u0259si verm\u0259lidir.")}
            
          </p>
          }
        </div>
      </Card>

      {/* History */}
      <div>
        <h3 className="text-lg font-semibold mb-4">{tr("adminpushnotifications_gonderilme_tarixcesi_929970", "Göndərilmə Tarixçəsi")}</h3>
        
        {history.length === 0 ?
        <Card className="p-8 text-center">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{tr("adminpushnotifications_hele_hec_bir_bulk_bildiris_gonderilmeyib_74a908", "Hələ heç bir bulk bildiriş göndərilməyib")}</p>
          </Card> :

        <div className="space-y-3">
            {history.map((item: any) => {
            const total = item.total_sent + item.total_failed;
            const successRate = total > 0 ? Math.round(item.total_sent / total * 100) : 0;

            return (
              <Card key={item.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-medium">{item.title}</h4>
                        <Badge variant="outline">
                          {audienceLabels[item.target_audience]?.label || tr("adminpushnotifications_hami_c33b89", "Ham\u0131")}
                        </Badge>
                        <Badge className={
                      item.status === 'sent' ? 'bg-green-500/10 text-green-600' :
                      item.status === 'sending' ? 'bg-yellow-500/10 text-yellow-600' :
                      item.status === 'failed' ? 'bg-red-500/10 text-red-600' :
                      'bg-muted text-muted-foreground'
                      }>
                          {item.status === 'sent' ? tr("adminpushnotifications_gonderildi_6cf847", "G\xF6nd\u0259rildi") :
                        item.status === 'sending' ? tr("adminpushnotifications_gonderilir_1d548c", "G\xF6nd\u0259rilir...") :
                        item.status === 'failed' ? tr("adminpushnotifications_xeta_3cdbb6", "X\u0259ta") : tr("adminpushnotifications_gozleyir_9ac18a", "G\xF6zl\u0259yir")}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{item.body}</p>
                      
                      {/* Statistics */}
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-green-600">✅ {item.total_sent} {tr("adminpushnotifications_gonderildi_db78e3", "g\xF6nd\u0259rildi")}</span>
                        {item.total_failed > 0 &&
                      <span className="text-red-500">❌ {item.total_failed} {tr("adminpushnotifications_ugursuz_fbfe49", "u\u011Fursuz")}</span>
                      }
                        {total > 0 &&
                      <span className="text-muted-foreground">
                            📊 {successRate}{tr("adminpushnotifications_ugurlu_bbe493", "% u\u011Furlu")}
                          </span>
                      }
                        <span className="text-muted-foreground">
                          🕐 {new Date(item.created_at).toLocaleString('az-AZ')}
                        </span>
                      </div>
                      
                      {/* Progress bar for large sends */}
                      {total > 0 &&
                    <div className="mt-2">
                          <Progress value={successRate} className="h-1.5" />
                        </div>
                    }
                    </div>
                  </div>
                </Card>);

          })}
          </div>
        }
      </div>
    </div>);

};

export default LegacyBulkPushTab;
