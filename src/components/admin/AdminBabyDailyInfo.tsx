import { useState, useRef } from 'react';
import { tr } from '@/lib/tr';
import { useBabyDailyInfoAdmin, BabyDailyInfo } from '@/hooks/useBabyDailyInfo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Save, X, Upload, Download, Search, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { exportToCSV } from '@/utils/csvExport';

const AdminBabyDailyInfo = () => {
  const { data, isLoading, createInfo, updateInfo, deleteInfo, bulkImport } = useBabyDailyInfoAdmin();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<BabyDailyInfo>>({});
  const [searchDay, setSearchDay] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredData = searchDay ?
  data.filter((d) => d.day_number.toString().includes(searchDay)) :
  data;

  const handleCreate = () => {
    const nextDay = data.length > 0 ? Math.max(...data.map((d) => d.day_number)) + 1 : 1;
    createInfo.mutate(
      { day_number: nextDay, info: tr("adminbabydailyinfo_yeni_gun_melumati_29b028", "Yeni gün məlumatı") },
      {
        onSuccess: () => toast.success(tr("adminbabydailyinfo_elave_edildi_b7d7e4", "\u018Flav\u0259 edildi")),
        onError: (e: any) => toast.error(e.message || tr("adminbabydailyinfo_xeta_3cdbb6", "X\u0259ta"))
      }
    );
  };

  const handleUpdate = (id: string) => {
    updateInfo.mutate(
      { id, ...formData },
      {
        onSuccess: () => {toast.success(tr("adminbabydailyinfo_yenilendi_d10a01", "Yenil\u0259ndi"));setEditingId(null);setFormData({});},
        onError: () => toast.error(tr("adminbabydailyinfo_xeta_3cdbb6", "X\u0259ta"))
      }
    );
  };

  const handleDelete = (id: string) => {
    if (!confirm(tr("adminbabydailyinfo_silmek_istediyinize_eminsiniz_09658f", "Silm\u0259k ist\u0259diyiniz\u0259 \u0259minsiniz?"))) return;
    deleteInfo.mutate(id, {
      onSuccess: () => toast.success('Silindi'),
      onError: () => toast.error(tr("adminbabydailyinfo_xeta_3cdbb6", "X\u0259ta"))
    });
  };

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const items: {day_number: number;info: string;}[] = [];

        // Parse CSV with support for quoted multi-line fields
        const rows: string[][] = [];
        let currentRow: string[] = [];
        let currentField = '';
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          const nextChar = text[i + 1];

          if (inQuotes) {
            if (char === '"' && nextChar === '"') {
              currentField += '"';
              i++; // skip escaped quote
            } else if (char === '"') {
              inQuotes = false;
            } else {
              currentField += char;
            }
          } else {
            if (char === '"') {
              inQuotes = true;
            } else if (char === ',') {
              currentRow.push(currentField.trim());
              currentField = '';
            } else if (char === '\n' || char === '\r' && nextChar === '\n') {
              currentRow.push(currentField.trim());
              if (currentRow.some((f) => f.length > 0)) {
                rows.push(currentRow);
              }
              currentRow = [];
              currentField = '';
              if (char === '\r') i++;
            } else {
              currentField += char;
            }
          }
        }
        // Last row
        if (currentField || currentRow.length > 0) {
          currentRow.push(currentField.trim());
          if (currentRow.some((f) => f.length > 0)) {
            rows.push(currentRow);
          }
        }

        // Skip header
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const dayNum = parseInt(row[0]);
          const info = row[1] || '';

          if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 1460 && info.length > 0) {
            items.push({ day_number: dayNum, info });
          }
        }

        if (items.length === 0) {
          toast.error(tr("adminbabydailyinfo_csv_den_hec_bir_melumat_oxunma_8ba9a1", "CSV-d\u0259n he\xE7 bir m\u0259lumat oxunmad\u0131"));
          return;
        }

        bulkImport.mutate(items, {
          onSuccess: (result) => {
            toast.success(`${result.success} məlumat idxal edildi${result.failed > 0 ? `, ${result.failed} uğursuz` : ''}`);
          },
          onError: () => toast.error(tr("adminbabydailyinfo_i_dxal_xetasi_12c588", "\u0130dxal x\u0259tas\u0131"))
        });
      } catch (err) {
        toast.error(tr("adminbabydailyinfo_csv_oxunma_xetasi_1531bd", "CSV oxunma x\u0259tas\u0131"));
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (isLoading) return <div className="p-6 text-center text-muted-foreground">{tr("adminbabydailyinfo_yuklenir_5557de", "Yüklənir...")}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleCreate} size="sm">
          <Plus className="w-4 h-4 me-1" /> {tr("adminbabydailyinfo_yeni_gun_d62838", "Yeni g\xFCn")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Upload className="w-4 h-4 me-1" /> CSV İdxal
        </Button>
        <a href="/templates/gunluk_melumat_numune.csv" download>
          <Button variant="ghost" size="sm">
            <Download className="w-4 h-4 me-1" /> {tr("adminbabydailyinfo_numune_csv_c52f80", "N\xFCmun\u0259 CSV")}
          </Button>
        </a>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            exportToCSV(
              data,
              [
              { key: 'day_number', header: 'day_number' },
              { key: 'info', header: 'info' },
              { key: 'is_active', header: 'is_active' }],

              'baby_daily_info_export.csv'
            );
            toast.success(`${data.length} məlumat ixrac edildi`);
          }}
          disabled={data.length === 0}>
          
          <FileDown className="w-4 h-4 me-1" /> İxrac
        </Button>
        <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />

        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={tr("adminbabydailyinfo_gun_axtar_4c2871", "Gün axtar...")}
            value={searchDay}
            onChange={(e) => setSearchDay(e.target.value)}
            className="w-32 h-8 text-sm" />
          
        </div>
        <span className="text-xs text-muted-foreground">{data.length} {tr("adminbabydailyinfo_1460_gun_23d0e1", "/ 1460 g\xFCn")}</span>
      </div>

      <div className="space-y-2 max-h-[70vh] overflow-y-auto">
        {filteredData.map((item) =>
        <Card key={item.id} className="border">
            <CardContent className="p-3">
              {editingId === item.id ?
            <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium w-12">{tr("adminbabydailyinfo_gun_93a83c", "Gün:")}</label>
                    <Input
                  type="number"
                  min={1}
                  max={1460}
                  value={formData.day_number ?? item.day_number}
                  onChange={(e) => setFormData({ ...formData, day_number: parseInt(e.target.value) })}
                  className="w-24 h-8 text-sm" />
                
                    <div className="flex items-center gap-1 ms-auto">
                      <span className="text-xs">Aktiv:</span>
                      <Switch
                    checked={formData.is_active ?? item.is_active}
                    onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} />
                  
                    </div>
                  </div>
                  <Textarea
                value={formData.info ?? item.info}
                onChange={(e) => setFormData({ ...formData, info: e.target.value })}
                rows={4}
                className="text-sm" />
              
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleUpdate(item.id)}>
                      <Save className="w-3 h-3 me-1" /> Saxla
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => {setEditingId(null);setFormData({});}}>
                      <X className="w-3 h-3 me-1" /> {tr("adminbabydailyinfo_legv_et_b5e49c", "L\u0259\u011Fv et")}
                    </Button>
                  </div>
                </div> :

            <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-14 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">{item.day_number}</span>
                  </div>
                  <p className="flex-1 text-sm text-foreground leading-relaxed line-clamp-3">{item.info}</p>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!item.is_active &&
                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">Deaktiv</span>
                }
                    <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {setEditingId(item.id);setFormData({});}}>
                      {tr("adminbabydailyinfo_redakte_d53ba7", "Redakt\u0259")}
                    
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
            {searchDay ? tr("adminbabydailyinfo_netice_tapilmadi_4b1b52", "N\u0259tic\u0259 tap\u0131lmad\u0131") : tr("adminbabydailyinfo_hele_melumat_yoxdur_csv_idxal__dc868c", "H\u0259l\u0259 m\u0259lumat yoxdur. CSV idxal edin v\u0259 ya yeni g\xFCn \u0259lav\u0259 edin.")}
          </div>
        }
      </div>
    </div>);

};

export default AdminBabyDailyInfo;