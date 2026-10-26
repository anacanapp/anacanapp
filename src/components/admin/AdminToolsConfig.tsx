import { useState } from 'react';
import { tr } from '@/lib/tr';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Save, Loader2 } from 'lucide-react';
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";

interface ColumnConfig {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'color' | 'boolean';
}

interface ConfigTableProps {
  tableName: string;
  title: string;
  columns: ColumnConfig[];
  defaultValues: Record<string, any>;
}

function ConfigTable({ tableName, title, columns, defaultValues }: ConfigTableProps) {
  const queryClient = useQueryClient();
  const [editItem, setEditItem] = useState<Record<string, any> | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>(defaultValues);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: [tableName],
    queryFn: async () => {
      const { data, error } = await supabase.
      from(tableName as any).
      select('*').
      order('sort_order');
      if (error) throw error;
      return data as Record<string, any>[];
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (item: Record<string, any>) => {
      if (editItem) {
        const { error } = await supabase.from(tableName as any).update(item).eq('id', editItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(tableName as any).insert(item);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [tableName] });
      toast.success(editItem ? tr("admintoolsconfig_yenilendi_d10a01", "Yenil\u0259ndi") : tr("admintoolsconfig_elave_edildi_b7d7e4", "\u018Flav\u0259 edildi"));
      setIsDialogOpen(false);
      setEditItem(null);
      setFormData(defaultValues);
    },
    onError: () => toast.error(tr("admintoolsconfig_xeta_bas_verdi_f22fba", "X\u0259ta ba\u015F verdi"))
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(tableName as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [tableName] });
      toast.success('Silindi');
    },
    onError: () => toast.error(tr("admintoolsconfig_xeta_bas_verdi_f22fba", "X\u0259ta ba\u015F verdi"))
  });

  const openEdit = (item: Record<string, any>) => {
    setEditItem(item);
    setFormData(item);
    setIsDialogOpen(true);
  };

  const openCreate = () => {
    setEditItem(null);
    setFormData(defaultValues);
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">{title}</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 me-1" /> {tr("admintoolsconfig_elave_et_6e1b9b", "\u018Flav\u0259 et")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editItem ? tr("admintoolsconfig_redakte_et_66cf3b", "Redakt\u0259 et") : tr("admintoolsconfig_yeni_elave_et_bcd4a4", "Yeni \u0259lav\u0259 et")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {columns.map((col) =>
              <div key={col.key} className="space-y-2">
                  <Label>{col.label}</Label>
                  {col.type === 'boolean' ?
                <Switch
                  checked={!!formData[col.key]}
                  onCheckedChange={(v) => setFormData({ ...formData, [col.key]: v })} /> :

                col.type === 'color' ?
                <div className="flex gap-2">
                      <Input
                    type="color"
                    value={formData[col.key] as string || '#000000'}
                    onChange={(e) => setFormData({ ...formData, [col.key]: e.target.value })}
                    className="w-16 h-10 p-1" />
                  
                      <Input
                    value={formData[col.key] as string || ''}
                    onChange={(e) => setFormData({ ...formData, [col.key]: e.target.value })}
                    placeholder="#RRGGBB" />
                  
                    </div> :

                <Input
                  type={col.type === 'number' ? 'number' : 'text'}
                  value={formData[col.key] ?? ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    [col.key]: col.type === 'number' ? Number(e.target.value) : e.target.value
                  })} />

                }
                </div>
              )}
              <Button
                onClick={() => saveMutation.mutate(formData)}
                className="w-full"
                disabled={saveMutation.isPending}>
                
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : <Save className="w-4 h-4 me-2" />}
                Saxla
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.slice(0, 4).map((col) =>
              <TableHead key={col.key}>{col.label}</TableHead>
              )}
              <TableHead className="w-24">{tr("admintoolsconfig_emeliyyatlar_54d70c", "Əməliyyatlar")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) =>
            <TableRow key={item.id}>
                {columns.slice(0, 4).map((col) =>
              <TableCell key={col.key}>
                    {col.type === 'color' ?
                <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded" style={{ backgroundColor: item[col.key] as string }} />
                        <span className="text-xs">{item[col.key]}</span>
                      </div> :
                col.type === 'boolean' ?
                item[col.key] ? '✓' : '✗' :

                String(item[col.key] ?? '')
                }
                  </TableCell>
              )}
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(item)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(item.id)}
                    disabled={deleteMutation.isPending}>
                    
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>);

}

