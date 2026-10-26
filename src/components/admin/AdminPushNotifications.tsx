import { useState, useEffect, useRef } from 'react';
import { tr } from '@/lib/tr';
import { Bell, Plus, Trash2, Edit, Send, Users, Baby, Heart, Moon, Clock, Calendar, Zap, Search, ChevronLeft, ChevronRight, Loader2, Filter, RefreshCw, Upload, Download, FileText, FileDown } from 'lucide-react';
import { exportToCSV } from '@/utils/csvExport';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useScheduledNotifications,
  useCreateScheduledNotification,
  useUpdateScheduledNotification,
  useDeleteScheduledNotification,
  useTriggerDailyNotifications,
  ScheduledNotification } from
'@/hooks/useScheduledNotifications';
import {
  usePregnancyDayNotifications,
  useCreatePregnancyDayNotification,
  useUpdatePregnancyDayNotification,
  useDeletePregnancyDayNotification,
  useBulkPushNotifications,
  useCreateBulkPushNotification,
  useSendBulkPushNotification,
  useAudienceStats } from
'@/hooks/useAdvancedNotifications';
import {
  useMommyDayNotifications,
  useCreateMommyDayNotification,
  useUpdateMommyDayNotification,
  useDeleteMommyDayNotification } from
'@/hooks/useMommyDayNotifications';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import PushDiagnosticsCard from './PushDiagnosticsCard';
import NotificationOpsCard from './NotificationOpsCard';
import BulkTimeManager from './BulkTimeManager';
import AdminNotificationCampaigns from './AdminNotificationCampaigns';

const audienceLabels: Record<string, {label: string;icon: any;color: string;}> = {
  all: { label: tr("adminpushnotifications_hami_c33b89", "Hamı"), icon: Users, color: 'bg-blue-500' },
  flow: { label: 'Menstruasiya', icon: Moon, color: 'bg-pink-500' },
  bump: { label: tr("adminpushnotifications_hamile_0080af", "Hamilə"), icon: Baby, color: 'bg-orange-500' },
  mommy: { label: 'Ana', icon: Heart, color: 'bg-red-500' },
  partner: { label: 'Partnyor', icon: Users, color: 'bg-purple-500' }
};

const AdminPushNotifications = () => {
  const [activeTab, setActiveTab] = useState('bulk');
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{tr("adminpushnotifications_push_bildirisleri_c44832", "Push Bildirişləri")}</h2>
        <p className="text-muted-foreground">
          {tr("adminpushnotifications_butun_push_notification_sistem_ab314e", "B\xFCt\xFCn push notification sistemini buradan idar\u0259 edin")}
        </p>
      </div>


      <details className="rounded-xl border p-4" onToggle={event => setDiagnosticsOpen(event.currentTarget.open)}><summary className="cursor-pointer text-sm font-semibold">Bildiriş servisi və cihaz diaqnostikası</summary>{diagnosticsOpen && <div className="mt-4 space-y-4"><NotificationOpsCard /><PushDiagnosticsCard /></div>}</details>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full h-auto justify-start overflow-x-auto gap-1 p-1">
          <TabsTrigger value="scheduled" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {tr("adminpushnotifications_gundelik_a7880f", "G\xFCnd\u0259lik")}
          </TabsTrigger>
          <TabsTrigger value="pregnancy" className="flex items-center gap-2">
            <Baby className="h-4 w-4" />
            {tr("adminpushnotifications_hamilelik_e86feb", "Hamil\u0259lik")}
          </TabsTrigger>
          <TabsTrigger value="mommy" className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            Ana
          </TabsTrigger>
          <TabsTrigger value="flow" className="flex items-center gap-2">
            <Moon className="h-4 w-4" />
            Flow
          </TabsTrigger>
          <TabsTrigger value="bulk" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Kampaniyalar
          </TabsTrigger>
          <TabsTrigger value="time-manager" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {tr("adminpushnotifications_saat_deyis_a9b025", "Saat d\u0259yi\u015F.")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scheduled" className="mt-6">
          <ScheduledNotificationsTab />
        </TabsContent>

        <TabsContent value="pregnancy" className="mt-6">
          <PregnancyDayNotificationsTab />
        </TabsContent>

        <TabsContent value="mommy" className="mt-6">
          <MommyDayNotificationsTab />
        </TabsContent>

        <TabsContent value="flow" className="mt-6">
          <FlowRemindersTab />
        </TabsContent>

        <TabsContent value="bulk" className="mt-6">
          <AdminNotificationCampaigns />
        </TabsContent>

        <TabsContent value="time-manager" className="mt-6">
          <BulkTimeManager />
        </TabsContent>
      </Tabs>
    </div>);

};

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
      await triggerDaily.mutateAsync();
      toast.success(tr("adminpushnotifications_bildirisler_gonderildi_ab3631", "Bildiri\u015Fl\u0259r g\xF6nd\u0259rildi!"));
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

