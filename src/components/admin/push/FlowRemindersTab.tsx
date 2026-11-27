// Split out of AdminPushNotifications.tsx (admin redesign). Logic unchanged; shared imports kept verbatim.
import { useState, useEffect } from 'react';
import { tr } from '@/lib/tr';
import { Send, Moon, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { runNotificationTest, describeNotificationTest, type NotificationTestRow } from '@/lib/notification-tests';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from './shared';

const FlowRemindersTab = () => {
  const [isTriggering, setIsTriggering] = useState(false);
  const [reminderStats, setReminderStats] = useState<{
    total: number;
    byType: Record<string, number>;
    enabledCount: number;
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const reminderTypeLabels: Record<string, {label: string;emoji: string;color: string;}> = {
    period_start: { label: tr("adminpushnotifications_period_baslangici_9350e0", "Period Başlanğıcı"), emoji: '🔴', color: 'bg-rose-500' },
    period_end: { label: 'Period Sonu', emoji: '✅', color: 'bg-green-500' },
    ovulation: { label: 'Ovulyasiya', emoji: '🌸', color: 'bg-amber-500' },
    fertile_start: { label: tr("adminpushnotifications_mehsuldar_baslangic_3b55fd", "Məhsuldar Başlanğıc"), emoji: '💕', color: 'bg-pink-500' },
    fertile_end: { label: tr("adminpushnotifications_mehsuldar_son_863628", "Məhsuldar Son"), emoji: '📅', color: 'bg-purple-500' },
    pms: { label: tr("adminpushnotifications_pms_dovru_16f417", "PMS Dövrü"), emoji: '⚡', color: 'bg-orange-500' },
    pill: { label: tr("adminpushnotifications_heb_xatirlatmasi_e3e934", "Həb Xatırlatması"), emoji: '💊', color: 'bg-blue-500' },
    custom: { label: tr("adminpushnotifications_xususi_1055b8", "Xüsusi"), emoji: '🔔', color: 'bg-gray-500' }
  };

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const { data, error } = await supabase.
      from('flow_reminders').
      select('id, reminder_type, is_enabled');

      if (error) throw error;

      const byType: Record<string, number> = {};
      let enabledCount = 0;

      data?.forEach((r: any) => {
        byType[r.reminder_type] = (byType[r.reminder_type] || 0) + 1;
        if (r.is_enabled) enabledCount++;
      });

      setReminderStats({
        total: data?.length || 0,
        byType,
        enabledCount
      });
    } catch (error) {
      console.error('Error loading flow reminder stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleTriggerNow = async () => {
    setIsTriggering(true);
    try {
      // Google: a self-test for the admin (the scheduled job sends to users on its own).
      toast.info(describeNotificationTest({ status: 'pending' } as NotificationTestRow).text);
      const row = await runNotificationTest('flow');
      const outcome = describeNotificationTest(row);
      (outcome.tone === 'success' ? toast.success : outcome.tone === 'error' ? toast.error : outcome.tone === 'info' ? toast.info : toast.warning)(outcome.text);
      loadStats();
    } catch (error) {
      console.error('Error triggering flow reminders:', error);
      toast.error(tr("adminpushnotifications_xeta_bas_verdi_f22fba", "X\u0259ta ba\u015F verdi"));
    } finally {
      setIsTriggering(false);
    }
  };

  if (loadingStats) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <Card className="p-4 bg-pink-500/10 border-pink-500/20">
        <div className="flex items-start gap-3">
          <Moon className="h-5 w-5 text-pink-500 mt-0.5" />
          <div>
            <h4 className="font-medium text-pink-600 dark:text-pink-400">{tr("adminpushnotifications_flow_xatirlatmalari_bc121b", "Flow Xatırlatmaları")}</h4>
            <p className="text-sm text-muted-foreground">
              {tr("adminpushnotifications_i_stifadecilerin_yaratdigi_per_23f1ee", "\u0130stifad\u0259\xE7il\u0259rin yaratd\u0131\u011F\u0131 period, ovulyasiya v\u0259 fertil g\xFCn xat\u0131rlatmalar\u0131. \n              Avtomatik olaraq h\u0259r saat yoxlan\u0131l\u0131r v\u0259 g\xF6nd\u0259rilir.")}
            
            </p>
          </div>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-primary">{reminderStats?.total || 0}</div>
          <div className="text-sm text-muted-foreground">{tr("adminpushnotifications_toplam_xatirlatma_9e142e", "Toplam Xatırlatma")}</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-green-500">{reminderStats?.enabledCount || 0}</div>
          <div className="text-sm text-muted-foreground">Aktiv</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-muted-foreground">
            {Object.keys(reminderStats?.byType || {}).length}
          </div>
          <div className="text-sm text-muted-foreground">{tr("adminpushnotifications_ferqli_nov_e00aaa", "Fərqli Növ")}</div>
        </Card>
      </div>

      {/* Reminder Types Breakdown */}
      <Card className="p-4">
        <h3 className="font-bold mb-4">{tr("adminpushnotifications_xatirlatma_novlerine_gore_83d441", "Xatırlatma Növlərinə Görə")}</h3>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(reminderTypeLabels).map(([type, info]) => {
            const count = reminderStats?.byType[type] || 0;
            return (
              <div
                key={type}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                
                <div className="flex items-center gap-2">
                  <span className="text-xl">{info.emoji}</span>
                  <span className="text-sm font-medium">{info.label}</span>
                </div>
                <Badge variant={count > 0 ? 'default' : 'secondary'}>
                  {count}
                </Badge>
              </div>);

          })}
        </div>
      </Card>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={loadStats}>
          <RefreshCw className="h-4 w-4 me-2" />
          {tr("adminpushnotifications_yenile_570ce2", "Yenil\u0259")}
        </Button>
        <Button onClick={handleTriggerNow} disabled={isTriggering}>
          {isTriggering ?
          <Loader2 className="h-4 w-4 me-2 animate-spin" /> :

          <Send className="h-4 w-4 me-2" />
          }
          İndi Test Et
        </Button>
      </div>

      {/* Recent Logs */}
      <Card className="p-4">
        <h3 className="font-bold mb-4">{tr("adminpushnotifications_son_gonderilen_flow_xatirlatmalari_5d3406", "Son Göndərilən Flow Xatırlatmaları")}</h3>
        <RecentFlowLogs />
      </Card>
    </div>);

};

// Recent flow reminder logs component
const RecentFlowLogs = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const { data, error } = await supabase.
        from('notification_send_log').
        select('*').
        or('source_type.eq.flow_reminder,notification_type.eq.flow_reminder').
        order('sent_at', { ascending: false }).
        limit(20);

        if (!error) {
          setLogs(data || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadLogs();
  }, []);

  if (loading) {
    return <div className="text-center py-4 text-muted-foreground">{tr("adminpushnotifications_yuklenir_5557de", "Yüklənir...")}</div>;
  }

  if (logs.length === 0) {
    return <div className="text-center py-4 text-muted-foreground">{tr("adminpushnotifications_hele_hec_bir_loq_yoxdur_f39f35", "Hələ heç bir loq yoxdur")}</div>;
  }

  return (
    <div className="space-y-2 max-h-[300px] overflow-y-auto">
      {logs.map((log) =>
      <div key={log.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg text-sm">
          <div>
            <p className="font-medium">{log.title}</p>
            <p className="text-xs text-muted-foreground">{log.body}</p>
          </div>
          <Badge variant={log.status === 'sent' ? 'default' : 'destructive'}>
            {log.status}
          </Badge>
        </div>
      )}
    </div>);

};


export default FlowRemindersTab;
