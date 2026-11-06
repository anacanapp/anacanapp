// Split out of AdminPushNotifications.tsx (admin redesign). Logic unchanged; shared imports kept verbatim.
import { useState } from 'react';
import { tr } from '@/lib/tr';
import { Plus, Trash2, Edit, Send, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useScheduledNotifications, useCreateScheduledNotification, useUpdateScheduledNotification, useDeleteScheduledNotification, useTriggerDailyNotifications, ScheduledNotification } from '@/hooks/useScheduledNotifications';
import { toast } from 'sonner';
import { describeNotificationTest, type NotificationTestRow } from '@/lib/notification-tests';
import { audienceLabels, LoadingSpinner, EmptyState, NotificationDialog, DeleteConfirmDialog } from './shared';

// ==================== SCHEDULED NOTIFICATIONS TAB ====================
const ScheduledNotificationsTab = () => {
  const { data: notifications = [], isLoading } = useScheduledNotifications();
  const createNotification = useCreateScheduledNotification();
  const updateNotification = useUpdateScheduledNotification();
  const deleteNotification = useDeleteScheduledNotification();
  const triggerDaily = useTriggerDailyNotifications();

  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
  const [editingNotification, setEditingNotification] = useState<ScheduledNotification | null>(null);
  const [form, setForm] = useState({
    title: '',
    body: '',
    target_audience: 'all',
    notification_type: 'daily_tip',
    priority: 1,
    is_active: true
  });

  const handleCreate = () => {
    setEditingNotification(null);
    setForm({
      title: '',
      body: '',
      target_audience: 'all',
      notification_type: 'daily_tip',
      priority: 1,
      is_active: true
    });
    setEditDialog(true);
  };

  const handleEdit = (notification: ScheduledNotification) => {
    setEditingNotification(notification);
    setForm({
      title: notification.title,
      body: notification.body,
      target_audience: notification.target_audience,
      notification_type: notification.notification_type || 'daily_tip',
      priority: notification.priority || 1,
      is_active: notification.is_active ?? true
    });
    setEditDialog(true);
  };

  const handleSave = async () => {
    try {
      if (editingNotification) {
        await updateNotification.mutateAsync({ id: editingNotification.id, ...form });
        toast.success(tr("adminpushnotifications_bildiris_yenilendi_55b675", "Bildiri\u015F yenil\u0259ndi"));
      } else {
        await createNotification.mutateAsync(form);
        toast.success(tr("adminpushnotifications_bildiris_yaradildi_4e4468", "Bildiri\u015F yarad\u0131ld\u0131"));
      }
      setEditDialog(false);
    } catch (error) {
      toast.error(tr("adminpushnotifications_xeta_bas_verdi_f22fba", "X\u0259ta ba\u015F verdi"));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification.mutateAsync(id);
      toast.success(tr("adminpushnotifications_bildiris_silindi_c5c6ea", "Bildiri\u015F silindi"));
      setDeleteDialog(null);
    } catch (error) {
      toast.error(tr("adminpushnotifications_xeta_bas_verdi_f22fba", "X\u0259ta ba\u015F verdi"));
    }
  };

  const handleToggleActive = async (notification: ScheduledNotification) => {
    try {
      await updateNotification.mutateAsync({
        id: notification.id,
        is_active: !notification.is_active
      });
      toast.success(notification.is_active ? tr("adminpushnotifications_bildiris_deaktiv_edildi_37d979", "Bildiri\u015F deaktiv edildi") : tr("adminpushnotifications_bildiris_aktivlesdirildi_057dab", "Bildiri\u015F aktivl\u0259\u015Fdirildi"));
    } catch (error) {
      toast.error(tr("adminpushnotifications_xeta_bas_verdi_f22fba", "X\u0259ta ba\u015F verdi"));
    }
  };

  const handleTriggerNow = async () => {
    try {
      toast.info(describeNotificationTest({ status: 'pending' } as NotificationTestRow).text);
      const row = await triggerDaily.mutateAsync();
      const outcome = describeNotificationTest(row);
      (outcome.tone === 'success' ? toast.success : outcome.tone === 'error' ? toast.error : outcome.tone === 'info' ? toast.info : toast.warning)(outcome.text);
    } catch (error) {
      toast.error(tr("adminpushnotifications_bildiris_gonderme_xetasi_d50d38", "Bildiri\u015F g\xF6nd\u0259rm\u0259 x\u0259tas\u0131"));
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Card className="p-4 bg-blue-500/10 border-blue-500/20 flex-1 me-4">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-600 dark:text-blue-400">{tr("adminpushnotifications_avtomatik_gonderme_306caf", "Avtomatik Göndərmə")}</h4>
              <p className="text-sm text-muted-foreground">{tr("adminpushnotifications_09_00_00_00_arasi_2_3_saat_fasile_ile_098729", "09:00-00:00 arası, 2-3 saat fasilə ilə")}</p>
            </div>
          </div>
        </Card>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTriggerNow} disabled={triggerDaily.isPending}>
            <Send className="h-4 w-4 me-2" />
            İndi Test Et
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 me-2" />
            Yeni
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {notifications.map((notification) => {
          const audience = audienceLabels[notification.target_audience] || audienceLabels.all;
          const Icon = audience.icon;

          return (
            <Card key={notification.id} className={`p-4 ${!notification.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`p-2 rounded-lg ${audience.color}/10`}>
                    <Icon className={`h-5 w-5 ${audience.color.replace('bg-', 'text-')}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{notification.title}</h3>
                      <Badge variant="outline" className="text-xs">{audience.label}</Badge>
                      <Badge className={notification.is_active ? 'bg-green-500/10 text-green-600' : ''} variant={notification.is_active ? 'default' : 'secondary'}>
                        {notification.is_active ? 'Aktiv' : 'Deaktiv'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{notification.body}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={notification.is_active ?? true} onCheckedChange={() => handleToggleActive(notification)} />
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(notification)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setDeleteDialog(notification.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>);

        })}

        {notifications.length === 0 && <EmptyState onAdd={handleCreate} />}
      </div>

      <NotificationDialog
        open={editDialog}
        onOpenChange={setEditDialog}
        isEditing={!!editingNotification}
        form={form}
        setForm={setForm}
        onSave={handleSave}
        isLoading={createNotification.isPending || updateNotification.isPending} />
      

      <DeleteConfirmDialog
        open={deleteDialog !== null}
        onOpenChange={() => setDeleteDialog(null)}
        onConfirm={() => deleteDialog && handleDelete(deleteDialog)} />
      
    </div>);

};


export default ScheduledNotificationsTab;
