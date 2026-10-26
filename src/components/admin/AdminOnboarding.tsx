import { useState } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import { Sparkles, Plus, Pencil, Trash2, Search, Baby } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  useAdminOnboardingStages,
  useAdminMultiplesOptions,
  OnboardingStage,
  MultiplesOption } from
'@/hooks/useAdminOnboarding';
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";

const AdminOnboarding = () => {
    const localize = useAdminLocalize();
  const stages = useAdminOnboardingStages();
  const multiples = useAdminMultiplesOptions();

  const [activeTab, setActiveTab] = useState('stages');
  const [showStageModal, setShowStageModal] = useState(false);
  const [showMultipleModal, setShowMultipleModal] = useState(false);
  const [editingStage, setEditingStage] = useState<OnboardingStage | null>(null);
  const [editingMultiple, setEditingMultiple] = useState<MultiplesOption | null>(null);
  const [stageFormData, setStageFormData] = useState<Partial<OnboardingStage>>({});
  const [multipleFormData, setMultipleFormData] = useState<Partial<MultiplesOption>>({});

  // Stage handlers
  const openCreateStageModal = () => {
    setEditingStage(null);
    setStageFormData({
      stage_id: '',
      title: '',
      title_az: '',
      subtitle: '',
      subtitle_az: '',
      description: '',
      description_az: '',
      emoji: '👶',
      icon_name: 'Baby',
      bg_gradient: 'from-purple-500 to-pink-600',
      sort_order: 0,
      is_active: true
    });
    setShowStageModal(true);
  };

  const openEditStageModal = (item: OnboardingStage) => {
    setEditingStage(item);
    setStageFormData({ ...item });
    setShowStageModal(true);
  };

  const handleSaveStage = async () => {
    try {
      if (editingStage) {
        await stages.update.mutateAsync({ id: editingStage.id, ...stageFormData });
      } else {
        await stages.create.mutateAsync(stageFormData);
      }
      setShowStageModal(false);
    } catch {
      // Xəta artıq useAdminOnboarding.ts-in onError-u ilə göstərilib.
    }
  };

  const handleDeleteStage = async (id: string) => {
    if (!confirm(tr("adminonboarding_silmek_istediyinize_eminsiniz_09658f", "Silm\u0259k ist\u0259diyiniz\u0259 \u0259minsiniz?"))) return;
    try {
      await stages.remove.mutateAsync(id);
    } catch {
      // Xəta artıq onError ilə göstərilib.
    }
  };

  // Multiple handlers
  const openCreateMultipleModal = () => {
    setEditingMultiple(null);
    setMultipleFormData({
      option_id: '',
      label: '',
      label_az: '',
      emoji: '👶',
      baby_count: 1,
      sort_order: 0,
      is_active: true
    });
    setShowMultipleModal(true);
  };

  const openEditMultipleModal = (item: MultiplesOption) => {
    setEditingMultiple(item);
    setMultipleFormData({ ...item });
    setShowMultipleModal(true);
  };

  const handleSaveMultiple = async () => {
    try {
      if (editingMultiple) {
        await multiples.update.mutateAsync({ id: editingMultiple.id, ...multipleFormData });
      } else {
        await multiples.create.mutateAsync(multipleFormData);
      }
      setShowMultipleModal(false);
    } catch {
      // Xəta artıq onError ilə göstərilib.
    }
  };

  const handleDeleteMultiple = async (id: string) => {
    if (!confirm(tr("adminonboarding_silmek_istediyinize_eminsiniz_09658f", "Silm\u0259k ist\u0259diyiniz\u0259 \u0259minsiniz?"))) return;
    try {
      await multiples.remove.mutateAsync(id);
    } catch {
      // Xəta artıq onError ilə göstərilib.
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{tr("adminonboarding_qeydiyyat_merheleleri_5979e2", "Qeydiyyat Mərhələləri")}</h1>
          <p className="text-muted-foreground">{tr("adminonboarding_onboarding_secimlerini_idare_edin_48ee89", "Onboarding seçimlərini idarə edin")}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stages.data?.length || 0}</p>
              <p className="text-xs text-muted-foreground">{tr("adminonboarding_merheleler_5eb66e", "Mərhələlər")}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Baby className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{multiples.data?.length || 0}</p>
              <p className="text-xs text-muted-foreground">{tr("adminonboarding_coxluq_secimleri_53cde3", "Çoxluq Seçimləri")}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Sparkles className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stages.data?.filter((s) => s.is_active).length || 0}</p>
              <p className="text-xs text-muted-foreground">{tr("adminonboarding_aktiv_merhele_f4c424", "Aktiv Mərhələ")}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Baby className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{multiples.data?.filter((m) => m.is_active).length || 0}</p>
              <p className="text-xs text-muted-foreground">{tr("adminonboarding_aktiv_coxluq_564cca", "Aktiv Çoxluq")}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="stages">{tr("adminonboarding_heyat_merheleleri_c9d7f6", "Həyat Mərhələləri")}</TabsTrigger>
          <TabsTrigger value="multiples">{tr("adminonboarding_coxluq_secimleri_53cde3", "Çoxluq Seçimləri")}</TabsTrigger>
        </TabsList>

        <TabsContent value="stages" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreateStageModal} className="gap-2">
              <Plus className="w-4 h-4" />
              {tr("adminonboarding_yeni_merhele_bd7533", "Yeni M\u0259rh\u0259l\u0259")}
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{tr("adminonboarding_heyat_merheleleri_0bdd4c", "H\u0259yat M\u0259rh\u0259l\u0259l\u0259ri (")}{stages.data?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {stages.isLoading ?
              <div className="text-center py-8 text-muted-foreground">{tr("adminonboarding_yuklenir_5557de", "Yüklənir...")}</div> :
              (stages.data?.length || 0) === 0 ?
              <div className="text-center py-8 text-muted-foreground">{tr("adminonboarding_merhele_tapilmadi_32ebcd", "Mərhələ tapılmadı")}</div> :

              <div className="space-y-3">
                  {stages.data?.map((stage, index) =>
                <motion.div
                  key={stage.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                  
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stage.bg_gradient} flex items-center justify-center text-2xl text-white`}>
                          {stage.emoji}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">{localize(stage, 'title')}</p>
                            <Badge variant={stage.is_active ? 'default' : 'secondary'}>
                              {stage.is_active ? 'Aktiv' : 'Gizli'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{localize(stage, 'subtitle')}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline">{stage.stage_id}</Badge>
                            <span className="text-xs text-muted-foreground">{tr("adminonboarding_sira_d654d0", "S\u0131ra:")} {stage.sort_order}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditStageModal(stage)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteStage(stage.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </motion.div>
                )}
                </div>
              }
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="multiples" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreateMultipleModal} className="gap-2">
              <Plus className="w-4 h-4" />
              {tr("adminonboarding_yeni_secim_b1b8e4", "Yeni Se\xE7im")}
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{tr("adminonboarding_coxluq_secimleri_c95869", "\xC7oxluq Se\xE7iml\u0259ri (")}{multiples.data?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {multiples.isLoading ?
              <div className="text-center py-8 text-muted-foreground">{tr("adminonboarding_yuklenir_5557de", "Yüklənir...")}</div> :
              (multiples.data?.length || 0) === 0 ?
              <div className="text-center py-8 text-muted-foreground">{tr("adminonboarding_secim_tapilmadi_f906d4", "Seçim tapılmadı")}</div> :

              <div className="space-y-3">
                  {multiples.data?.map((option, index) =>
                <motion.div
                  key={option.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                  
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl">
                          {option.emoji}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">{localize(option, 'label')}</p>
                            <Badge variant={option.is_active ? 'default' : 'secondary'}>
                              {option.is_active ? 'Aktiv' : 'Gizli'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline">{option.baby_count} {tr("adminonboarding_usaq_36b348", "u\u015Faq")}</Badge>
                            <span className="text-xs text-muted-foreground">{tr("adminonboarding_sira_d654d0", "S\u0131ra:")} {option.sort_order}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditMultipleModal(option)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteMultiple(option.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </motion.div>
                )}
                </div>
              }
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Stage Modal */}
      <Dialog open={showStageModal} onOpenChange={setShowStageModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingStage ? tr("adminonboarding_merhele_redakte_et_79bfa4", "M\u0259rh\u0259l\u0259 Redakt\u0259 Et") : tr("adminonboarding_yeni_merhele_bd7533", "Yeni M\u0259rh\u0259l\u0259")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Stage ID (flow, bump, mommy)"
                value={stageFormData.stage_id || ''}
                onChange={(e) => setStageFormData({ ...stageFormData, stage_id: e.target.value })} />
              
              <Input
                placeholder="Emoji"
                value={stageFormData.emoji || ''}
                onChange={(e) => setStageFormData({ ...stageFormData, emoji: e.target.value })} />
              
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder={tr("adminonboarding_basliq_en_4ac905", "Başlıq (EN)")}
                value={stageFormData.title || ''}
                onChange={(e) => setStageFormData({ ...stageFormData, title: e.target.value })} />
              
              <LocalizedInput formData={stageFormData} setFormData={setStageFormData} field="title" label="Başlıq" />
              
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder={tr("adminonboarding_alt_basliq_en_bb08aa", "Alt başlıq (EN)")}
                value={stageFormData.subtitle || ''}
                onChange={(e) => setStageFormData({ ...stageFormData, subtitle: e.target.value })} />
              
              <LocalizedInput formData={stageFormData} setFormData={setStageFormData} field="subtitle" label="Alt başlıq" />
              
            </div>
            <LocalizedTextarea formData={stageFormData} setFormData={setStageFormData} field="description" label="Təsvir" />
            
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder={tr("adminonboarding_ikon_adi_baby_heart_calendar_e2a7df", "İkon adı (Baby, Heart, Calendar)")}
                value={stageFormData.icon_name || ''}
                onChange={(e) => setStageFormData({ ...stageFormData, icon_name: e.target.value })} />
              
              <Input
                placeholder="Gradient (from-purple-500 to-pink-600)"
                value={stageFormData.bg_gradient || ''}
                onChange={(e) => setStageFormData({ ...stageFormData, bg_gradient: e.target.value })} />
              
            </div>
            <Input
              type="number"
              placeholder={tr("adminonboarding_sira_421c5f", "Sıra")}
              value={stageFormData.sort_order || 0}
              onChange={(e) => setStageFormData({ ...stageFormData, sort_order: parseInt(e.target.value) })} />
            
            <div className="flex items-center gap-2">
              <Switch
                checked={stageFormData.is_active ?? true}
                onCheckedChange={(v) => setStageFormData({ ...stageFormData, is_active: v })} />
              
              <span className="text-sm">Aktiv</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStageModal(false)}>
              {tr("adminonboarding_legv_et_b5e49c", "L\u0259\u011Fv et")}
            </Button>
            <Button onClick={handleSaveStage} disabled={stages.create.isPending || stages.update.isPending}>
              {editingStage ? tr("adminonboarding_yenile_570ce2", "Yenil\u0259") : tr("adminonboarding_elave_et_6e1b9b", "\u018Flav\u0259 et")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Multiple Modal */}
      <Dialog open={showMultipleModal} onOpenChange={setShowMultipleModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingMultiple ? tr("adminonboarding_secim_redakte_et_01ab36", "Se\xE7im Redakt\u0259 Et") : tr("adminonboarding_yeni_secim_b1b8e4", "Yeni Se\xE7im")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Option ID (single, twins)"
                value={multipleFormData.option_id || ''}
                onChange={(e) => setMultipleFormData({ ...multipleFormData, option_id: e.target.value })} />
              
              <Input
                placeholder="Emoji"
                value={multipleFormData.emoji || ''}
                onChange={(e) => setMultipleFormData({ ...multipleFormData, emoji: e.target.value })} />
              
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Label (EN)"
                value={multipleFormData.label || ''}
                onChange={(e) => setMultipleFormData({ ...multipleFormData, label: e.target.value })} />
              
              <LocalizedInput formData={multipleFormData} setFormData={setMultipleFormData} field="label" label="Label" />
              
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                placeholder={tr("adminonboarding_usaq_sayi_04c015", "Uşaq sayı")}
                value={multipleFormData.baby_count || 1}
                onChange={(e) => setMultipleFormData({ ...multipleFormData, baby_count: parseInt(e.target.value) })} />
              
              <Input
                type="number"
                placeholder={tr("adminonboarding_sira_421c5f", "Sıra")}
                value={multipleFormData.sort_order || 0}
                onChange={(e) => setMultipleFormData({ ...multipleFormData, sort_order: parseInt(e.target.value) })} />
              
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={multipleFormData.is_active ?? true}
                onCheckedChange={(v) => setMultipleFormData({ ...multipleFormData, is_active: v })} />
              
              <span className="text-sm">Aktiv</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMultipleModal(false)}>
              {tr("adminonboarding_legv_et_b5e49c", "L\u0259\u011Fv et")}
            </Button>
            <Button onClick={handleSaveMultiple} disabled={multiples.create.isPending || multiples.update.isPending}>
              {editingMultiple ? tr("adminonboarding_yenile_570ce2", "Yenil\u0259") : tr("adminonboarding_elave_et_6e1b9b", "\u018Flav\u0259 et")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);

};

export default AdminOnboarding;