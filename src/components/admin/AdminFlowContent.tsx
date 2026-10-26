import { useState, useEffect } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import {
  Heart, Lightbulb, MessageSquare, Plus, Pencil, Trash2, Search,
  Droplets, Tag, Save } from
'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LocalizedInput } from './ui/LocalizedInput';
import { LocalizedTextarea } from './ui/LocalizedTextarea';
import { useAdminLocalize } from '@/contexts/AdminLanguageContext';

type ContentType = 'symptoms' | 'tips' | 'insights' | 'labels';

const PHASES = [
{ id: 'menstrual', label: 'Menstruasiya', emoji: '🌸' },
{ id: 'follicular', label: 'Follikulyar', emoji: '🌱' },
{ id: 'ovulation', label: 'Ovulyasiya', emoji: '✨' },
{ id: 'luteal', label: 'Luteal', emoji: '🌙' }];


const AdminFlowContent = () => {
  const [activeTab, setActiveTab] = useState<ContentType>('symptoms');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const localize = useAdminLocalize();

  // Fetch symptoms
  const symptomsQuery = useQuery({
    queryKey: ['flow-symptoms-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('flow_symptoms_db').
      select('*').
      order('sort_order');
      if (error) throw error;
      return data;
    }
  });

  // Fetch tips (phase tips from menstruation_phase_tips)
  const tipsQuery = useQuery({
    queryKey: ['flow-tips-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('menstruation_phase_tips').
      select('*').
      order('sort_order');
      if (error) throw error;
      return data;
    }
  });

  // Fetch insights
  const insightsQuery = useQuery({
    queryKey: ['flow-insights-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('flow_insights').
      select('*').
      order('sort_order');
      if (error) throw error;
      return data;
    }
  });

  // Flow upcoming labels state
  const [flowLabels, setFlowLabels] = useState({
    flow_label_next_period: tr("adminflowcontent_novbeti_period_b29c4a", "N\xF6vb\u0259ti Period"),
    flow_label_fertile_window: tr("adminflowcontent_reproduktiv_dovr_80642c", "Reproduktiv D\xF6vr"),
    flow_label_ovulation_day: tr("adminflowcontent_ovulyasiya_gunu_811e84", "Ovulyasiya G\xFCn\xFC")
  });
  const [labelsLoading, setLabelsLoading] = useState(false);

  const labelsQuery = useQuery({
    queryKey: ['flow-labels-admin'],
    queryFn: async () => {
      const { data } = await supabase.
      from('app_settings').
      select('key, value').
      in('key', ['flow_label_next_period', 'flow_label_fertile_window', 'flow_label_ovulation_day']);
      return data || [];
    }
  });

  useEffect(() => {
    if (labelsQuery.data) {
      const labels: any = { ...flowLabels };
      labelsQuery.data.forEach((item: any) => {
        const val = typeof item.value === 'string' ? item.value : JSON.stringify(item.value);
        labels[item.key] = val.replace(/^"|"$/g, '');
      });
      setFlowLabels(labels);
    }
  }, [labelsQuery.data]);

  const saveLabels = async () => {
    setLabelsLoading(true);
    try {
      for (const [key, value] of Object.entries(flowLabels)) {
        const { error } = await supabase.
        from('app_settings').
        update({ value: JSON.stringify(value) }).
        eq('key', key);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ['flow-upcoming-labels'] });
      toast({ title: tr("adminflowcontent_basliqlar_saxlanildi_a9004c", "Başlıqlar saxlanıldı ✅") });
    } catch {
      toast({ title: tr("adminflowcontent_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    }
    setLabelsLoading(false);
  };

  const tabs = [
  { id: 'symptoms', label: 'Simptomlar', icon: Heart, count: symptomsQuery.data?.length || 0 },
  { id: 'tips', label: tr("adminflowcontent_faza_tovsiyeleri_5a303a", "Faza Tövsiyələri"), icon: Lightbulb, count: tipsQuery.data?.length || 0 },
  { id: 'insights', label: tr("adminflowcontent_meslehetler_fafd97", "Məsləhətlər"), icon: MessageSquare, count: insightsQuery.data?.length || 0 },
  { id: 'labels', label: tr("adminflowcontent_basliqlar_b19a1f", "Başlıqlar"), icon: Tag, count: 3 }];


  const getCurrentData = () => {
    switch (activeTab) {
      case 'symptoms':return symptomsQuery.data || [];
      case 'tips':return tipsQuery.data || [];
      case 'insights':return insightsQuery.data || [];
      default:return [];
    }
  };

  const getTableName = () => {
    switch (activeTab) {
      case 'symptoms':return 'flow_symptoms_db';
      case 'tips':return 'menstruation_phase_tips';
      case 'insights':return 'flow_insights';
      default:return 'flow_symptoms_db';
    }
  };

  const getQueryKey = () => {
    switch (activeTab) {
      case 'symptoms':return 'flow-symptoms-admin';
      case 'tips':return 'flow-tips-admin';
      case 'insights':return 'flow-insights-admin';
      default:return 'flow-symptoms-admin';
    }
  };

  const getDefaultFormData = () => {
    switch (activeTab) {
      case 'symptoms':
        return { symptom_key: '', label: '', label_az: '', label_en: '', emoji: '🤕', category: 'physical', color: '#F97316', is_active: true, sort_order: 0 };
      case 'tips':
        return { phase: 'menstrual', category: 'nutrition', title: '', title_az: '', title_en: '', content: '', content_az: '', content_en: '', emoji: '💡', is_active: true, sort_order: 0 };
      case 'insights':
        return { title: '', title_az: '', title_en: '', content: '', content_az: '', content_en: '', phase: null, emoji: '💡', category: 'general', is_active: true, sort_order: 0 };
      default:
        return {};
    }
  };

  // NOT: formData sahələri (title/label, title_en/label_en) başlanğıcda
  // literal boş sətir ('') olaraq set olunur. `mapRowTranslation` (`??`
  // istifadə edir, boş sətri "yoxdur" saymır) buna görə admin YALNIZ
  // title_az doldurub yadda saxlayanda, EN/RU/TR/... oxucular üçün
  // `title_en ?? title ?? title_az` zənciri `'' ?? '' ?? 'Azərbaycan mətni'`
  // olur - `''` NULL olmadığı üçün nəticə BOŞ SƏTIR olur, əsl Azərbaycan
  // mətninə heç vaxt çatmır. Göndərmədən əvvəl boş sətirləri null-a çeviririk
  // ki, `??` zənciri düzgün fallback edə bilsin.
  const normalizeEmptyStrings = (item: Record<string, any>) => {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(item)) {
      result[key] = value === '' ? null : value;
    }
    return result;
  };

  const createMutation = useMutation({
    mutationFn: async (item: any) => {
      const { error } = await supabase.from(getTableName() as any).insert([normalizeEmptyStrings(item)]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [getQueryKey()] });
      queryClient.invalidateQueries({ queryKey: ['flow-symptoms'] });
      queryClient.invalidateQueries({ queryKey: ['flow-phase-tips'] });
      queryClient.invalidateQueries({ queryKey: ['flow-insights'] });
      toast({ title: tr("adminflowcontent_elave_edildi_b7d7e4", "Əlavə edildi") });
      setShowModal(false);
    },
    onError: () => {
      toast({ title: tr("adminflowcontent_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...item }: any) => {
      const { error } = await supabase.from(getTableName() as any).update(normalizeEmptyStrings(item)).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [getQueryKey()] });
      queryClient.invalidateQueries({ queryKey: ['flow-symptoms'] });
      queryClient.invalidateQueries({ queryKey: ['flow-phase-tips'] });
      queryClient.invalidateQueries({ queryKey: ['flow-insights'] });
      toast({ title: tr("adminflowcontent_yenilendi_d10a01", "Yeniləndi") });
      setShowModal(false);
    },
    onError: () => {
      toast({ title: tr("adminflowcontent_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(getTableName() as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [getQueryKey()] });
      queryClient.invalidateQueries({ queryKey: ['flow-symptoms'] });
      queryClient.invalidateQueries({ queryKey: ['flow-phase-tips'] });
      queryClient.invalidateQueries({ queryKey: ['flow-insights'] });
      toast({ title: 'Silindi' });
    },
    onError: () => {
      toast({ title: tr("adminflowcontent_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    }
  });

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData(getDefaultFormData());
    setShowModal(true);
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setFormData({ ...item });
    setShowModal(true);
  };

  const handleSave = () => {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredData = getCurrentData().filter((item: any) => {
    const searchLower = search.toLowerCase();
    if (activeTab === 'symptoms') {
      return item.label?.toLowerCase().includes(searchLower) || item.label_az?.toLowerCase().includes(searchLower);
    }
    if (activeTab === 'tips') {
      return item.title?.toLowerCase().includes(searchLower) || item.title_az?.toLowerCase().includes(searchLower);
    }
    return item.title?.toLowerCase().includes(searchLower) || item.title_az?.toLowerCase().includes(searchLower);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Droplets className="w-6 h-6 text-flow" />
            {tr("adminflowcontent_menstruasiya_mezmunu_bf5904", "Menstruasiya M\u0259zmunu")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {tr("adminflowcontent_flow_dashboard_da_gosterilen_s_a48913", "Flow Dashboard-da g\xF6st\u0259ril\u0259n simptomlar, t\xF6vsiy\u0259l\u0259r v\u0259 m\u0259sl\u0259h\u0259tl\u0259ri idar\u0259 edin")}
          </p>
        </div>
        {activeTab !== 'labels' &&
        <Button onClick={openCreateModal} className="gradient-primary gap-2">
            <Plus className="w-4 h-4" />
            {tr("adminflowcontent_elave_et_6e1b9b", "\u018Flav\u0259 et")}
          </Button>
        }
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ContentType)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all ${
              activeTab === tab.id ?
              'bg-flow text-white' :
              'bg-muted text-muted-foreground hover:bg-muted/80'}`
              }>
              
              <Icon className="w-4 h-4" />
              {tab.label}
              <Badge variant="secondary" className="ms-1">{tab.count}</Badge>
            </button>);

        })}
      </div>

      {activeTab === 'labels' ?
      <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              {tr("adminflowcontent_qarsidan_gelenler_basliqlari_6f943e", "Qar\u015F\u0131dan G\u0259l\u0259nl\u0259r Ba\u015Fl\u0131qlar\u0131")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">{tr("adminflowcontent_period_basligi_6a6736", "🩸 Period başlığı")}</label>
              <Input
              value={flowLabels.flow_label_next_period}
              onChange={(e) => setFlowLabels({ ...flowLabels, flow_label_next_period: e.target.value })}
              placeholder={tr("adminflowcontent_novbeti_period_b29c4a", "Növbəti Period")} />
            
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">{tr("adminflowcontent_reproduktiv_dovr_basligi_836250", "💕 Reproduktiv dövr başlığı")}</label>
              <Input
              value={flowLabels.flow_label_fertile_window}
              onChange={(e) => setFlowLabels({ ...flowLabels, flow_label_fertile_window: e.target.value })}
              placeholder={tr("adminflowcontent_reproduktiv_dovr_80642c", "Reproduktiv Dövr")} />
            
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">{tr("adminflowcontent_ovulyasiya_basligi_0264bd", "✨ Ovulyasiya başlığı")}</label>
              <Input
              value={flowLabels.flow_label_ovulation_day}
              onChange={(e) => setFlowLabels({ ...flowLabels, flow_label_ovulation_day: e.target.value })}
              placeholder={tr("adminflowcontent_ovulyasiya_gunu_811e84", "Ovulyasiya Günü")} />
            
            </div>
            <Button onClick={saveLabels} disabled={labelsLoading} className="gap-2">
              <Save className="w-4 h-4" />
              {labelsLoading ? tr("adminflowcontent_saxlanilir_ee05ad", "Saxlan\u0131l\u0131r...") : 'Saxla'}
            </Button>
          </CardContent>
        </Card> :

      <>
      {/* Search */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
            placeholder="Axtar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-10" />
          
      </div>

      {/* Content Grid */}
      <div className="grid gap-3">
        {filteredData.map((item: any) =>
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl p-4 border border-border/50 flex items-center justify-between">
            
            <div className="flex items-center gap-3">
              <span className="text-2xl">{item.emoji}</span>
              <div>
                <p className="font-medium text-foreground">
                  {activeTab === 'symptoms' && localize(item, 'label')}
                  {activeTab === 'tips' && localize(item, 'title')}
                  {activeTab === 'insights' && localize(item, 'title')}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {item.phase &&
                  <Badge variant="outline" className="text-xs">
                      {PHASES.find((p) => p.id === item.phase)?.label || item.phase}
                    </Badge>
                  }
                  <Badge variant={item.is_active ? 'default' : 'secondary'} className="text-xs">
                    {item.is_active ? 'Aktiv' : 'Deaktiv'}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => openEditModal(item)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(item.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </motion.div>
          )}

        {filteredData.length === 0 &&
          <div className="text-center py-12 text-muted-foreground">
            {tr("adminflowcontent_hec_bir_mezmun_tapilmadi_a7be84", "He\xE7 bir m\u0259zmun tap\u0131lmad\u0131")}
          </div>
          }
      </div>

      {/* Edit/Create Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? tr("adminflowcontent_redakte_et_66cf3b", "Redakt\u0259 et") : tr("adminflowcontent_yeni_elave_et_bcd4a4", "Yeni \u0259lav\u0259 et")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {activeTab === 'symptoms' &&
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Simptom Key</label>
                    <Input
                      value={formData.symptom_key || ''}
                      onChange={(e) => setFormData({ ...formData, symptom_key: e.target.value })}
                      placeholder="headache" />
                    
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Emoji</label>
                    <Input
                      value={formData.emoji || ''}
                      onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                      placeholder="🤕" />
                    
                  </div>
                </div>
                <LocalizedInput
                  formData={formData}
                  setFormData={setFormData}
                  field="label"
                  label="Simptom Adı"
                />
                <div className="space-y-2">
                  <label className="text-sm font-medium">{tr("adminflowcontent_reng_8c6bc5", "Rəng")}</label>
                  <Input
                    type="color"
                    value={formData.color || '#F97316'}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })} />
                  
                </div>
              </>
              }

            {activeTab === 'tips' &&
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Faza</label>
                    <Select
                      value={formData.phase || ''}
                      onValueChange={(value) => setFormData({ ...formData, phase: value })}>
                      
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PHASES.map((phase) =>
                        <SelectItem key={phase.id} value={phase.id}>
                            {phase.emoji} {phase.label}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Emoji</label>
                    <Input
                      value={formData.emoji || ''}
                      onChange={(e) => setFormData({ ...formData, emoji: e.target.value })} />
                    
                  </div>
                </div>
                <LocalizedInput
                  formData={formData}
                  setFormData={setFormData}
                  field="title"
                  label="Başlıq"
                />
                <LocalizedTextarea
                  formData={formData}
                  setFormData={setFormData}
                  field="content"
                  label="Məzmun"
                  rows={3}
                />
              </>
              }

            {activeTab === 'insights' &&
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Faza (optional)</label>
                    <Select
                      value={formData.phase || 'all'}
                      onValueChange={(value) => setFormData({ ...formData, phase: value === 'all' ? null : value })}>
                      
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{tr("adminflowcontent_hamisi_c73c4d", "Hamısı")}</SelectItem>
                        {PHASES.map((phase) =>
                        <SelectItem key={phase.id} value={phase.id}>
                            {phase.emoji} {phase.label}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Emoji</label>
                    <Input
                      value={formData.emoji || ''}
                      onChange={(e) => setFormData({ ...formData, emoji: e.target.value })} />
                    
                  </div>
                </div>
                <LocalizedInput
                  formData={formData}
                  setFormData={setFormData}
                  field="title"
                  label="Başlıq"
                />
                <LocalizedTextarea
                  formData={formData}
                  setFormData={setFormData}
                  field="content"
                  label="Məzmun"
                  rows={3}
                />
              </>
              }

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{tr("adminflowcontent_sira_421c5f", "Sıra")}</label>
                <Input
                    type="number"
                    value={formData.sort_order || 0}
                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })} />
                  
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <label className="text-sm font-medium">Aktiv</label>
                <Switch
                    checked={formData.is_active ?? true}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
                  
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              {tr("adminflowcontent_legv_et_b5e49c", "L\u0259\u011Fv et")}
            </Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingItem ? 'Saxla' : tr("adminflowcontent_elave_et_6e1b9b", "\u018Flav\u0259 et")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
      }
    </div>);

};

export default AdminFlowContent;