// ==================== PREGNANCY DAY NOTIFICATIONS TAB ====================
const PregnancyDayNotificationsTab = () => {
  const { data: notifications = [], isLoading } = usePregnancyDayNotifications();
  const createNotification = useCreatePregnancyDayNotification();
  const updateNotification = useUpdatePregnancyDayNotification();
  const deleteNotification = useDeletePregnancyDayNotification();

  const [searchDay, setSearchDay] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [editDialog, setEditDialog] = useState(false);
  const [dayListDialog, setDayListDialog] = useState(false);
  const [selectedDayNotifs, setSelectedDayNotifs] = useState<typeof notifications>([]);
  const [selectedDay, setSelectedDay] = useState(0);
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    day_number: 0,
    title: '',
    body: '',
    emoji: '👶',
    send_time: '09:00',
    is_active: true
  });

  const DAYS_PER_PAGE = 28; // 4 weeks per page
  const TOTAL_DAYS = 294; // 42 weeks
  const totalPages = Math.ceil(TOTAL_DAYS / DAYS_PER_PAGE);

  // CSV import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  // Create a map of existing notifications (grouped by day)
  const notificationsByDay = new Map<number, typeof notifications>();
  notifications.forEach((n) => {
    const existing = notificationsByDay.get(n.day_number) || [];
    existing.push(n);
    notificationsByDay.set(n.day_number, existing);
  });

  // Generate days for current page
  const startDay = currentPage * DAYS_PER_PAGE;
  const endDay = Math.min(startDay + DAYS_PER_PAGE, TOTAL_DAYS);
  const daysInPage = Array.from({ length: endDay - startDay }, (_, i) => startDay + i);

  // Search filter
  const filteredDays = searchDay ?
  [parseInt(searchDay)].filter((d) => d >= 0 && d < TOTAL_DAYS) :
  daysInPage;

  const handleCreate = (dayNumber: number) => {
    setEditingId(null);
    setForm({
      day_number: dayNumber,
      title: `Hamiləliyin ${dayNumber}-ci günü 🌟`,
      body: '',
      emoji: '👶',
      send_time: '09:00',
      is_active: true
    });
    setEditDialog(true);
  };

  const handleEdit = (notification: any) => {
    setEditingId(notification.id);
    setForm({
      day_number: notification.day_number,
      title: notification.title,
      body: notification.body,
      emoji: notification.emoji || '👶',
      send_time: notification.send_time || '09:00',
      is_active: notification.is_active ?? true
    });
    setEditDialog(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.body) {
      toast.error(tr("adminpushnotifications_basliq_ve_metn_teleb_olunur_defdc8", "Ba\u015Fl\u0131q v\u0259 m\u0259tn t\u0259l\u0259b olunur"));
      return;
    }
    try {
      if (editingId) {
        await updateNotification.mutateAsync({ id: editingId, ...form });
        toast.success(tr("adminpushnotifications_bildiris_yenilendi_55b675", "Bildiri\u015F yenil\u0259ndi"));
      } else {
        await createNotification.mutateAsync(form);
        toast.success(tr("adminpushnotifications_bildiris_yaradildi_4e4468", "Bildiri\u015F yarad\u0131ld\u0131"));
      }
      setEditDialog(false);
    } catch (error: any) {
      toast.error(error.message || tr("adminpushnotifications_xeta_bas_verdi_f22fba", "X\u0259ta ba\u015F verdi"));
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

  const handleDownloadTemplate = () => {
    const csvContent = tr("adminpushnotifications_day_number_send_time_title_bod_6e46a7", "day_number,send_time,title,body,emoji,is_active\n0,09:00,\"Hamil\u0259liyin 0-c\u0131 g\xFCn\xFC \uD83C\uDF1F\",\"Bu g\xFCn yeni bir s\u0259yah\u0259t ba\u015Flay\u0131r!\",\uD83D\uDC76,true\n0,14:00,\"G\xFCnorta xat\u0131rlatmas\u0131 \uD83C\uDF38\",\"Bol su i\xE7m\u0259yi unutma!\",\uD83D\uDCA7,true\n1,09:00,\"Hamil\u0259liyin 1-ci g\xFCn\xFC \uD83C\uDF1F\",\"K\xF6rp\u0259niz inki\u015Faf edir...\",\uD83C\uDF31,true\n7,09:00,\"Hamil\u0259liyin 7-ci g\xFCn\xFC \uD83C\uDF1F\",\"Bir h\u0259ft\u0259lik hamil\u0259siniz!\",\u2728,true\n7,20:00,\"Ax\u015Fam xat\u0131rlatmas\u0131 \uD83C\uDF19\",\"Yax\u015F\u0131 yuxu keyfiyy\u0259ti vacibdir\",\uD83D\uDE34,true");
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'pregnancy_notifications_numune.csv';
    link.click();
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter((l) => l.trim());

      if (lines.length < 2) {
        toast.error(tr("adminpushnotifications_csv_fayli_bosdur_0a908c", "CSV fayl\u0131 bo\u015Fdur"));
        return;
      }

      // Parse header
      const header = lines[0].toLowerCase().replace(/[\ufeff]/g, '');
      const cols = header.split(',').map((c) => c.trim().replace(/"/g, ''));

      const dayIdx = cols.indexOf('day_number');
      const titleIdx = cols.indexOf('title');
      const bodyIdx = cols.indexOf('body');
      const emojiIdx = cols.indexOf('emoji');
      const activeIdx = cols.indexOf('is_active');
      const timeIdx = cols.indexOf('send_time');

      if (dayIdx === -1 || titleIdx === -1 || bodyIdx === -1) {
        toast.error(tr("adminpushnotifications_csv_de_day_number_title_body_s_35494f", "CSV-d\u0259 day_number, title, body s\xFCtunlar\u0131 t\u0259l\u0259b olunur"));
        return;
      }

      // Parse rows - handle quoted fields
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            inQuotes = !inQuotes;
          } else if (ch === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += ch;
          }
        }
        result.push(current.trim());
        return result;
      };

      const rows: any[] = [];
      let skipped = 0;

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const dayNum = parseInt(values[dayIdx]);
        const title = values[titleIdx]?.replace(/^"|"$/g, '');
        const body = values[bodyIdx]?.replace(/^"|"$/g, '');

        if (isNaN(dayNum) || dayNum < 0 || dayNum >= 294 || !title || !body) {
          skipped++;
          continue;
        }

        rows.push({
          day_number: dayNum,
          title,
          body,
          emoji: emojiIdx !== -1 ? values[emojiIdx]?.replace(/^"|"$/g, '') || '👶' : '👶',
          send_time: timeIdx !== -1 ? values[timeIdx]?.replace(/^"|"$/g, '') || '09:00' : '09:00',
          is_active: activeIdx !== -1 ? values[activeIdx]?.toLowerCase().trim() !== 'false' : true
        });
      }

      if (rows.length === 0) {
        toast.error(tr("adminpushnotifications_hec_bir_etibarli_setir_tapilma_bbe474", "He\xE7 bir etibarl\u0131 s\u0259tir tap\u0131lmad\u0131"));
        return;
      }

      // Upsert: update existing, insert new
      let inserted = 0;
      let updated = 0;
      let errors = 0;

      for (const row of rows) {
        try {
          await createNotification.mutateAsync(row);
          inserted++;
        } catch {
          errors++;
        }
      }

      toast.success(`CSV import tamamlandı: ${inserted} yeni${errors > 0 ? `, ${errors} xəta` : ''}${skipped > 0 ? `, ${skipped} keçildi` : ''}`);
    } catch (error) {
      toast.error(tr("adminpushnotifications_csv_oxuma_xetasi_d46057", "CSV oxuma x\u0259tas\u0131"));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getWeekNumber = (day: number) => Math.floor(day / 7) + 1;
  const getTrimester = (day: number) => {
    if (day < 84) return { num: 1, color: 'bg-pink-500' };
    if (day < 182) return { num: 2, color: 'bg-orange-500' };
    return { num: 3, color: 'bg-purple-500' };
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-primary">{notificationsByDay.size}</div>
          <div className="text-sm text-muted-foreground">{tr("adminpushnotifications_elave_edilib_6b8aee", "Əlavə Edilib")}</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-orange-500">{TOTAL_DAYS}</div>
          <div className="text-sm text-muted-foreground">{tr("adminpushnotifications_toplam_gun_a8eb5b", "Toplam Gün")}</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-green-500">{notifications.filter((n) => n.is_active).length}</div>
          <div className="text-sm text-muted-foreground">Aktiv</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-muted-foreground">{TOTAL_DAYS - notificationsByDay.size}</div>
          <div className="text-sm text-muted-foreground">{tr("adminpushnotifications_bos_gun_2cbd8e", "Boş Gün")}</div>
        </Card>
      </div>

      {/* CSV Import Section */}
      <Card className="p-4 border-dashed">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <h4 className="font-medium">CSV Import</h4>
              <p className="text-sm text-muted-foreground">{tr("adminpushnotifications_bildirisleri_toplu_sekilde_csv_ile_elave_b35d22", "Bildirişləri toplu şəkildə CSV ilə əlavə edin (0-293 gün)")}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 me-1" />
              {tr("adminpushnotifications_numune_csv_c52f80", "N\xFCmun\u0259 CSV")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                exportToCSV(
                  notifications,
                  [
                  { key: 'day_number', header: 'day_number' },
                  { key: 'send_time', header: 'send_time' },
                  { key: 'title', header: 'title' },
                  { key: 'body', header: 'body' },
                  { key: 'emoji', header: 'emoji' },
                  { key: 'is_active', header: 'is_active' }],

                  'pregnancy_notifications_export.csv'
                );
                toast.success(`${notifications.length} bildiriş ixrac edildi`);
              }}
              disabled={notifications.length === 0}>
              
              <FileDown className="h-4 w-4 me-1" />
              İxrac
            </Button>
            <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <Upload className="h-4 w-4 me-1" />}
              CSV Import
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCSVImport} />
            
          </div>
        </div>
      </Card>

      {/* Search & Pagination */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={tr("adminpushnotifications_gun_nomresi_axtar_0_293_97f2cb", "Gün nömrəsi axtar (0-293)...")}
            value={searchDay}
            onChange={(e) => setSearchDay(e.target.value.replace(/\D/g, ''))}
            className="max-w-[200px]"
            type="number"
            min={0}
            max={293} />
          
          {searchDay &&
          <Button variant="ghost" size="sm" onClick={() => setSearchDay('')}>
              {tr("adminpushnotifications_sifirla_60125d", "S\u0131f\u0131rla")}
            </Button>
          }
        </div>

        {!searchDay &&
        <div className="flex items-center gap-2">
            <Button
            variant="outline"
            size="icon"
            disabled={currentPage === 0}
            onClick={() => setCurrentPage((p) => p - 1)}>
            
              <ChevronLeft className="rtl:rotate-180 h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground min-w-[100px] text-center">
              {tr("adminpushnotifications_gun_18b2f4", "G\xFCn")} {startDay} - {endDay - 1}
            </span>
            <Button
            variant="outline"
            size="icon"
            disabled={currentPage >= totalPages - 1}
            onClick={() => setCurrentPage((p) => p + 1)}>
            
              <ChevronRight className="rtl:rotate-180 h-4 w-4" />
            </Button>
          </div>
        }
      </div>

      {/* Days Grid */}
      <ScrollArea className="h-[500px]">
        <div className="grid grid-cols-7 gap-2">
          {filteredDays.map((day) => {
            const dayNotifications = notificationsByDay.get(day) || [];
            const trimester = getTrimester(day);
            const week = getWeekNumber(day);
            const hasNotifications = dayNotifications.length > 0;
            const allActive = dayNotifications.every((n) => n.is_active);

            return (
              <Card
                key={day}
                className={`p-3 cursor-pointer transition-all hover:scale-105 ${
                hasNotifications ?
                allActive ?
                'bg-green-500/10 border-green-500/30' :
                'bg-yellow-500/10 border-yellow-500/30' :
                'bg-muted/30 border-dashed'}`
                }
                onClick={() => {
                  if (hasNotifications) {
                    if (dayNotifications.length > 1) {
                      setSelectedDay(day);
                      setSelectedDayNotifs(dayNotifications);
                      setDayListDialog(true);
                    } else {
                      handleEdit(dayNotifications[0]);
                    }
                  } else {
                    handleCreate(day);
                  }
                }}>
                
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Badge variant="outline" className={`text-[10px] px-1 ${trimester.color}/10 border-0`}>
                      H{week}
                    </Badge>
                  </div>
                  <div className="text-lg font-bold">{day}</div>
                  {hasNotifications ?
                  <div className="flex items-center justify-center gap-0.5">
                      <span className="text-lg">{dayNotifications[0].emoji}</span>
                      {dayNotifications.length > 1 &&
                    <Badge className="text-[9px] px-1 h-4 bg-primary/20 text-primary">+{dayNotifications.length - 1}</Badge>
                    }
                    </div> :

                  <div className="text-xl opacity-30">+</div>
                  }
                </div>
              </Card>);

          })}
        </div>
      </ScrollArea>

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-500/20 border border-green-500/30" />
          <span>{tr("adminpushnotifications_elave_edilib_6b8aee", "Əlavə Edilib")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-500/20 border border-yellow-500/30" />
          <span>Deaktiv</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-muted/30 border border-dashed" />
          <span>{tr("adminpushnotifications_bos_485510", "Boş")}</span>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Baby className="h-5 w-5 text-orange-500" />
              {tr("adminpushnotifications_gun_18b2f4", "G\xFCn")} {form.day_number} {tr("adminpushnotifications_hefte_5cfb08", "- H\u0259ft\u0259")} {getWeekNumber(form.day_number)}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{tr("adminpushnotifications_gun_nomresi_760508", "Gün Nömrəsi")}</Label>
                <Input
                  type="number"
                  min={0}
                  max={293}
                  value={form.day_number}
                  onChange={(e) => setForm({ ...form, day_number: parseInt(e.target.value) || 0 })}
                  disabled={!!editingId} />
                
              </div>
              <div className="space-y-2">
                <Label>{tr("adminpushnotifications_gonderme_saati_110747", "Göndərmə Saatı")}</Label>
                <Input
                  type="time"
                  value={form.send_time}
                  onChange={(e) => setForm({ ...form, send_time: e.target.value })}
                  placeholder="09:00" />
                
              </div>
              <div className="space-y-2">
                <Label>Emoji</Label>
                <Input
                  value={form.emoji}
                  onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                  placeholder="👶" />
                
              </div>
            </div>

            <div className="space-y-2">
              <Label>{tr("adminpushnotifications_basliq_e1f6c5", "Başlıq")}</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={tr("adminpushnotifications_hamileliyin_14_cu_gunu_f5a6b8", "Hamiləliyin 14-cü günü 🌟")} />
              
            </div>

            <div className="space-y-2">
              <Label>{tr("adminpushnotifications_metn_6e9f0f", "Mətn")}</Label>
              <Textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder={tr("adminpushnotifications_bu_gun_korpeniz_inkisaf_edir_6c0ca6", "Bu gün körpəniz inkişaf edir...")}
                rows={4} />
              
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <Label>Aktiv</Label>
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} />
              
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            {editingId &&
            <Button
              variant="destructive"
              onClick={() => {
                setEditDialog(false);
                setDeleteDialog(editingId);
              }}>
              
                <Trash2 className="h-4 w-4 me-2" />
                Sil
              </Button>
            }
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditDialog(false)}>{tr("adminpushnotifications_legv_et_b5e49c", "Ləğv et")}</Button>
              <Button onClick={handleSave} disabled={createNotification.isPending || updateNotification.isPending}>
                {editingId ? tr("adminpushnotifications_yenile_570ce2", "Yenil\u0259") : 'Yarat'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Day List Dialog - shows all notifications for a day */}
      <Dialog open={dayListDialog} onOpenChange={setDayListDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Baby className="h-5 w-5 text-orange-500" />
              {tr("adminpushnotifications_gun_18b2f4", "G\xFCn")} {selectedDay} {tr("adminpushnotifications_hefte_5cfb08", "- H\u0259ft\u0259")} {getWeekNumber(selectedDay)} ({selectedDayNotifs.length} {tr("adminpushnotifications_bildiris_472ec1", "bildiri\u015F)")}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3">
              {selectedDayNotifs.map((notif) =>
              <Card key={notif.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">{notif.send_time}</Badge>
                        {notif.is_active ?
                      <Badge className="text-xs bg-green-500/20 text-green-700 border-0">Aktiv</Badge> :

                      <Badge className="text-xs bg-yellow-500/20 text-yellow-700 border-0">Deaktiv</Badge>
                      }
                      </div>
                      <p className="font-medium text-sm truncate">{notif.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{notif.body}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => {
                      setDayListDialog(false);
                      handleEdit(notif);
                    }}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="destructive" className="h-8 w-8 p-0" onClick={() => {
                      setDayListDialog(false);
                      setDeleteDialog(notif.id);
                    }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDayListDialog(false)}>{tr("adminpushnotifications_bagla_84bdc9", "Bağla")}</Button>
            <Button onClick={() => {setDayListDialog(false);handleCreate(selectedDay);}}>
              <Plus className="h-4 w-4 me-1" /> {tr("adminpushnotifications_yeni_bildiris_40105e", "Yeni Bildiri\u015F")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleteDialog !== null}
        onOpenChange={() => setDeleteDialog(null)}
        onConfirm={() => deleteDialog && handleDelete(deleteDialog)} />
      
    </div>);

};

// ==================== FLOW REMINDERS TAB ====================
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
      const { data, error } = await supabase.functions.invoke('send-flow-reminders', {
        body: { manual: true }
      });

      if (error) throw error;

      toast.success(`${data.sent || 0} flow xatırlatması göndərildi!`);
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

// ==================== BULK PUSH TAB ====================
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

// ==================== SHARED COMPONENTS ====================
const LoadingSpinner = () =>
<div className="flex items-center justify-center h-64">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>;


const EmptyState = ({ onAdd }: {onAdd: () => void;}) =>
<Card className="p-8 text-center">
    <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
    <h3 className="font-medium mb-2">{tr("adminpushnotifications_bildiris_yoxdur_806a42", "Bildiriş Yoxdur")}</h3>
    <p className="text-sm text-muted-foreground mb-4">{tr("adminpushnotifications_gundelik_avtomatik_bildirisler_elave_edi_c1a864", "Gündəlik avtomatik bildirişlər əlavə edin")}</p>
    <Button onClick={onAdd}>
      <Plus className="h-4 w-4 me-2" />
      {tr("adminpushnotifications_i_lk_bildirisi_yarat_b9f9ca", "\u0130lk Bildiri\u015Fi Yarat")}
    </Button>
  </Card>;


const NotificationDialog = ({
  open,
  onOpenChange,
  isEditing,
  form,
  setForm,
  onSave,
  isLoading








}: {open: boolean;onOpenChange: (open: boolean) => void;isEditing: boolean;form: any;setForm: (form: any) => void;onSave: () => void;isLoading: boolean;}) =>
<Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{isEditing ? tr("adminpushnotifications_bildirisi_redakte_et_587e1d", "Bildiri\u015Fi Redakt\u0259 Et") : tr("adminpushnotifications_yeni_bildiris_40105e", "Yeni Bildiri\u015F")}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{tr("adminpushnotifications_basliq_e1f6c5", "Başlıq")}</Label>
          <Input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder={tr("adminpushnotifications_gunun_xatirlatmasi_ec465f", "Günün Xatırlatması 💧")} />
        
        </div>

        <div className="space-y-2">
          <Label>{tr("adminpushnotifications_metn_6e9f0f", "Mətn")}</Label>
          <Textarea
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          placeholder={tr("adminpushnotifications_su_icmeyi_unutma_6feca5", "Su içməyi unutma!")}
          rows={3} />
        
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{tr("adminpushnotifications_hedef_auditoriya_50154d", "Hədəf Auditoriya")}</Label>
            <Select value={form.target_audience} onValueChange={(v) => setForm({ ...form, target_audience: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tr("adminpushnotifications_hami_c33b89", "Hamı")}</SelectItem>
                <SelectItem value="flow">Menstruasiya</SelectItem>
                <SelectItem value="bump">{tr("adminpushnotifications_hamile_0080af", "Hamilə")}</SelectItem>
                <SelectItem value="mommy">Ana</SelectItem>
                <SelectItem value="partner">Partnyor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Prioritet (1-10)</Label>
            <Input
            type="number"
            min={1}
            max={10}
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 1 })} />
          
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <Label>Aktiv</Label>
          <Switch
          checked={form.is_active}
          onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} />
        
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>{tr("adminpushnotifications_legv_et_b5e49c", "Ləğv et")}</Button>
        <Button onClick={onSave} disabled={isLoading}>
          {isEditing ? tr("adminpushnotifications_yenile_570ce2", "Yenil\u0259") : 'Yarat'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;


const DeleteConfirmDialog = ({
  open,
  onOpenChange,
  onConfirm




}: {open: boolean;onOpenChange: (open: boolean) => void;onConfirm: () => void;}) =>
<AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{tr("adminpushnotifications_bildirisi_silmek_d3457f", "Bildirişi Silmək?")}</AlertDialogTitle>
        <AlertDialogDescription>{tr("adminpushnotifications_bu_emeliyyat_geri_qaytarila_bilmez_b4fea8", "Bu əməliyyat geri qaytarıla bilməz.")}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{tr("adminpushnotifications_legv_et_b5e49c", "Ləğv et")}</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm} className="bg-red-500 hover:bg-red-600">Sil</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;


// ==================== MOMMY DAY NOTIFICATIONS TAB ====================
const MommyDayNotificationsTab = () => {
  const { data: notifications = [], isLoading } = useMommyDayNotifications();
  const createNotification = useCreateMommyDayNotification();
  const updateNotification = useUpdateMommyDayNotification();
  const deleteNotification = useDeleteMommyDayNotification();

  const [searchDay, setSearchDay] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [editDialog, setEditDialog] = useState(false);
  const [dayListDialog, setDayListDialog] = useState(false);
  const [selectedDayNotifs, setSelectedDayNotifs] = useState<typeof notifications>([]);
  const [selectedDay, setSelectedDay] = useState(1);
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    day_number: 1,
    title: '',
    body: '',
    emoji: '👶',
    send_time: '09:00',
    is_active: true
  });

  const DAYS_PER_PAGE = 28;
  const TOTAL_DAYS = 1460;
  const totalPages = Math.ceil(TOTAL_DAYS / DAYS_PER_PAGE);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const notificationsByDay = new Map<number, typeof notifications>();
  notifications.forEach((n) => {
    const existing = notificationsByDay.get(n.day_number) || [];
    existing.push(n);
    notificationsByDay.set(n.day_number, existing);
  });

  const startDay = currentPage * DAYS_PER_PAGE + 1;
  const endDay = Math.min(startDay + DAYS_PER_PAGE - 1, TOTAL_DAYS);
  const daysInPage = Array.from({ length: endDay - startDay + 1 }, (_, i) => startDay + i);

  const filteredDays = searchDay ?
  [parseInt(searchDay)].filter((d) => d >= 1 && d <= TOTAL_DAYS) :
  daysInPage;

  const getMonthNumber = (day: number) => Math.ceil(day / 30);

  const handleCreate = (dayNumber: number) => {
    setEditingId(null);
    setForm({
      day_number: dayNumber,
      title: `Körpənizin ${dayNumber}-ci günü 🌟`,
      body: '',
      emoji: '👶',
      send_time: '09:00',
      is_active: true
    });
    setEditDialog(true);
  };

  const handleEdit = (notification: any) => {
    setEditingId(notification.id);
    setForm({
      day_number: notification.day_number,
      title: notification.title,
      body: notification.body,
      emoji: notification.emoji || '👶',
      send_time: notification.send_time || '09:00',
      is_active: notification.is_active ?? true
    });
    setEditDialog(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.body) {
      toast.error(tr("adminpushnotifications_basliq_ve_metn_teleb_olunur_defdc8", "Ba\u015Fl\u0131q v\u0259 m\u0259tn t\u0259l\u0259b olunur"));
      return;
    }
    try {
      if (editingId) {
        await updateNotification.mutateAsync({ id: editingId, ...form });
        toast.success(tr("adminpushnotifications_bildiris_yenilendi_55b675", "Bildiri\u015F yenil\u0259ndi"));
      } else {
        await createNotification.mutateAsync(form);
        toast.success(tr("adminpushnotifications_bildiris_yaradildi_4e4468", "Bildiri\u015F yarad\u0131ld\u0131"));
      }
      setEditDialog(false);
    } catch (error: any) {
      toast.error(error.message || tr("adminpushnotifications_xeta_bas_verdi_f22fba", "X\u0259ta ba\u015F verdi"));
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

  const handleDownloadTemplate = () => {
    const csvContent = tr("adminpushnotifications_day_number_send_time_title_bod_f1de06", "day_number,send_time,title,body,emoji,is_active\n1,09:00,\"K\xF6rp\u0259nizin 1-ci g\xFCn\xFC \uD83C\uDF1F\",\"Yeni do\u011Fulmu\u015F k\xF6rp\u0259niz haqq\u0131nda m\u0259lumat\",\uD83D\uDC76,true\n1,14:00,\"G\xFCnorta xat\u0131rlatmas\u0131 \uD83C\uDF38\",\"K\xF6rp\u0259nizi \u0259mizdirm\u0259yi unutmay\u0131n!\",\uD83C\uDF7C,true\n30,09:00,\"K\xF6rp\u0259niz 1 ayl\u0131qd\u0131r \uD83C\uDF89\",\"\u0130lk ay tamamland\u0131!\",\uD83C\uDF82,true\n365,09:00,\"K\xF6rp\u0259niz 1 ya\u015F\u0131ndad\u0131r! \uD83C\uDF82\",\"\u0130lk do\u011Fum g\xFCn\xFC m\xFCbar\u0259k!\",\uD83C\uDF81,true");
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'ana_notifications_numune.csv';
    link.click();
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();

      // Handle multi-line CSV with quoted fields
      const parseCSVWithMultiline = (csvText: string): string[][] => {
        const rows: string[][] = [];
        let current = '';
        let inQuotes = false;
        const chars = csvText.split('');

        for (let i = 0; i < chars.length; i++) {
          const ch = chars[i];
          if (ch === '"') {
            if (inQuotes && chars[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
            if (current.trim()) {
              rows.push(parseCSVLine(current));
            }
            current = '';
            if (ch === '\r' && chars[i + 1] === '\n') i++;
          } else {
            current += ch;
          }
        }
        if (current.trim()) rows.push(parseCSVLine(current));
        return rows;
      };

      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            inQuotes = !inQuotes;
          } else if (ch === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += ch;
          }
        }
        result.push(current.trim());
        return result;
      };

      const allRows = parseCSVWithMultiline(text);
      if (allRows.length < 2) {
        toast.error(tr("adminpushnotifications_csv_fayli_bosdur_0a908c", "CSV fayl\u0131 bo\u015Fdur"));
        return;
      }

      const header = allRows[0].map((c) => c.toLowerCase().replace(/[\ufeff]/g, '').replace(/"/g, ''));
      const dayIdx = header.indexOf('day_number');
      const titleIdx = header.indexOf('title');
      const bodyIdx = header.indexOf('body');
      const emojiIdx = header.indexOf('emoji');
      const activeIdx = header.indexOf('is_active');
      const timeIdx = header.indexOf('send_time');

      if (dayIdx === -1 || titleIdx === -1 || bodyIdx === -1) {
        toast.error(tr("adminpushnotifications_csv_de_day_number_title_body_s_35494f", "CSV-d\u0259 day_number, title, body s\xFCtunlar\u0131 t\u0259l\u0259b olunur"));
        return;
      }

      const rows: any[] = [];
      let skipped = 0;

      for (let i = 1; i < allRows.length; i++) {
        const values = allRows[i];
        const dayNum = parseInt(values[dayIdx]);
        const title = values[titleIdx]?.replace(/^"|"$/g, '');
        const body = values[bodyIdx]?.replace(/^"|"$/g, '');

        if (isNaN(dayNum) || dayNum < 1 || dayNum > 1460 || !title || !body) {
          skipped++;
          continue;
        }

        rows.push({
          day_number: dayNum,
          title,
          body,
          emoji: emojiIdx !== -1 ? values[emojiIdx]?.replace(/^"|"$/g, '') || '👶' : '👶',
          send_time: timeIdx !== -1 ? values[timeIdx]?.replace(/^"|"$/g, '') || '09:00' : '09:00',
          is_active: activeIdx !== -1 ? values[activeIdx]?.toLowerCase().trim() !== 'false' : true
        });
      }

      if (rows.length === 0) {
        toast.error(tr("adminpushnotifications_hec_bir_etibarli_setir_tapilma_bbe474", "He\xE7 bir etibarl\u0131 s\u0259tir tap\u0131lmad\u0131"));
        return;
      }

      let inserted = 0;
      let errors = 0;

      for (const row of rows) {
        try {
          await createNotification.mutateAsync(row);
          inserted++;
        } catch {
          errors++;
        }
      }

      toast.success(`CSV import tamamlandı: ${inserted} yeni${errors > 0 ? `, ${errors} xəta` : ''}${skipped > 0 ? `, ${skipped} keçildi` : ''}`);
    } catch (error) {
      toast.error(tr("adminpushnotifications_csv_oxuma_xetasi_d46057", "CSV oxuma x\u0259tas\u0131"));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-primary">{notificationsByDay.size}</div>
          <div className="text-sm text-muted-foreground">{tr("adminpushnotifications_elave_edilib_6b8aee", "Əlavə Edilib")}</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-red-500">{TOTAL_DAYS}</div>
          <div className="text-sm text-muted-foreground">{tr("adminpushnotifications_toplam_gun_a8eb5b", "Toplam Gün")}</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-green-500">{notifications.filter((n) => n.is_active).length}</div>
          <div className="text-sm text-muted-foreground">Aktiv</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-muted-foreground">
            {TOTAL_DAYS - notificationsByDay.size}
          </div>
          <div className="text-sm text-muted-foreground">{tr("adminpushnotifications_bos_gun_2cbd8e", "Boş Gün")}</div>
        </Card>
      </div>

      {/* CSV Import */}
      <Card className="p-4 border-dashed">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <h4 className="font-medium">CSV Import</h4>
              <p className="text-sm text-muted-foreground">{tr("adminpushnotifications_ana_bildirislerini_toplu_sekilde_csv_ile_0ba35f", "Ana bildirişlərini toplu şəkildə CSV ilə əlavə edin (1-1460 gün)")}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 me-1" />
              {tr("adminpushnotifications_numune_csv_c52f80", "N\xFCmun\u0259 CSV")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                exportToCSV(
                  notifications,
                  [
                  { key: 'day_number', header: 'day_number' },
                  { key: 'send_time', header: 'send_time' },
                  { key: 'title', header: 'title' },
                  { key: 'body', header: 'body' },
                  { key: 'emoji', header: 'emoji' },
                  { key: 'is_active', header: 'is_active' }],

                  'mommy_notifications_export.csv'
                );
                toast.success(`${notifications.length} bildiriş ixrac edildi`);
              }}
              disabled={notifications.length === 0}>
              
              <FileDown className="h-4 w-4 me-1" />
              İxrac
            </Button>
            <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <Upload className="h-4 w-4 me-1" />}
              CSV Import
            </Button>
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
          </div>
        </div>
      </Card>

      {/* Search & Pagination */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={tr("adminpushnotifications_gun_nomresi_axtar_1_1460_126dce", "Gün nömrəsi axtar (1-1460)...")}
            value={searchDay}
            onChange={(e) => setSearchDay(e.target.value.replace(/\D/g, ''))}
            className="max-w-[200px]"
            type="number"
            min={1}
            max={1460} />
          
          {searchDay &&
          <Button variant="ghost" size="sm" onClick={() => setSearchDay('')}>{tr("adminpushnotifications_sifirla_60125d", "Sıfırla")}</Button>
          }
        </div>

        {!searchDay &&
        <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" disabled={currentPage === 0} onClick={() => setCurrentPage((p) => p - 1)}>
              <ChevronLeft className="rtl:rotate-180 h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground min-w-[100px] text-center">
              {tr("adminpushnotifications_gun_18b2f4", "G\xFCn")} {startDay} - {endDay}
            </span>
            <Button variant="outline" size="icon" disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage((p) => p + 1)}>
              <ChevronRight className="rtl:rotate-180 h-4 w-4" />
            </Button>
          </div>
        }
      </div>

      {/* Days Grid */}
      <ScrollArea className="h-[500px]">
        <div className="grid grid-cols-7 gap-2">
          {filteredDays.map((day) => {
            const dayNotifications = notificationsByDay.get(day) || [];
            const month = getMonthNumber(day);
            const hasNotifications = dayNotifications.length > 0;
            const allActive = dayNotifications.every((n) => n.is_active);

            return (
              <Card
                key={day}
                className={`p-3 cursor-pointer transition-all hover:scale-105 ${
                hasNotifications ?
                allActive ? 'bg-green-500/10 border-green-500/30' : 'bg-yellow-500/10 border-yellow-500/30' :
                'bg-muted/30 border-dashed'}`
                }
                onClick={() => {
                  if (hasNotifications) {
                    if (dayNotifications.length > 1) {
                      setSelectedDay(day);
                      setSelectedDayNotifs(dayNotifications);
                      setDayListDialog(true);
                    } else {
                      handleEdit(dayNotifications[0]);
                    }
                  } else {
                    handleCreate(day);
                  }
                }}>
                
                <div className="text-center">
                  <Badge variant="outline" className="text-[10px] px-1 mb-1">A{month}</Badge>
                  <div className="text-lg font-bold">{day}</div>
                  {hasNotifications ?
                  <div className="flex items-center justify-center gap-0.5">
                      <span className="text-lg">{dayNotifications[0].emoji}</span>
                      {dayNotifications.length > 1 &&
                    <Badge className="text-[9px] px-1 h-4 bg-primary/20 text-primary">+{dayNotifications.length - 1}</Badge>
                    }
                    </div> :

                  <div className="text-xl opacity-30">+</div>
                  }
                </div>
              </Card>);

          })}
        </div>
      </ScrollArea>

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-500/20 border border-green-500/30" />
          <span>{tr("adminpushnotifications_elave_edilib_6b8aee", "Əlavə Edilib")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-500/20 border border-yellow-500/30" />
          <span>Deaktiv</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-muted/30 border border-dashed" />
          <span>{tr("adminpushnotifications_bos_485510", "Boş")}</span>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500" />
              {tr("adminpushnotifications_gun_18b2f4", "G\xFCn")} {form.day_number} - Ay {getMonthNumber(form.day_number)}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{tr("adminpushnotifications_gun_nomresi_760508", "Gün Nömrəsi")}</Label>
                <Input type="number" min={1} max={1460} value={form.day_number}
                onChange={(e) => setForm({ ...form, day_number: parseInt(e.target.value) || 1 })}
                disabled={!!editingId} />
              </div>
              <div className="space-y-2">
                <Label>{tr("adminpushnotifications_gonderme_saati_110747", "Göndərmə Saatı")}</Label>
                <Input type="time" value={form.send_time}
                onChange={(e) => setForm({ ...form, send_time: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Emoji</Label>
                <Input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} placeholder="👶" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{tr("adminpushnotifications_basliq_e1f6c5", "Başlıq")}</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={tr("adminpushnotifications_bildiris_basligi_c2a3c5", "Bildiriş başlığı...")} />
            </div>

            <div className="space-y-2">
              <Label>{tr("adminpushnotifications_metn_6e9f0f", "Mətn")}</Label>
              <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder={tr("adminpushnotifications_bildiris_metni_412bd0", "Bildiriş mətni...")} rows={4} />
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} />
              <Label>Aktiv</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>{tr("adminpushnotifications_legv_et_b5e49c", "Ləğv et")}</Button>
            {editingId &&
            <Button variant="destructive" onClick={() => {setEditDialog(false);setDeleteDialog(editingId);}}>
                <Trash2 className="h-4 w-4 me-1" /> Sil
              </Button>
            }
            <Button onClick={handleSave} disabled={createNotification.isPending || updateNotification.isPending}>
              {editingId ? tr("adminpushnotifications_yenile_570ce2", "Yenil\u0259") : 'Yarat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Day List Dialog - shows all notifications for a day */}
      <Dialog open={dayListDialog} onOpenChange={setDayListDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500" />
              {tr("adminpushnotifications_gun_18b2f4", "G\xFCn")} {selectedDay} - Ay {getMonthNumber(selectedDay)} ({selectedDayNotifs.length} {tr("adminpushnotifications_bildiris_472ec1", "bildiri\u015F)")}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3">
              {selectedDayNotifs.map((notif) =>
              <Card key={notif.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">{notif.send_time}</Badge>
                        {notif.is_active ?
                      <Badge className="text-xs bg-green-500/20 text-green-700 border-0">Aktiv</Badge> :

                      <Badge className="text-xs bg-yellow-500/20 text-yellow-700 border-0">Deaktiv</Badge>
                      }
                      </div>
                      <p className="font-medium text-sm truncate">{notif.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{notif.body}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => {
                      setDayListDialog(false);
                      handleEdit(notif);
                    }}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="destructive" className="h-8 w-8 p-0" onClick={() => {
                      setDayListDialog(false);
                      setDeleteDialog(notif.id);
                    }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDayListDialog(false)}>{tr("adminpushnotifications_bagla_84bdc9", "Bağla")}</Button>
            <Button onClick={() => {setDayListDialog(false);handleCreate(selectedDay);}}>
              <Plus className="h-4 w-4 me-1" /> {tr("adminpushnotifications_yeni_bildiris_40105e", "Yeni Bildiri\u015F")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog open={deleteDialog !== null} onOpenChange={() => setDeleteDialog(null)}
      onConfirm={() => deleteDialog && handleDelete(deleteDialog)} />
    </div>);

};

export default AdminPushNotifications;
