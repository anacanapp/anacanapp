import { useState, useRef } from 'react';
import { tr } from '@/lib/tr';
import { useMommyDailyMessagesAdmin, MommyDailyMessage } from '@/hooks/useMommyDailyMessages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Save, X, Upload, Download, Search, Heart, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { exportToCSV } from '@/utils/csvExport';

const AdminMommyDailyMessages = () => {
  const { data, isLoading, createMessage, updateMessage, deleteMessage, bulkImport } = useMommyDailyMessagesAdmin();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<MommyDailyMessage>>({});
  const [searchDay, setSearchDay] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredData = searchDay ?
  data.filter((d) => d.day_number.toString().includes(searchDay)) :
  data;

  const handleCreate = () => {
    const nextDay = data.length > 0 ? Math.max(...data.map((d) => d.day_number)) + 1 : 1;
    createMessage.mutate(
      { day_number: nextDay, message: 'Yeni anaya mesaj' },
      {
        onSuccess: () => toast.success(tr("adminmommydailymessages_elave_edildi_b7d7e4", "\u018Flav\u0259 edildi")),
        onError: (e: any) => toast.error(e.message || tr("adminmommydailymessages_xeta_3cdbb6", "X\u0259ta"))
      }
    );
  };

  const handleUpdate = (id: string) => {
    updateMessage.mutate(
      { id, ...formData },
      {
        onSuccess: () => {toast.success(tr("adminmommydailymessages_yenilendi_d10a01", "Yenil\u0259ndi"));setEditingId(null);setFormData({});},
        onError: () => toast.error(tr("adminmommydailymessages_xeta_3cdbb6", "X\u0259ta"))
      }
    );
  };

  const handleDelete = (id: string) => {
    if (!confirm(tr("adminmommydailymessages_silmek_istediyinize_eminsiniz_09658f", "Silm\u0259k ist\u0259diyiniz\u0259 \u0259minsiniz?"))) return;
    deleteMessage.mutate(id, {
      onSuccess: () => toast.success('Silindi'),
      onError: () => toast.error(tr("adminmommydailymessages_xeta_3cdbb6", "X\u0259ta"))
    });
  };

  const parseCSV = (text: string) => {
    const items: {day_number: number;message: string;}[] = [];
    const lines = text.split('\n');
    let i = 0;
    // Skip header
    if (lines[0]?.toLowerCase().includes('day_number')) i = 1;

    while (i < lines.length) {
      const line = lines[i].trim();
      if (!line) {i++;continue;}

      // Handle quoted multi-line fields
      const firstComma = line.indexOf(',');
      if (firstComma === -1) {i++;continue;}

      const dayStr = line.substring(0, firstComma).trim();
      const dayNum = parseInt(dayStr, 10);
      if (isNaN(dayNum) || dayNum < 1 || dayNum > 1460) {i++;continue;}

      let rest = line.substring(firstComma + 1).trim();

      if (rest.startsWith('"')) {
        // Multi-line quoted field
        let fullMessage = rest.substring(1);
        while (!fullMessage.endsWith('"') && i + 1 < lines.length) {
          i++;
          fullMessage += '\n' + lines[i];
        }
        if (fullMessage.endsWith('"')) fullMessage = fullMessage.slice(0, -1);
        items.push({ day_number: dayNum, message: fullMessage.replace(/""/g, '"') });
      } else {
        items.push({ day_number: dayNum, message: rest });
      }
      i++;
    }
    return items;
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const items = parseCSV(text);
    if (items.length === 0) {toast.error(tr("adminmommydailymessages_csv_den_hec_bir_melumat_tapilm_d9b834", "CSV-d\u0259n he\xE7 bir m\u0259lumat tap\u0131lmad\u0131"));return;}

    toast.info(`${items.length} mesaj import edilir...`);
    bulkImport.mutate(items, {
      onSuccess: (result) => {
        toast.success(`${result.success} uğurlu, ${result.failed} uğursuz`);
        if (result.errors.length > 0) toast.error(result.errors.slice(0, 3).join(', '));
      },
      onError: () => toast.error(tr("adminmommydailymessages_import_xetasi_84d70f", "Import x\u0259tas\u0131"))
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/templates/anaya_mesaj_numune.csv';
    link.download = 'anaya_mesaj_numune.csv';
    link.click();
  };

  if (isLoading) return <div className="p-4 text-center text-muted-foreground">{tr("adminmommydailymessages_yuklenir_5557de", "Yüklənir...")}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-rose-500" />
          <h3 className="font-bold text-lg">{tr("adminmommydailymessages_anaya_mesaj_1_1460_gun_b6c7d8", "Anaya Mesaj (1-1460 gün)")}</h3>
          <span className="text-xs bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full font-medium">
            {data.length} mesaj
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 absolute start-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder={tr("adminmommydailymessages_gun_axtar_4c2871", "Gün axtar...")}
              value={searchDay}
              onChange={(e) => setSearchDay(e.target.value)}
              className="ps-8 w-32 h-9" />
            
          </div>
          <Button size="sm" variant="outline" onClick={downloadTemplate}>
            <Download className="w-4 h-4 me-1" /> {tr("adminmommydailymessages_numune_19d1f6", "N\xFCmun\u0259")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 me-1" /> CSV Import
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              exportToCSV(
                data,
                [
                { key: 'day_number', header: 'day_number' },
                { key: 'message', header: 'message' },
                { key: 'is_active', header: 'is_active' }],

                'mommy_daily_messages_export.csv'
              );
              toast.success(`${data.length} mesaj ixrac edildi`);
            }}
            disabled={data.length === 0}>
            
            <FileDown className="w-4 h-4 me-1" /> İxrac
          </Button>
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
          <Button size="sm" onClick={handleCreate}>
            <Plus className="w-4 h-4 me-1" /> {tr("adminmommydailymessages_elave_et_6e1b9b", "\u018Flav\u0259 et")}
          </Button>
        </div>
      </div>

      <div className="grid gap-2 max-h-[65vh] overflow-y-auto pe-1">
        {filteredData.map((item) =>
        <Card key={item.id} className="border-border/50">
            <CardContent className="p-3">
              {editingId === item.id ?
            <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                  type="number"
                  min={1} max={1460}
                  value={formData.day_number ?? item.day_number}
                  onChange={(e) => setFormData((p) => ({ ...p, day_number: parseInt(e.target.value) }))}
                  className="w-24 h-9"
                  placeholder={tr("adminmommydailymessages_gun_18b2f4", "Gün")} />
                
                    <div className="flex items-center gap-1">
                      <Switch
                    checked={formData.is_active ?? item.is_active}
                    onCheckedChange={(v) => setFormData((p) => ({ ...p, is_active: v }))} />
                  
                      <span className="text-xs text-muted-foreground">Aktiv</span>
                    </div>
                  </div>
                  <Textarea
                value={formData.message ?? item.message}
                onChange={(e) => setFormData((p) => ({ ...p, message: e.target.value }))}
                rows={4}
                placeholder="Anaya mesaj..." />
              
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleUpdate(item.id)}>
                      <Save className="w-3 h-3 me-1" /> Saxla
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => {setEditingId(null);setFormData({});}}>
                      <X className="w-3 h-3 me-1" /> {tr("adminmommydailymessages_legv_et_b5e49c", "L\u0259\u011Fv et")}
                    </Button>
                  </div>
                </div> :

            <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-1 min-w-[48px]">
                    <span className="text-xs font-bold bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-full">
                      {item.day_number}
                    </span>
                    <span className={`w-2 h-2 rounded-full ${item.is_active ? 'bg-emerald-500' : 'bg-muted'}`} />
                  </div>
                  <p className="flex-1 text-sm text-foreground leading-relaxed line-clamp-2">{item.message}</p>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => {setEditingId(item.id);setFormData({});}}>
                      ✏️
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                </div>
            }
            </CardContent>
          </Card>
        )}
        {filteredData.length === 0 &&
        <div className="text-center py-8 text-muted-foreground">
            <Heart className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>{tr("adminmommydailymessages_hec_bir_mesaj_tapilmadi_12db36", "Heç bir mesaj tapılmadı")}</p>
          </div>
        }
      </div>
    </div>);

};

export default AdminMommyDailyMessages;