const AdminToolsConfig = () => {
    const localize = useAdminLocalize();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{tr("admintoolsconfig_alet_konfiqurasiyalari_942d10", "Alət Konfiqurasiyaları")}</h1>
        <p className="text-muted-foreground">{tr("admintoolsconfig_aletler_ucun_label_emoji_reng_ve_diger_k_22be56", "Alətlər üçün label, emoji, rəng və digər konfiqurasiyaları idarə edin")}</p>
      </div>

      <Tabs defaultValue="cry" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted p-1">
          <TabsTrigger value="cry" className="text-xs py-2 px-3">{tr("admintoolsconfig_aglama_d7aa1d", "Ağlama")}</TabsTrigger>
          <TabsTrigger value="poop" className="text-xs py-2 px-3">{tr("admintoolsconfig_necis_a1c9af", "Nəcis")}</TabsTrigger>
          <TabsTrigger value="market" className="text-xs py-2 px-3">Bazar</TabsTrigger>
          <TabsTrigger value="providers" className="text-xs py-2 px-3">{tr("admintoolsconfig_hekim_c127f7", "Həkim")}</TabsTrigger>
          <TabsTrigger value="horoscope" className="text-xs py-2 px-3">{tr("admintoolsconfig_burcler_bb45a3", "Bürclər")}</TabsTrigger>
          <TabsTrigger value="weather" className="text-xs py-2 px-3">Hava</TabsTrigger>
        </TabsList>

        <TabsContent value="cry" className="space-y-4">
          <ConfigTable
            tableName="cry_type_labels"
            title={tr("admintoolsconfig_aglama_tipleri_2ca6d2", "Ağlama Tipləri")}
            columns={[
            { key: 'cry_type', label: 'Tip Kodu' },
            { key: 'label_az', label: tr("admintoolsconfig_azerbaycanca_bdc8df", "Azərbaycanca") },
            { key: 'emoji', label: 'Emoji' },
            { key: 'color', label: tr("admintoolsconfig_reng_8c6bc5", "Rəng"), type: 'color' },
            { key: 'description_az', label: tr("admintoolsconfig_tesvir_f85651", "Təsvir") },
            { key: 'sort_order', label: tr("admintoolsconfig_sira_421c5f", "Sıra"), type: 'number' }]
            }
            defaultValues={{ cry_type: '', label_az: '', emoji: '😢', color: '#EF4444', sort_order: 0 }} />
          
        </TabsContent>

        <TabsContent value="poop" className="space-y-4">
          <ConfigTable
            tableName="poop_color_labels"
            title={tr("admintoolsconfig_necis_rengleri_44d5f6", "Nəcis Rəngləri")}
            columns={[
            { key: 'color_key', label: tr("admintoolsconfig_reng_kodu_abe5cc", "Rəng Kodu") },
            { key: 'label_az', label: tr("admintoolsconfig_azerbaycanca_bdc8df", "Azərbaycanca") },
            { key: 'emoji', label: 'Emoji' },
            { key: 'hex_color', label: tr("admintoolsconfig_hex_reng_9079bc", "HEX Rəng"), type: 'color' },
            { key: 'status', label: 'Status' },
            { key: 'description_az', label: tr("admintoolsconfig_tesvir_f85651", "Təsvir") },
            { key: 'sort_order', label: tr("admintoolsconfig_sira_421c5f", "Sıra"), type: 'number' }]
            }
            defaultValues={{ color_key: '', label_az: '', emoji: '💩', hex_color: '#8B4513', status: 'normal', sort_order: 0 }} />
          
        </TabsContent>

        <TabsContent value="market" className="space-y-4">
          <ConfigTable
            tableName="marketplace_categories"
            title={tr("admintoolsconfig_bazar_kateqoriyalari_89d0b8", "Bazar Kateqoriyaları")}
            columns={[
            { key: 'category_key', label: 'Kateqoriya Kodu' },
            { key: 'label_az', label: tr("admintoolsconfig_azerbaycanca_bdc8df", "Azərbaycanca") },
            { key: 'emoji', label: 'Emoji' },
            { key: 'sort_order', label: tr("admintoolsconfig_sira_421c5f", "Sıra"), type: 'number' }]
            }
            defaultValues={{ category_key: '', label_az: '', emoji: '📦', sort_order: 0 }} />
          

          <ConfigTable
            tableName="product_conditions"
            title={tr("admintoolsconfig_mehsul_veziyyetleri_ac1d2a", "Məhsul Vəziyyətləri")}
            columns={[
            { key: 'condition_key', label: tr("admintoolsconfig_veziyyet_kodu_2d1018", "Vəziyyət Kodu") },
            { key: 'label_az', label: tr("admintoolsconfig_azerbaycanca_bdc8df", "Azərbaycanca") },
            { key: 'emoji', label: 'Emoji' },
            { key: 'color', label: tr("admintoolsconfig_reng_8c6bc5", "Rəng"), type: 'color' },
            { key: 'sort_order', label: tr("admintoolsconfig_sira_421c5f", "Sıra"), type: 'number' }]
            }
            defaultValues={{ condition_key: '', label_az: '', emoji: '✨', color: '#22C55E', sort_order: 0 }} />
          

          <ConfigTable
            tableName="age_ranges"
            title={tr("admintoolsconfig_yas_araliqlari_38035a", "Yaş Aralıqları")}
            columns={[
            { key: 'range_key', label: tr("admintoolsconfig_araliq_kodu_ac7b82", "Aralıq Kodu") },
            { key: 'label_az', label: tr("admintoolsconfig_azerbaycanca_bdc8df", "Azərbaycanca") },
            { key: 'min_months', label: 'Min Ay', type: 'number' },
            { key: 'max_months', label: 'Max Ay', type: 'number' },
            { key: 'sort_order', label: tr("admintoolsconfig_sira_421c5f", "Sıra"), type: 'number' }]
            }
            defaultValues={{ range_key: '', label_az: '', min_months: 0, max_months: 12, sort_order: 0 }} />
          
        </TabsContent>

        <TabsContent value="providers" className="space-y-4">
          <ConfigTable
            tableName="provider_types"
            title={tr("admintoolsconfig_provayder_tipleri_7c816f", "Provayder Tipləri")}
            columns={[
            { key: 'type_key', label: 'Tip Kodu' },
            { key: 'label_az', label: tr("admintoolsconfig_azerbaycanca_bdc8df", "Azərbaycanca") },
            { key: 'emoji', label: 'Emoji' },
            { key: 'color', label: tr("admintoolsconfig_reng_8c6bc5", "Rəng"), type: 'color' },
            { key: 'sort_order', label: tr("admintoolsconfig_sira_421c5f", "Sıra"), type: 'number' }]
            }
            defaultValues={{ type_key: '', label_az: '', emoji: '🏥', color: '#3B82F6', sort_order: 0 }} />
          

          <ConfigTable
            tableName="day_labels"
            title={tr("admintoolsconfig_gun_adlari_a072a9", "Gün Adları")}
            columns={[
            { key: 'day_key', label: tr("admintoolsconfig_gun_kodu_287a99", "Gün Kodu") },
            { key: 'label_az', label: 'Tam Ad' },
            { key: 'short_label_az', label: tr("admintoolsconfig_qisa_ad_be64d8", "Qısa Ad") },
            { key: 'day_number', label: tr("admintoolsconfig_gun_nomresi_760508", "Gün Nömrəsi"), type: 'number' }]
            }
            defaultValues={{ day_key: '', label_az: '', short_label_az: '', day_number: 0 }} />
          
        </TabsContent>

        <TabsContent value="horoscope" className="space-y-4">
          <ConfigTable
            tableName="horoscope_elements"
            title={tr("admintoolsconfig_element_konfiqurasiyasi_ea794d", "Element Konfiqurasiyası")}
            columns={[
            { key: 'element_key', label: 'Element Kodu' },
            { key: 'name_az', label: tr("admintoolsconfig_azerbaycanca_bdc8df", "Azərbaycanca") },
            { key: 'icon', label: tr("admintoolsconfig_ikon_6e73fc", "İkon") },
            { key: 'color', label: tr("admintoolsconfig_reng_8c6bc5", "Rəng"), type: 'color' },
            { key: 'sort_order', label: tr("admintoolsconfig_sira_421c5f", "Sıra"), type: 'number' }]
            }
            defaultValues={{ element_key: '', name_az: '', icon: 'Sparkles', color: '#8B5CF6', sort_order: 0 }} />
          

          <ConfigTable
            tableName="horoscope_loading_steps"
            title={tr("admintoolsconfig_yuklenme_addimlari_bc82be", "Yüklənmə Addımları")}
            columns={[
            { key: 'step_key', label: tr("admintoolsconfig_addim_kodu_3667fd", "Addım Kodu") },
            { key: 'label_az', label: tr("admintoolsconfig_azerbaycanca_metn_d6c0c4", "Azərbaycanca Mətn") },
            { key: 'icon', label: tr("admintoolsconfig_ikon_6e73fc", "İkon") },
            { key: 'sort_order', label: tr("admintoolsconfig_sira_421c5f", "Sıra"), type: 'number' }]
            }
            defaultValues={{ step_key: '', label_az: '', icon: 'Star', sort_order: 0 }} />
          

          <ConfigTable
            tableName="time_options"
            title={tr("admintoolsconfig_vaxt_secimleri_065536", "Vaxt Seçimləri")}
            columns={[
            { key: 'option_key', label: tr("admintoolsconfig_secim_kodu_1c23ed", "Seçim Kodu") },
            { key: 'label_az', label: tr("admintoolsconfig_azerbaycanca_bdc8df", "Azərbaycanca") },
            { key: 'hour_value', label: tr("admintoolsconfig_saat_deyeri_e04f39", "Saat Dəyəri"), type: 'number' },
            { key: 'sort_order', label: tr("admintoolsconfig_sira_421c5f", "Sıra"), type: 'number' }]
            }
            defaultValues={{ option_key: '', label_az: '', hour_value: 12, sort_order: 0 }} />
          
        </TabsContent>

        <TabsContent value="weather" className="space-y-4">
          <ConfigTable
            tableName="temperature_emojis"
            title={tr("admintoolsconfig_temperatur_emojiler_68fd01", "Temperatur Emojilər")}
            columns={[
            { key: 'min_temp', label: 'Min °C', type: 'number' },
            { key: 'max_temp', label: 'Max °C', type: 'number' },
            { key: 'emoji', label: 'Emoji' },
            { key: 'label_az', label: tr("admintoolsconfig_azerbaycanca_bdc8df", "Azərbaycanca") },
            { key: 'clothing_tip_az', label: tr("admintoolsconfig_geyim_mesleheti_826efc", "Geyim Məsləhəti") },
            { key: 'sort_order', label: tr("admintoolsconfig_sira_421c5f", "Sıra"), type: 'number' }]
            }
            defaultValues={{ min_temp: 0, max_temp: 10, emoji: '🌡️', label_az: '', clothing_tip_az: '', sort_order: 0 }} />
          

          <ConfigTable
            tableName="exercise_daily_tips"
            title={tr("admintoolsconfig_mesq_gunluk_meslehetleri_280e12", "Məşq Günlük Məsləhətləri")}
            columns={[
            { key: 'tip_az', label: tr("admintoolsconfig_meslehet_az_9b4a39", "Məsləhət (AZ)") },
            { key: 'emoji', label: 'Emoji' },
            { key: 'sort_order', label: tr("admintoolsconfig_sira_421c5f", "Sıra"), type: 'number' }]
            }
            defaultValues={{ tip_az: '', emoji: '💡', sort_order: 0 }} />
          
        </TabsContent>
      </Tabs>
    </div>);

};

export default AdminToolsConfig;