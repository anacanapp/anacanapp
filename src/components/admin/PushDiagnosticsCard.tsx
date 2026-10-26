import { tr } from "@/lib/tr";import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Bug, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Diagnostic panel for push notifications.
 * Lets the admin trigger the real `send-daily-notifications` pipeline targeted ONLY at their own user
 * (skipping dedup) and view the full edge function response for debugging.
 *
 * No bulk pushes are ever sent from this panel.
 */
const PushDiagnosticsCard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState<null | 'me-daily' | 'me-flow' | 'check-tokens' | 'me-event'>(null);
  const [lastResult, setLastResult] = useState<any>(null);

  /**
   * COMMUNITY (event) push yolunun UCDAN-UCA testi: like/reply/DM push-larının
   * getdiyi EYNİ funksiya (send-push-notification) öz cihazına çağırılır
   * (context: 'self'). Telefona bildiriş GƏLİRSƏ → token + FCM + cihaz
   * göstərimi tam işləyir; deməli real like/reply pushunun getməməsinin səbəbi
   * QƏBUL EDƏNİN tokeni/icazəsidir (Crash Reports-da [push:...] qeydlərinə bax).
   */
  const sendEventPushToMe = async () => {
    if (!user) {
      toast.error(tr("pushdiagnosticscard_giris_etmelisiniz_6c2220", "Giri\u015F etm\u0259lisiniz"));
      return;
    }
    setLoading('me-event');
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          userId: user.id,
          title: tr("pushdiag_event_test_title", "Community push testi ❤️"),
          body: tr("pushdiag_event_test_body", "Bu bildirişi görürsənsə, like/reply push yolu cihazında tam işləyir."),
          data: { type: 'diagnostic', context: 'self' }
        }
      });
      if (error) throw error;
      setLastResult({ kind: 'send-push-notification (event yolu)', payload: data });
      const sent = data?.sent ?? 0;
      if (sent > 0) {
        toast.success(tr("pushdiag_event_sent", "Event push göndərildi — telefona baxın!"));
      } else {
        toast.warning(`${tr("pushdiag_event_zero", "Göndərilmədi:")} ${data?.skipped || data?.message || '—'}`);
      }
    } catch (err: any) {
      setLastResult({ kind: 'error', payload: err?.message || String(err) });
      toast.error(tr("pushdiagnosticscard_xeta_dbbc36", "X\u0259ta: ") + (err?.message || tr("pushdiagnosticscard_namelum_974fd5", "nam\u0259lum")));
    } finally {
      setLoading(null);
    }
  };

  const sendDailyToMe = async () => {
    if (!user) {
      toast.error(tr("pushdiagnosticscard_giris_etmelisiniz_6c2220", "Giri\u015F etm\u0259lisiniz"));
      return;
    }
    setLoading('me-daily');
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-daily-notifications', {
        body: { manual: true, userId: user.id, skipDedup: true }
      });
      if (error) throw error;
      setLastResult({ kind: 'send-daily-notifications', payload: data });
      const sent = data?.sent ?? 0;
      if (sent > 0) {
        toast.success(`${sent} dinamik push göndərildi (sənin cihazına)`);
      } else {
        toast.warning(tr("pushdiagnosticscard_push_hazirlandi_amma_0_gonderi_af80a2", "Push haz\u0131rland\u0131, amma 0 g\xF6nd\u0259rildi. Detallar\u0131 a\u015Fa\u011F\u0131da g\xF6r."));
      }
    } catch (err: any) {
      console.error(err);
      setLastResult({ kind: 'error', payload: err?.message || String(err) });
      toast.error(tr("pushdiagnosticscard_xeta_dbbc36", "X\u0259ta: ") + (err?.message || tr("pushdiagnosticscard_namelum_974fd5", "nam\u0259lum")));
    } finally {
      setLoading(null);
    }
  };

  const sendFlowToMe = async () => {
    if (!user) {
      toast.error(tr("pushdiagnosticscard_giris_etmelisiniz_6c2220", "Giri\u015F etm\u0259lisiniz"));
      return;
    }
    setLoading('me-flow');
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-flow-reminders', {
        body: { manual: true }
      });
      if (error) throw error;
      setLastResult({ kind: 'send-flow-reminders', payload: data });
      toast.success(tr("pushdiagnosticscard_flow_reminders_icra_edildi_det_a7156b", "Flow reminders icra edildi. Detallar a\u015Fa\u011F\u0131da."));
    } catch (err: any) {
      console.error(err);
      setLastResult({ kind: 'error', payload: err?.message || String(err) });
      toast.error(tr("pushdiagnosticscard_xeta_dbbc36", "X\u0259ta: ") + (err?.message || tr("pushdiagnosticscard_namelum_974fd5", "nam\u0259lum")));
    } finally {
      setLoading(null);
    }
  };

  const checkMyTokens = async () => {
    if (!user) return;
    setLoading('check-tokens');
    setLastResult(null);
    try {
      const { data, error } = await supabase.
      from('device_tokens').
      select('platform, device_name, updated_at, token').
      eq('user_id', user.id).
      order('updated_at', { ascending: false });
      if (error) throw error;
      const masked = (data || []).map((t: any) => ({
        platform: t.platform,
        device_name: t.device_name,
        updated_at: t.updated_at,
        tokenSuffix: '...' + (t.token || '').slice(-12)
      }));
      setLastResult({ kind: 'my-device-tokens', count: masked.length, payload: masked });
      if (masked.length === 0) {
        toast.warning(tr("pushdiagnosticscard_hec_bir_cihaz_tokeni_yoxdur_mo_d3fe9f", "He\xE7 bir cihaz tokeni yoxdur. Mobil t\u0259tbiqi a\xE7 v\u0259 icaz\u0259 ver."));
      } else {
        toast.success(`${masked.length} aktiv token tapıldı`);
      }
    } catch (err: any) {
      setLastResult({ kind: 'error', payload: err?.message });
      toast.error(tr("pushdiagnosticscard_xeta_dbbc36", "X\u0259ta: ") + (err?.message || tr("pushdiagnosticscard_namelum_974fd5", "nam\u0259lum")));
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card className="p-4 border-2 border-dashed border-primary/40 bg-primary/5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Bug className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold">Push Diaqnostika</h3>
            <p className="text-xs text-muted-foreground">
              {tr("pushdiagnosticscard_yalniz_senin_oz_cihazina_test__194710", "Yaln\u0131z s\u0259nin \xF6z cihaz\u0131na test push g\xF6nd\u0259rir. He\xE7 kim\u0259 k\xFCtl\u0259vi g\xF6nd\u0259rilmir.")}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={checkMyTokens}
            disabled={loading !== null}>
            
            {loading === 'check-tokens' ?
            <Loader2 className="h-4 w-4 me-1 animate-spin" /> :

            <RefreshCw className="h-4 w-4 me-1" />
            }
            {tr("pushdiagnosticscard_tokenlerimi_yoxla_749170", "Tokenl\u0259rimi yoxla")}
          </Button>
          <Button
            size="sm"
            onClick={sendDailyToMe}
            disabled={loading !== null}>
            
            {loading === 'me-daily' ?
            <Loader2 className="h-4 w-4 me-1 animate-spin" /> :

            <Send className="h-4 w-4 me-1" />
            }
            {tr("pushdiagnosticscard_mene_dinamik_push_gonder_642e6b", "M\u0259n\u0259 dinamik push g\xF6nd\u0259r")}
          </Button>
          <Button
            size="sm"
            onClick={sendEventPushToMe}
            disabled={loading !== null}
            className="bg-rose-500 hover:bg-rose-600 text-white">
            
            {loading === 'me-event' ?
            <Loader2 className="h-4 w-4 me-1 animate-spin" /> :

            <Send className="h-4 w-4 me-1" />
            }
            {tr("pushdiag_event_btn", "Community push testi")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={sendFlowToMe}
            disabled={loading !== null}>
            
            {loading === 'me-flow' ?
            <Loader2 className="h-4 w-4 me-1 animate-spin" /> :

            <Send className="h-4 w-4 me-1" />
            }
            {tr("pushdiagnosticscard_flow_reminderlerini_icra_et_f80582", "Flow reminderl\u0259rini icra et")}
          </Button>
        </div>
      </div>

      {lastResult &&
      <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline">{lastResult.kind}</Badge>
            {typeof lastResult.count === 'number' &&
          <Badge variant="secondary">{lastResult.count} qeyd</Badge>
          }
          </div>
          <pre className="text-xs bg-background border rounded p-3 max-h-80 overflow-auto whitespace-pre-wrap break-words">
            {JSON.stringify(lastResult.payload, null, 2)}
          </pre>
        </div>
      }
    </Card>);

};

export default PushDiagnosticsCard;