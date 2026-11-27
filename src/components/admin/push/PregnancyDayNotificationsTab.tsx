// Split out of AdminPushNotifications.tsx (admin redesign). Logic unchanged; shared imports kept verbatim.
import { useState, useRef } from 'react';
import { tr } from '@/lib/tr';
import { Plus, Trash2, Edit, Baby, Search, ChevronLeft, ChevronRight, Loader2, Upload, Download, FileText, FileDown } from 'lucide-react';
import { exportToCSV } from '@/utils/csvExport';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePregnancyDayNotifications, useCreatePregnancyDayNotification, useUpdatePregnancyDayNotification, useDeletePregnancyDayNotification } from '@/hooks/useAdvancedNotifications';
import { toast } from 'sonner';
import { LoadingSpinner, DeleteConfirmDialog } from './shared';

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


export default PregnancyDayNotificationsTab;
