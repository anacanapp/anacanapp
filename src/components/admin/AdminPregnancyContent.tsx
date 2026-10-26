import { useState, useRef } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import {
  Plus, Search, Edit2, Trash2, Download, Upload,
  Baby, Apple, Heart, Dumbbell, Stethoscope, Brain,
  Check, X, FileSpreadsheet, AlertCircle } from
'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { usePregnancyContentAdmin, PregnancyContent } from '@/hooks/usePregnancyContent';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';

const AdminPregnancyContent = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    content,
    isLoading,
    createContent,
    updateContent,
    deleteContent,
    bulkDelete,
    bulkImport
  } = usePregnancyContentAdmin();

  const [search, setSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PregnancyContent | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importing, setImporting] = useState(false);

  const [formData, setFormData] = useState<Partial<PregnancyContent>>({
    pregnancy_day: 1,
    week_number: 1,
    days_until_birth: 279,
    baby_size_fruit: '',
    baby_size_cm: 0,
    baby_weight_gram: 0,
    baby_development: '',
    baby_message: '',
    body_changes: '',
    daily_tip: '',
    mother_symptoms: [],
    mother_tips: '',
    nutrition_tip: '',
    recommended_foods: [],
    emotional_tip: '',
    partner_tip: '',
    multiples_tip: '',
    is_active: true
  });

  const filteredContent = content.filter((item) =>
  item.pregnancy_day?.toString().includes(search) ||
  item.week_number.toString().includes(search) ||
  item.baby_size_fruit?.toLowerCase().includes(search.toLowerCase()) ||
  item.baby_development?.toLowerCase().includes(search.toLowerCase()) ||
  item.baby_message?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectAll = () => {
    if (selectedItems.length === filteredContent.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredContent.map((c) => c.id));
    }
  };

  const handleSelect = (id: string) => {
    setSelectedItems((prev) =>
    prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData({
      pregnancy_day: 1,
      week_number: 1,
      days_until_birth: 279,
      baby_size_fruit: '',
      baby_size_cm: 0,
      baby_weight_gram: 0,
      baby_development: '',
      baby_message: '',
      body_changes: '',
      daily_tip: '',
      mother_symptoms: [],
      mother_tips: '',
      nutrition_tip: '',
      recommended_foods: [],
      emotional_tip: '',
      partner_tip: '',
      multiples_tip: '',
      is_active: true
    });
    setModalOpen(true);
  };

  const openEditModal = (item: PregnancyContent) => {
    setEditingItem(item);
    setFormData(item);
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editingItem) {
        await updateContent.mutateAsync({ id: editingItem.id, ...formData });
        toast({ title: tr("adminpregnancycontent_ugurla_yenilendi_e58679", "Uğurla yeniləndi!") });
      } else {
        await createContent.mutateAsync(formData);
        toast({ title: tr("adminpregnancycontent_ugurla_elave_edildi_9fc0c7", "Uğurla əlavə edildi!") });
      }
      setModalOpen(false);
    } catch (error: any) {
      toast({ title: tr("adminpregnancycontent_xeta_3cdbb6", "Xəta"), description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tr("adminpregnancycontent_bu_melumati_silmek_istediyiniz_815c97", "Bu m\u0259lumat\u0131 silm\u0259k ist\u0259diyiniz\u0259 \u0259minsiniz?"))) return;
    try {
      await deleteContent.mutateAsync(id);
      toast({ title: 'Silindi!' });
    } catch (error: any) {
      toast({ title: tr("adminpregnancycontent_xeta_3cdbb6", "Xəta"), description: error.message, variant: 'destructive' });
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`${selectedItems.length} məlumatı silmək istədiyinizə əminsiniz?`)) return;
    try {
      await bulkDelete.mutateAsync(selectedItems);
      setSelectedItems([]);
      toast({ title: `${selectedItems.length} məlumat silindi!` });
    } catch (error: any) {
      toast({ title: tr("adminpregnancycontent_xeta_3cdbb6", "Xəta"), description: error.message, variant: 'destructive' });
    }
  };

  const downloadTemplate = () => {
    // Template matching user's Excel structure
    const template = [
    {
      pregnancy_day: 1,
      days_until_birth: 279,
      baby_weight_gram: 0.01,
      baby_size_cm: 0.1,
      baby_size_fruit: tr("adminpregnancycontent_xasxas_toxumu_c36b2c", "Xa\u015Fxa\u015F toxumu"),
      baby_message: tr("adminpregnancycontent_salam_ana_men_indice_mayalandi_c84fb7", "Salam ana! M\u0259n indic\u0259 mayaland\u0131m! \uD83C\uDF1F"),
      body_changes: tr("adminpregnancycontent_hele_hec_bir_fiziki_deyisiklik_9e213e", "H\u0259l\u0259 he\xE7 bir fiziki d\u0259yi\u015Fiklik hiss etm\u0259y\u0259 bil\u0259rsiniz."),
      baby_development: tr("adminpregnancycontent_yumurta_huceyresi_sperma_ile_b_091cbe", "Yumurta h\xFCceyr\u0259si sperma il\u0259 birl\u0259\u015Fdi."),
      daily_tip: tr("adminpregnancycontent_folik_tursusu_qebuluna_baslayi_13f092", "Folik tur\u015Fusu q\u0259buluna ba\u015Flay\u0131n.")
    },
    {
      pregnancy_day: 2,
      days_until_birth: 278,
      baby_weight_gram: 0.01,
      baby_size_cm: 0.1,
      baby_size_fruit: tr("adminpregnancycontent_xasxas_toxumu_c36b2c", "Xa\u015Fxa\u015F toxumu"),
      baby_message: tr("adminpregnancycontent_ana_men_bolunurem_f154ab", "Ana, m\u0259n b\xF6l\xFCn\xFCr\u0259m! \uD83D\uDC95"),
      body_changes: tr("adminpregnancycontent_daxilde_mocuze_baslayir_33d0c6", "Daxild\u0259 m\xF6c\xFCz\u0259 ba\u015Flay\u0131r."),
      baby_development: tr("adminpregnancycontent_mayalanmis_yumurta_2_huceyreye_66246a", "Mayalanm\u0131\u015F yumurta 2 h\xFCceyr\u0259y\u0259 b\xF6l\xFCn\xFCr."),
      daily_tip: tr("adminpregnancycontent_bol_su_icin_55c3f2", "Bol su i\xE7in.")
    }];


    // Create CSV content with proper encoding
    const headers = [
    'pregnancy_day', 'days_until_birth', 'baby_weight_gram', 'baby_size_cm',
    'baby_size_fruit', 'baby_message', 'body_changes', 'baby_development', 'daily_tip'];

    const headerRow = headers.join(',');
    const rows = template.map((row) =>
    headers.map((h) => `"${(row as any)[h] || ''}"`).join(',')
    );
    const csv = '\uFEFF' + [headerRow, ...rows].join('\n'); // BOM for Excel

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = tr("adminpregnancycontent_hamilelik_kontent_sablon_csv_970a11", "hamil\u0259lik_kontent_\u015Fablon.csv");
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportProgress(0);

    try {
      const text = await file.text();
      let data: any[] = [];

      if (file.name.endsWith('.json')) {
        data = JSON.parse(text);
      } else if (file.name.endsWith('.csv')) {
        // Use the new multi-line aware CSV parser
        const { headers: rawHeaders, rows: csvRows } = parseCSV(text);

        if (rawHeaders.length === 0 || csvRows.length === 0) {
          throw new Error(tr("adminpregnancycontent_csv_fayli_bosdur_ve_ya_yalniz__8c7b02", "CSV fayl\u0131 bo\u015Fdur v\u0259 ya yaln\u0131z ba\u015Fl\u0131q var"));
        }

        console.log('Parsed headers:', rawHeaders);
        console.log('Total rows parsed:', csvRows.length);

        // Map user's Excel headers to database fields (comprehensive mapping)
        const headerMap: Record<string, string> = {
          // Azerbaijani headers from user's Excel (exact matches)
          'Doğuma neçə gün qaldı': 'days_until_birth',
          'Təxmini çəki': 'baby_weight_gram',
          'Təxmini boy': 'baby_size_cm',
          'Təxmini ölçüsündə olduğu meyvə / obyekt': 'baby_size_fruit',
          'Təxmini ölçüsündəolduğu meyvə / obyekt': 'baby_size_fruit',
          'Təxmini ölçüsündə olduğu meyvə': 'baby_size_fruit',
          'Körpənizdən sizə mesaj var...': 'baby_message',
          'Körpənizdən sizə mesaj var': 'baby_message',
          'Bədəninizdə nələr baş verir...': 'body_changes',
          'Bədəninizdə nələr baş verir': 'body_changes',
          'Körpənin inkişafında nələr baş verir...': 'baby_development',
          'Körpənin inkişafında nələr baş verir': 'baby_development',
          'Günün Məsləhəti': 'daily_tip',
          'Günün məsləhəti': 'daily_tip',
          // English headers
          'pregnancy_day': 'pregnancy_day',
          'days_until_birth': 'days_until_birth',
          'baby_weight_gram': 'baby_weight_gram',
          'baby_size_cm': 'baby_size_cm',
          'baby_size_fruit': 'baby_size_fruit',
          'baby_message': 'baby_message',
          'body_changes': 'body_changes',
          'baby_development': 'baby_development',
          'daily_tip': 'daily_tip',
          'week_number': 'week_number'
        };

        // Process each row
        for (let i = 0; i < csvRows.length; i++) {
          const csvRow = csvRows[i];
          const row: any = { is_active: true };

          // Map each header to its value
          rawHeaders.forEach((header) => {
            const dbField = headerMap[header.trim()] || header.trim().toLowerCase().replace(/\s+/g, '_');
            let value = (csvRow[header] || '').trim();

            // Skip empty values or placeholders
            if (!value || value === '-' || value === '–' || value === '—') {
              return;
            }

            if (dbField === 'pregnancy_day') {
              const pDay = parseInt(value);
              // Allow up to 294 days (280 standard + 14 days for delayed birth)
              if (!isNaN(pDay) && pDay > 0 && pDay <= 294) {
                row.pregnancy_day = pDay;
                row.week_number = Math.ceil(pDay / 7);
                row.days_until_birth = Math.max(0, 280 - pDay); // Can be negative for delayed births, but we cap at 0
              }
            } else if (dbField === 'days_until_birth') {
              const daysUntil = parseInt(value);
              // Allow negative values for delayed births (up to -14 days)
              if (!isNaN(daysUntil) && daysUntil >= -14 && daysUntil <= 279) {
                row.days_until_birth = daysUntil;
                // Calculate pregnancy_day from days_until_birth
                if (!row.pregnancy_day) {
                  row.pregnancy_day = 280 - daysUntil;
                  row.week_number = Math.ceil(row.pregnancy_day / 7);
                }
              }
            } else if (dbField === 'baby_size_cm' || dbField === 'baby_weight_gram') {
              // Handle decimal values with comma or dot separator
              const cleanValue = value.replace(',', '.').replace(/[^\d.]/g, '');
              const numValue = parseFloat(cleanValue);
              if (!isNaN(numValue) && numValue >= 0) {
                row[dbField] = numValue;
              }
            } else if (dbField === 'week_number') {
              const weekNum = parseInt(value);
              // Allow up to 42 weeks (40 standard + 2 weeks delay)
              if (!isNaN(weekNum) && weekNum > 0 && weekNum <= 42) {
                row.week_number = weekNum;
              }
            } else {
              // Text fields - clean up any extra quotes
              row[dbField] = value.replace(/^["']|["']$/g, '');
            }
          });

          // Ensure we have valid pregnancy_day (up to 294 days)
          if (row.pregnancy_day && row.pregnancy_day > 0 && row.pregnancy_day <= 294) {
            // Ensure week_number is set
            if (!row.week_number) {
              row.week_number = Math.ceil(row.pregnancy_day / 7);
            }
            data.push(row);
          }

          setImportProgress(Math.round(i / csvRows.length * 40));
        }

        console.log(`Parsed ${data.length} valid rows from CSV`);
      }

      if (data.length === 0) {
        throw new Error(tr("adminpregnancycontent_hec_bir_etibarli_melumat_tapil_fcb8fb", "He\xE7 bir etibarl\u0131 m\u0259lumat tap\u0131lmad\u0131. CSV format\u0131n\u0131 yoxlay\u0131n."));
      }

      // Show parsing complete
      setImportProgress(45);
      toast({ title: 'CSV oxundu', description: `${data.length} sətir tapıldı. Bazaya yazılır...` });

      // Process and import data
      setImportProgress(50);
      const results = await bulkImport.mutateAsync(data);
      setImportProgress(100);

      toast({
        title: tr("adminpregnancycontent_import_tamamlandi_e48258", "İmport tamamlandı!"),
        description: `${results.success} uğurlu, ${results.failed} uğursuz${results.errors?.length ? ` - İlk xəta: ${results.errors[0]}` : ''}`
      });

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast({ title: tr("adminpregnancycontent_import_xetasi_a3a4fb", "İmport xətası"), description: error.message, variant: 'destructive' });
    } finally {
      setImporting(false);
      setImportModalOpen(false);
    }
  };

  // Parse entire CSV handling multi-line quoted values
  const parseCSV = (text: string): {headers: string[];rows: any[];} => {
    const result: string[][] = [];
    let current = '';
    let inQuotes = false;
    let row: string[] = [];

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote ""
          current += '"';
          i++;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else if ((char === '\n' || char === '\r' && nextChar === '\n') && !inQuotes) {
        row.push(current.trim());
        if (row.some((cell) => cell.length > 0)) {
          result.push(row);
        }
        row = [];
        current = '';
        if (char === '\r') i++; // skip \n after \r
      } else if (char !== '\r') {
        current += char;
      }
    }
    // Push last row
    if (current || row.length > 0) {
      row.push(current.trim());
      if (row.some((cell) => cell.length > 0)) {
        result.push(row);
      }
    }

    if (result.length < 2) {
      return { headers: [], rows: [] };
    }

    const headers = result[0];
    const rows = result.slice(1).map((r) => {
      const obj: any = {};
      headers.forEach((h, idx) => {
        obj[h] = r[idx] || '';
      });
      return obj;
    });

    return { headers, rows };
  };

  // Helper function to parse CSV line properly handling quoted values (kept for compatibility)
  const parseCSVLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    return values;
  };

  const downloadExcel = () => {
    // Export current data as CSV
    const headers = [
    'week_number', 'baby_size_fruit', 'baby_size_cm', 'baby_weight_gram',
    'baby_development', 'baby_message', 'mother_symptoms', 'mother_tips',
    'nutrition_tip', 'recommended_foods', 'emotional_tip', 'partner_tip', 'is_active'];


    const rows = content.map((item) => [
    item.week_number,
    item.baby_size_fruit || '',
    item.baby_size_cm || 0,
    item.baby_weight_gram || 0,
    item.baby_development || '',
    item.baby_message || '',
    (item.mother_symptoms || []).join(';'),
    item.mother_tips || '',
    item.nutrition_tip || '',
    (item.recommended_foods || []).join(';'),
    item.emotional_tip || '',
    item.partner_tip || '',
    item.is_active].
    join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pregnancy_content_export.csv';
    link.click();
    URL.revokeObjectURL(url);

    toast({ title: 'CSV ixrac edildi!' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>);

  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{tr("adminpregnancycontent_hamilelik_kontenti_9bc47b", "Hamiləlik Kontenti")}</h1>
          <p className="text-muted-foreground">{tr("adminpregnancycontent_heftelik_gundelik_kontent_idaresi_833350", "Həftəlik/gündəlik kontent idarəsi")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadExcel}>
            <Download className="w-4 h-4 me-2" />
            İxrac et
          </Button>
          <Button variant="outline" onClick={() => setImportModalOpen(true)}>
            <Upload className="w-4 h-4 me-2" />
            İmport et
          </Button>
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4 me-2" />
            {tr("adminpregnancycontent_yeni_elave_et_bcd4a4", "Yeni \u0259lav\u0259 et")}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
        { icon: Baby, label: tr("adminpregnancycontent_umumi_hefte_4e6a97", "Ümumi həftə"), value: content.length, color: 'bg-pink-100 text-pink-600' },
        { icon: Apple, label: 'Qidalanma', value: content.filter((c) => c.nutrition_tip).length, color: 'bg-green-100 text-green-600' },
        { icon: Heart, label: tr("adminpregnancycontent_korpe_mesaji_d119e3", "Körpə mesajı"), value: content.filter((c) => c.baby_message).length, color: 'bg-red-100 text-red-600' },
        { icon: Check, label: 'Aktiv', value: content.filter((c) => c.is_active).length, color: 'bg-blue-100 text-blue-600' }].
        map((stat, i) =>
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="bg-card rounded-xl p-4 border border-border">
          
            <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center mb-3`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </motion.div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={tr("adminpregnancycontent_hefte_meyve_inkisaf_axtar_5b38a8", "Həftə, meyvə, inkişaf axtar...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-10" />
          
        </div>
        
        {selectedItems.length > 0 &&
        <Button variant="destructive" onClick={handleBulkDelete}>
            <Trash2 className="w-4 h-4 me-2" />
            {selectedItems.length} {tr("adminpregnancycontent_secilmisi_sil_7cfd57", "se\xE7ilmi\u015Fi sil")}
          </Button>
        }
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedItems.length === filteredContent.length && filteredContent.length > 0}
                    onCheckedChange={handleSelectAll} />
                  
                </TableHead>
                <TableHead className="w-16">{tr("adminpregnancycontent_gun_18b2f4", "Gün")}</TableHead>
                <TableHead className="w-16">{tr("adminpregnancycontent_hefte_3aa886", "Həftə")}</TableHead>
                <TableHead>{tr("adminpregnancycontent_meyve_50ca17", "Meyvə")}</TableHead>
                <TableHead>{tr("adminpregnancycontent_olcu_735972", "Ölçü")}</TableHead>
                <TableHead className="max-w-[180px]">{tr("adminpregnancycontent_korpe_mesaji_d119e3", "Körpə mesajı")}</TableHead>
                <TableHead className="max-w-[180px]">{tr("adminpregnancycontent_beden_deyisikliyi_1dd37f", "Bədən dəyişikliyi")}</TableHead>
                <TableHead className="max-w-[150px]">{tr("adminpregnancycontent_gunun_tovsiyesi_f10d9b", "Günün tövsiyəsi")}</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">{tr("adminpregnancycontent_emeliyyat_580469", "Əməliyyat")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContent.map((item) =>
              <TableRow key={item.id}>
                  <TableCell>
                    <Checkbox
                    checked={selectedItems.includes(item.id)}
                    onCheckedChange={() => handleSelect(item.id)} />
                  
                  </TableCell>
                  <TableCell className="font-bold text-primary">{item.pregnancy_day || '-'}</TableCell>
                  <TableCell>{item.week_number}</TableCell>
                  <TableCell>{item.baby_size_fruit || '-'}</TableCell>
                  <TableCell>{item.baby_size_cm} sm / {item.baby_weight_gram} qr</TableCell>
                  <TableCell className="max-w-[180px] truncate text-sm">{item.baby_message || '-'}</TableCell>
                  <TableCell className="max-w-[180px] truncate text-sm">{item.body_changes || '-'}</TableCell>
                  <TableCell className="max-w-[150px] truncate text-sm">{item.daily_tip || '-'}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                  item.is_active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`
                  }>
                      {item.is_active ? 'Aktiv' : 'Deaktiv'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEditModal(item)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? tr("adminpregnancycontent_redakte_et_66cf3b", "Redakt\u0259 et") : tr("adminpregnancycontent_yeni_elave_et_bcd4a4", "Yeni \u0259lav\u0259 et")}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            {/* Basic Info */}
            <div className="space-y-4 col-span-2">
              <h4 className="font-semibold flex items-center gap-2">
                <Baby className="w-4 h-4" /> {tr("adminpregnancycontent_esas_melumatlar_4b8ccc", "\u018Fsas m\u0259lumatlar")}
              </h4>
              <div className="grid grid-cols-5 gap-3">
                <div>
                  <Label>{tr("adminpregnancycontent_gun_1_280_8e5b4a", "Gün (1-280)")}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={280}
                    value={formData.pregnancy_day || 1}
                    onChange={(e) => {
                      const day = parseInt(e.target.value);
                      setFormData({
                        ...formData,
                        pregnancy_day: day,
                        week_number: Math.ceil(day / 7),
                        days_until_birth: 280 - day
                      });
                    }} />
                  
                </div>
                <div>
                  <Label>{tr("adminpregnancycontent_hefte_3aa886", "Həftə")}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={42}
                    value={formData.week_number}
                    onChange={(e) => setFormData({ ...formData, week_number: parseInt(e.target.value) })} />
                  
                </div>
                <div>
                  <Label>{tr("adminpregnancycontent_meyve_olcusu_f8676b", "Meyvə ölçüsü")}</Label>
                  <Input
                    value={formData.baby_size_fruit || ''}
                    onChange={(e) => setFormData({ ...formData, baby_size_fruit: e.target.value })}
                    placeholder="Alma" />
                  
                </div>
                <div>
                  <Label>{tr("adminpregnancycontent_olcu_sm_ae8d14", "Ölçü (sm)")}</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.baby_size_cm || 0}
                    onChange={(e) => setFormData({ ...formData, baby_size_cm: parseFloat(e.target.value) })} />
                  
                </div>
                <div>
                  <Label>{tr("adminpregnancycontent_ceki_qram_1bd180", "Çəki (qram)")}</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.baby_weight_gram || 0}
                    onChange={(e) => setFormData({ ...formData, baby_weight_gram: parseFloat(e.target.value) })} />
                  
                </div>
              </div>
            </div>

            {/* Baby Message */}
            <div className="space-y-2">
              <Label>{tr("adminpregnancycontent_korpeden_mesaj_67f29c", "Körpədən mesaj 💬")}</Label>
              <Textarea
                value={formData.baby_message || ''}
                onChange={(e) => setFormData({ ...formData, baby_message: e.target.value })}
                placeholder="Salam ana! 💕"
                rows={3} />
              
            </div>

            {/* Baby Development */}
            <div className="space-y-2">
              <Label>{tr("adminpregnancycontent_korpe_inkisafi_e7dc67", "Körpə inkişafı 👶")}</Label>
              <Textarea
                value={formData.baby_development || ''}
                onChange={(e) => setFormData({ ...formData, baby_development: e.target.value })}
                placeholder={tr("adminpregnancycontent_urek_doyuntusu_baslayir_12ea3b", "Ürək döyüntüsü başlayır...")}
                rows={3} />
              
            </div>

            {/* Body Changes */}
            <div className="space-y-2">
              <Label>{tr("adminpregnancycontent_bedeninizde_neler_bas_verir_f84fdb", "Bədəninizdə nələr baş verir 🤰")}</Label>
              <Textarea
                value={formData.body_changes || ''}
                onChange={(e) => setFormData({ ...formData, body_changes: e.target.value })}
                placeholder={tr("adminpregnancycontent_urekbulanma_baslaya_biler_81e163", "Ürəkbulanma başlaya bilər...")}
                rows={3} />
              
            </div>

            {/* Daily Tip */}
            <div className="space-y-2">
              <Label>{tr("adminpregnancycontent_gunun_mesleheti_abd084", "Günün Məsləhəti 💡")}</Label>
              <Textarea
                value={formData.daily_tip || ''}
                onChange={(e) => setFormData({ ...formData, daily_tip: e.target.value })}
                placeholder={tr("adminpregnancycontent_folik_tursusu_qebul_edin_81c86b", "Folik turşusu qəbul edin...")}
                rows={3} />
              
            </div>

            {/* Mother Info */}
            <div className="col-span-2 space-y-4">
              <h4 className="font-semibold flex items-center gap-2">
                <Heart className="w-4 h-4" /> {tr("adminpregnancycontent_ana_ucun_melumatlar_6e470d", "Ana \xFC\xE7\xFCn m\u0259lumatlar")}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{tr("adminpregnancycontent_simptomlar_her_setirde_bir_5396e7", "Simptomlar (hər sətirdə bir)")}</Label>
                  <Textarea
                    value={(formData.mother_symptoms || []).join('\n')}
                    onChange={(e) => setFormData({
                      ...formData,
                      mother_symptoms: e.target.value.split('\n').filter((s) => s.trim())
                    })}
                    placeholder={tr("adminpregnancycontent_urekbulanma_10_yorgunluq_eeb0bf", "Ürəkbulanma&#10;Yorğunluq")}
                    rows={3} />
                  
                </div>
                <div className="space-y-2">
                  <Label>{tr("adminpregnancycontent_ana_ucun_tovsiye_d33fd6", "Ana üçün tövsiyə")}</Label>
                  <Textarea
                    value={formData.mother_tips || ''}
                    onChange={(e) => setFormData({ ...formData, mother_tips: e.target.value })}
                    rows={3} />
                  
                </div>
              </div>
            </div>

            {/* Nutrition */}
            <div className="col-span-2 space-y-4">
              <h4 className="font-semibold flex items-center gap-2">
                <Apple className="w-4 h-4" /> Qidalanma
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{tr("adminpregnancycontent_qidalanma_tovsiyesi_cddcc0", "Qidalanma tövsiyəsi")}</Label>
                  <Textarea
                    value={formData.nutrition_tip || ''}
                    onChange={(e) => setFormData({ ...formData, nutrition_tip: e.target.value })}
                    rows={2} />
                  
                </div>
                <div className="space-y-2">
                  <Label>{tr("adminpregnancycontent_tovsiye_edilen_qidalar_her_setirde_bir_55972b", "Tövsiyə edilən qidalar (hər sətirdə bir)")}</Label>
                  <Textarea
                    value={(formData.recommended_foods || []).join('\n')}
                    onChange={(e) => setFormData({
                      ...formData,
                      recommended_foods: e.target.value.split('\n').filter((s) => s.trim())
                    })}
                    rows={2} />
                  
                </div>
              </div>
            </div>

            {/* Emotional & Partner */}
            <div className="space-y-2">
              <Label>{tr("adminpregnancycontent_emosional_tovsiye_2c36f9", "Emosional tövsiyə")}</Label>
              <Textarea
                value={formData.emotional_tip || ''}
                onChange={(e) => setFormData({ ...formData, emotional_tip: e.target.value })}
                rows={2} />
              
            </div>
            <div className="space-y-2">
              <Label>{tr("adminpregnancycontent_partner_ucun_tovsiye_3fdfae", "Partner üçün tövsiyə")}</Label>
              <Textarea
                value={formData.partner_tip || ''}
                onChange={(e) => setFormData({ ...formData, partner_tip: e.target.value })}
                rows={2} />
              
            </div>
            <div className="col-span-2 space-y-2">
              <Label>👶👶 {tr("adminpregnancycontent_ekiz_coxdollu_tovsiye", "Əkiz/çoxdöllü hamiləlik üçün məsləhət (AZ — digər dillər 'Kontent Tərcüməsi (AI)' alətindən tərcümə olunur, YALNIZ isMultiple istifadəçilərə göstərilir)")}</Label>
              <Textarea
                value={(formData as any).multiples_tip || ''}
                onChange={(e) => setFormData({ ...formData, multiples_tip: e.target.value } as any)}
                rows={3} />
              
            </div>

            {/* Active Status */}
            <div className="col-span-2 flex items-center gap-3">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
              
              <Label>Aktiv</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>{tr("adminpregnancycontent_legv_et_b5e49c", "Ləğv et")}</Button>
            <Button onClick={handleSave}>
              {editingItem ? tr("adminpregnancycontent_yenile_570ce2", "Yenil\u0259") : tr("adminpregnancycontent_elave_et_6e1b9b", "\u018Flav\u0259 et")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("adminpregnancycontent_excel_csv_import_f512ca", "Excel/CSV İmport")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <AlertCircle className="w-4 h-4" />
                <span>{tr("adminpregnancycontent_csv_ve_ya_json_formatinda_fayl_yukleyin_25e1aa", "CSV və ya JSON formatında fayl yükləyin")}</span>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <FileSpreadsheet className="w-4 h-4 me-2" />
                {tr("adminpregnancycontent_sablon_yukle_45cf3b", "\u015Eablon y\xFCkl\u0259")}
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json"
              onChange={handleFileUpload}
              className="hidden" />
            
            
            <Button
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}>
              
              <Upload className="w-4 h-4 me-2" />
              {tr("adminpregnancycontent_fayl_sec_4fed3f", "Fayl se\xE7")}
            </Button>

            {importing &&
            <div className="space-y-2">
                <Progress value={importProgress} />
                <p className="text-sm text-center text-muted-foreground">
                  İmport edilir... {importProgress}%
                </p>
              </div>
            }
          </div>
        </DialogContent>
      </Dialog>
    </div>);

};

export default AdminPregnancyContent;