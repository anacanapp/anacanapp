import { useState, useRef } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import { Plus, Edit2, Trash2, Calculator, Save, X, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAdminMaternityBenefits, MaternityConfigItem, MaternityGuideline } from '@/hooks/useMaternityBenefits';
import UnsavedChangesDialog from './UnsavedChangesDialog';
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";

const AdminMaternityBenefits = () => {
    const localize = useAdminLocalize();
  const { configItems, guidelines, loading, updateConfigValue, createGuideline, updateGuideline, deleteGuideline } = useAdminMaternityBenefits();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('config');

  // Config editing
  const [editingConfig, setEditingConfig] = useState<MaternityConfigItem | null>(null);
  const [configValue, setConfigValue] = useState('');

  // Guideline modal
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [editingGuide, setEditingGuide] = useState<MaternityGuideline | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const initialFormDataRef = useRef<string>('');

  const [guideForm, setGuideForm] = useState({
    title: '',
    title_az: '',
    content: '',
    content_az: '',
    category: 'general',
    icon: '📋',
    sort_order: 0,
    is_active: true
  });

  const hasUnsavedChanges = () => {
    if (!showGuideModal) return false;
    return JSON.stringify(guideForm) !== initialFormDataRef.current;
  };

  const handleGuideModalClose = () => {
    if (hasUnsavedChanges()) {
      setShowUnsavedDialog(true);
    } else {
      closeGuideModal();
    }
  };

  const closeGuideModal = () => {
    setShowGuideModal(false);
    setEditingGuide(null);
    setGuideForm({
      title: '',
      title_az: '',
      content: '',
      content_az: '',
      category: 'general',
      icon: '📋',
      sort_order: 0,
      is_active: true
    });
  };

  const openGuideModal = (guide?: MaternityGuideline) => {
    // NOT: bütün sətir (...guide) spread olunur ki, mövcud title_en/ru/tr və
    // content_en/ru/tr dəyərləri admin dili dəyişdirildikdə boş görünməsin -
    // əvvəllər yalnız title_az/content_az bərpa olunurdu, real tərcümələr
    // gizli qalırdı və admin "boş" görünən sahəyə yazanda əslində mövcud
    // tərcümənin üzərinə yazılırdı.
    const data = guide ? {
      ...guide,
      title: guide.title,
      title_az: guide.title_az || '',
      content: guide.content,
      content_az: guide.content_az || '',
      category: guide.category,
      icon: guide.icon,
      sort_order: guide.sort_order,
      is_active: guide.is_active
    } : {
      title: '',
      title_az: '',
      content: '',
      content_az: '',
      category: 'general',
      icon: '📋',
      sort_order: guidelines.length,
      is_active: true
    };
    setGuideForm(data);
    initialFormDataRef.current = JSON.stringify(data);
    setEditingGuide(guide || null);
    setShowGuideModal(true);
  };

  const handleSaveConfig = async () => {
    if (!editingConfig) return;
    const value = parseFloat(configValue);
    if (isNaN(value)) {
      toast({ title: tr("adminmaternitybenefits_duzgun_reqem_daxil_edin_b92de2", "Düzgün rəqəm daxil edin"), variant: 'destructive' });
      return;
    }

    const result = await updateConfigValue(editingConfig.id, value);
    if (result.error) {
      toast({ title: tr("adminmaternitybenefits_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    } else {
      toast({ title: tr("adminmaternitybenefits_yenilendi_d10a01", "Yeniləndi") });
      setEditingConfig(null);
    }
  };

  const handleSaveGuide = async () => {
    if (!guideForm.title.trim() || !guideForm.content.trim()) {
      toast({ title: tr("adminmaternitybenefits_basliq_ve_mezmun_daxil_edin_d2ab00", "Başlıq və məzmun daxil edin"), variant: 'destructive' });
      return;
    }

    let result;
    if (editingGuide) {
      result = await updateGuideline(editingGuide.id, guideForm);
    } else {
      result = await createGuideline(guideForm);
    }

    if (result.error) {
      toast({ title: tr("adminmaternitybenefits_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    } else {
      toast({ title: editingGuide ? tr("adminmaternitybenefits_yenilendi_d10a01", "Yenil\u0259ndi") : tr("adminmaternitybenefits_elave_edildi_b7d7e4", "\u018Flav\u0259 edildi") });
      closeGuideModal();
    }
  };

  const handleDeleteGuide = async (id: string) => {
    if (!confirm(tr("adminmaternitybenefits_silmek_istediyinize_eminsiniz_09658f", "Silm\u0259k ist\u0259diyiniz\u0259 \u0259minsiniz?"))) return;
    const result = await deleteGuideline(id);
    if (result.error) {
      toast({ title: tr("adminmaternitybenefits_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    } else {
      toast({ title: 'Silindi' });
    }
  };

  if (loading) {
    return <div className="p-6 text-center">{tr("adminmaternitybenefits_yuklenir_5557de", "Yüklənir...")}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Calculator className="w-6 h-6 text-emerald-500" />
          Dekret Kalkulyatoru
        </h2>
        <p className="text-muted-foreground">
          {tr("adminmaternitybenefits_dekret_odenisi_konfiqurasiyasi_b3b5af", "Dekret \xF6d\u0259ni\u015Fi konfiqurasiyas\u0131 v\u0259 b\u0259l\u0259d\xE7il\u0259r")}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="config">Konfiqurasiya</TabsTrigger>
          <TabsTrigger value="guidelines">{tr("adminmaternitybenefits_beledciler_38051c", "Bələdçilər")}</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <div className="bg-muted/50 rounded-xl p-4 mb-4">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Settings className="w-4 h-4" />
              {tr("adminmaternitybenefits_bu_deyerler_azerbaycan_qanunve_96a197", "Bu d\u0259y\u0259rl\u0259r Az\u0259rbaycan qanunvericiliyin\u0259 \u0259sas\u0259n t\u0259nziml\u0259nir")}
            </p>
          </div>

          <div className="grid gap-3">
            {configItems.map((item) =>
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between p-4 bg-card rounded-xl border">
              
                <div className="flex-1">
                  <p className="font-medium">{localize(item, 'label')}</p>
                  <p className="text-sm text-muted-foreground">{localize(item, 'description')}</p>
                </div>
                
                {editingConfig?.id === item.id ?
              <div className="flex items-center gap-2">
                    <Input
                  type="number"
                  value={configValue}
                  onChange={(e) => setConfigValue(e.target.value)}
                  className="w-32" />
                
                    <Button size="sm" onClick={handleSaveConfig}>
                      <Save className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingConfig(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div> :

              <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-primary">{item.value}</span>
                    <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditingConfig(item);
                    setConfigValue(item.value.toString());
                  }}>
                  
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>
              }
              </motion.div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="guidelines" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openGuideModal()}>
              <Plus className="w-4 h-4 me-2" />
              {tr("adminmaternitybenefits_yeni_beledci_1e4796", "Yeni B\u0259l\u0259d\xE7i")}
            </Button>
          </div>

          <div className="grid gap-3">
            {guidelines.map((guide) =>
            <motion.div
              key={guide.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between p-4 bg-card rounded-xl border">
              
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{guide.icon}</span>
                  <div>
                    <p className="font-medium">{localize(guide, 'title')}</p>
                    <p className="text-sm text-muted-foreground">
                      Kateqoriya: {guide.category} {tr("adminmaternitybenefits_sira_b8830f", "| S\u0131ra:")} {guide.sort_order}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => openGuideModal(guide)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteGuide(guide.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Guideline Modal */}
      <Dialog open={showGuideModal} onOpenChange={handleGuideModalClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingGuide ? tr("adminmaternitybenefits_beledcini_redakte_et_41582d", "B\u0259l\u0259d\xE7ini Redakt\u0259 Et") : tr("adminmaternitybenefits_yeni_beledci_1e4796", "Yeni B\u0259l\u0259d\xE7i")}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              <div>
                <Label>{tr("adminmaternitybenefits_ikon_6e73fc", "İkon")}</Label>
                <Input
                  value={guideForm.icon}
                  onChange={(e) => setGuideForm({ ...guideForm, icon: e.target.value })}
                  className="text-center text-xl" />
                
              </div>
              <div className="col-span-3">
                <Label>{tr("adminmaternitybenefits_basliq_en_4ac905", "Başlıq (EN)")}</Label>
                <Input
                  value={guideForm.title}
                  onChange={(e) => setGuideForm({ ...guideForm, title: e.target.value })} />
                
              </div>
            </div>

            <div>
              <Label>{tr("adminmaternitybenefits_basliq_az_3e294a", "Başlıq (AZ)")}</Label>
              <LocalizedInput formData={guideForm} setFormData={setGuideForm} field="title" label="Title" />
              
            </div>

            <div>
              <Label>{tr("adminmaternitybenefits_mezmun_en_7541aa", "Məzmun (EN)")}</Label>
              <Textarea
                value={guideForm.content}
                onChange={(e) => setGuideForm({ ...guideForm, content: e.target.value })}
                rows={4} />
              
            </div>

            <div>
              <Label>{tr("adminmaternitybenefits_mezmun_az_markdown_desteklenir_769038", "Məzmun (AZ) - Markdown dəstəklənir")}</Label>
              <LocalizedTextarea formData={guideForm} setFormData={setGuideForm} field="content" label="Content" rows={6} />
              
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Kateqoriya</Label>
                <Input
                  value={guideForm.category}
                  onChange={(e) => setGuideForm({ ...guideForm, category: e.target.value })} />
                
              </div>
              <div>
                <Label>{tr("adminmaternitybenefits_sira_421c5f", "Sıra")}</Label>
                <Input
                  type="number"
                  value={guideForm.sort_order}
                  onChange={(e) => setGuideForm({ ...guideForm, sort_order: parseInt(e.target.value) || 0 })} />
                
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Aktiv</Label>
              <Switch
                checked={guideForm.is_active}
                onCheckedChange={(v) => setGuideForm({ ...guideForm, is_active: v })} />
              
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1" onClick={handleGuideModalClose}>
                <X className="w-4 h-4 me-2" />
                {tr("adminmaternitybenefits_legv_et_b5e49c", "L\u0259\u011Fv et")}
              </Button>
              <Button className="flex-1" onClick={handleSaveGuide}>
                <Save className="w-4 h-4 me-2" />
                Saxla
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onDiscard={closeGuideModal} />
      
    </div>);

};

export default AdminMaternityBenefits;