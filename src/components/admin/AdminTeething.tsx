import { useState, useEffect } from 'react';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Save, Sparkles, Heart, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import UnsavedChangesDialog from './UnsavedChangesDialog';
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";

interface BabyTooth {
  id: string;
  tooth_code: string;
  name: string;
  name_az: string | null;
  position: string;
  side: string;
  tooth_type: string;
  typical_emergence_months_min: number | null;
  typical_emergence_months_max: number | null;
  sort_order: number;
  is_active: boolean;
}

interface CareTip {
  id: string;
  title: string;
  title_az: string | null;
  content: string;
  content_az: string | null;
  category: string;
  emoji: string | null;
  sort_order: number;
  is_active: boolean;
}

interface Symptom {
  id: string;
  name: string;
  name_az: string | null;
  description: string | null;
  description_az: string | null;
  emoji: string | null;
  severity: string;
  relief_tips: string[] | null;
  relief_tips_az: string[] | null;
  sort_order: number;
  is_active: boolean;
}

const AdminTeething = () => {
    const localize = useAdminLocalize();
  const [activeTab, setActiveTab] = useState('teeth');
  const [teeth, setTeeth] = useState<BabyTooth[]>([]);
  const [tips, setTips] = useState<CareTip[]>([]);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    const [teethRes, tipsRes, symptomsRes] = await Promise.all([
    supabase.from('baby_teeth_db').select('*').order('sort_order'),
    supabase.from('teething_care_tips').select('*').order('sort_order'),
    supabase.from('teething_symptoms').select('*').order('sort_order')]
    );

    if (teethRes.data) setTeeth(teethRes.data);
    if (tipsRes.data) setTips(tipsRes.data);
    if (symptomsRes.data) setSymptoms(symptomsRes.data);

    setLoading(false);
  };

  const handleEdit = (item: any) => {
    setEditingItem({ ...item });
    setShowEditModal(true);
    setHasUnsavedChanges(false);
  };

  const handleCreate = () => {
    if (activeTab === 'teeth') {
      setEditingItem({
        tooth_code: '',
        name: '',
        name_az: '',
        position: 'upper',
        side: 'center',
        tooth_type: 'incisor',
        typical_emergence_months_min: 6,
        typical_emergence_months_max: 12,
        sort_order: teeth.length + 1,
        is_active: true
      });
    } else if (activeTab === 'tips') {
      setEditingItem({
        title: '',
        title_az: '',
        content: '',
        content_az: '',
        category: 'general',
        emoji: '💡',
        sort_order: tips.length + 1,
        is_active: true
      });
    } else {
      setEditingItem({
        name: '',
        name_az: '',
        description: '',
        description_az: '',
        emoji: '⚠️',
        severity: 'mild',
        relief_tips: [],
        relief_tips_az: [],
        sort_order: symptoms.length + 1,
        is_active: true
      });
    }
    setShowEditModal(true);
    setHasUnsavedChanges(false);
  };

  const handleSave = async () => {
    if (!editingItem) return;

    const tableName = activeTab === 'teeth' ? 'baby_teeth_db' :
    activeTab === 'tips' ? 'teething_care_tips' : 'teething_symptoms';

    try {
      if (editingItem.id) {
        const { error } = await supabase.
        from(tableName).
        update(editingItem).
        eq('id', editingItem.id);

        if (error) throw error;
        toast.success(tr("adminteething_yenilendi_d10a01", "Yenil\u0259ndi"));
      } else {
        const { error } = await supabase.
        from(tableName).
        insert(editingItem);

        if (error) throw error;
        toast.success(tr("adminteething_elave_edildi_b7d7e4", "\u018Flav\u0259 edildi"));
      }

      setShowEditModal(false);
      setHasUnsavedChanges(false);
      fetchData();
    } catch (error) {
      console.error('Save error:', error);
      toast.error(tr("adminteething_xeta_bas_verdi_f22fba", "X\u0259ta ba\u015F verdi"));
    }
  };

  const handleDelete = async (id: string) => {
    const tableName = activeTab === 'teeth' ? 'baby_teeth_db' :
    activeTab === 'tips' ? 'teething_care_tips' : 'teething_symptoms';

    const { error } = await supabase.
    from(tableName).
    delete().
    eq('id', id);

    if (error) {
      toast.error(tr("adminteething_siline_bilmedi_e5f591", "Silin\u0259 bilm\u0259di"));
    } else {
      toast.success('Silindi');
      fetchData();
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    const tableName = activeTab === 'teeth' ? 'baby_teeth_db' :
    activeTab === 'tips' ? 'teething_care_tips' : 'teething_symptoms';

    const { error } = await supabase.
    from(tableName).
    update({ is_active: isActive }).
    eq('id', id);

    if (error) {
      toast.error(tr("adminteething_xeta_bas_verdi_f22fba", "X\u0259ta ba\u015F verdi"));
    } else {
      fetchData();
    }
  };

  const updateEditingItem = (field: string, value: any) => {
    setEditingItem((prev: any) => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  if (loading) {
    return <div className="p-8 text-center">{tr("adminteething_yuklenir_5557de", "Yüklənir...")}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-pink-500" />
            {tr("adminteething_dis_cixarma_i_dareetmesi_c46924", "Di\u015F \xC7\u0131xarma \u0130dar\u0259etm\u0259si")}
          </h2>
          <p className="text-muted-foreground">{tr("adminteething_korpe_disleri_qulluq_meslehetleri_ve_sim_bedaf6", "Körpə dişləri, qulluq məsləhətləri və simptomları idarə edin")}</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 me-2" />
          {tr("adminteething_yeni_elave_et_fa6b69", "Yeni \u018Flav\u0259 Et")}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="teeth" className="flex items-center gap-2">
            <Heart className="w-4 h-4" />
            {tr("adminteething_disler_2bd3d1", "Di\u015Fl\u0259r (")}{teeth.length})
          </TabsTrigger>
          <TabsTrigger value="tips" className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            {tr("adminteething_meslehetler_ac87a6", "M\u0259sl\u0259h\u0259tl\u0259r (")}{tips.length})
          </TabsTrigger>
          <TabsTrigger value="symptoms" className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Simptomlar ({symptoms.length})
          </TabsTrigger>
        </TabsList>

        {/* Teeth Tab */}
        <TabsContent value="teeth">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr("adminteething_dis_683988", "Diş")}</TableHead>
                    <TableHead>{tr("adminteething_movqe_509838", "Mövqe")}</TableHead>
                    <TableHead>{tr("adminteething_nov_98ad7c", "Növ")}</TableHead>
                    <TableHead>{tr("adminteething_cixma_yasi_941826", "Çıxma Yaşı")}</TableHead>
                    <TableHead>Aktiv</TableHead>
                    <TableHead>{tr("adminteething_emeliyyatlar_54d70c", "Əməliyyatlar")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teeth.map((tooth) =>
                  <TableRow key={tooth.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{localize(tooth, 'name')}</p>
                          <p className="text-xs text-muted-foreground">{tooth.tooth_code}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {tooth.position === 'upper' ? tr("adminteething_yuxari_565e22", "Yuxar\u0131") : tr("adminteething_asagi_1c27f1", "A\u015Fa\u011F\u0131")} / {tooth.side === 'left' ? 'Sol' : tooth.side === 'right' ? tr("adminteething_sag_edbe12", "Sa\u011F") : tr("adminteething_merkez_fa0929", "M\u0259rk\u0259z")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {tooth.tooth_type === 'incisor' ? tr("adminteething_kesici_569ec2", "K\u0259sici") :
                      tooth.tooth_type === 'canine' ? tr("adminteething_kopek_b079b8", "K\xF6p\u0259k") : tr("adminteething_azi_462627", "Az\u0131")}
                      </TableCell>
                      <TableCell>
                        {tooth.typical_emergence_months_min}-{tooth.typical_emergence_months_max} ay
                      </TableCell>
                      <TableCell>
                        <Switch
                        checked={tooth.is_active}
                        onCheckedChange={(checked) => handleToggleActive(tooth.id, checked)} />
                      
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(tooth)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDelete(tooth.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tips Tab */}
        <TabsContent value="tips">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr("adminteething_meslehet_9a0892", "Məsləhət")}</TableHead>
                    <TableHead>Kateqoriya</TableHead>
                    <TableHead>Aktiv</TableHead>
                    <TableHead>{tr("adminteething_emeliyyatlar_54d70c", "Əməliyyatlar")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tips.map((tip) =>
                  <TableRow key={tip.id}>
                      <TableCell>
                        <div className="flex items-start gap-2">
                          <span className="text-xl">{tip.emoji}</span>
                          <div>
                            <p className="font-medium">{localize(tip, 'title')}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {localize(tip, 'content')}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{tip.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                        checked={tip.is_active}
                        onCheckedChange={(checked) => handleToggleActive(tip.id, checked)} />
                      
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(tip)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDelete(tip.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Symptoms Tab */}
        <TabsContent value="symptoms">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Simptom</TableHead>
                    <TableHead>{tr("adminteething_siddet_afc814", "Şiddət")}</TableHead>
                    <TableHead>Aktiv</TableHead>
                    <TableHead>{tr("adminteething_emeliyyatlar_54d70c", "Əməliyyatlar")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {symptoms.map((symptom) =>
                  <TableRow key={symptom.id}>
                      <TableCell>
                        <div className="flex items-start gap-2">
                          <span className="text-xl">{symptom.emoji}</span>
                          <div>
                            <p className="font-medium">{localize(symptom, 'name')}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {localize(symptom, 'description')}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={
                      symptom.severity === 'mild' ? 'bg-green-100 text-green-700' :
                      symptom.severity === 'moderate' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                      }>
                          {symptom.severity === 'mild' ? tr("adminteething_yungul_2a8010", "Y\xFCng\xFCl") :
                        symptom.severity === 'moderate' ? 'Orta' : 'Ciddi'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                        checked={symptom.is_active}
                        onCheckedChange={(checked) => handleToggleActive(symptom.id, checked)} />
                      
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(symptom)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDelete(symptom.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={(open) => {
        if (!open && hasUnsavedChanges) {
          // Will be handled by UnsavedChangesDialog
          return;
        }
        setShowEditModal(open);
      }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem?.id ? tr("adminteething_redakte_et_78eab1", "Redakt\u0259 Et") : tr("adminteething_yeni_elave_et_fa6b69", "Yeni \u018Flav\u0259 Et")}
            </DialogTitle>
          </DialogHeader>

          {editingItem &&
          <div className="space-y-4">
              {activeTab === 'teeth' &&
            <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Kod</label>
                      <Input
                    value={editingItem.tooth_code || ''}
                    onChange={(e) => updateEditingItem('tooth_code', e.target.value)}
                    placeholder="upper_central_incisor_right" />
                  
                    </div>
                    <div>
                      <label className="text-sm font-medium">{tr("adminteething_sira_421c5f", "Sıra")}</label>
                      <Input
                    type="number"
                    value={editingItem.sort_order || 0}
                    onChange={(e) => updateEditingItem('sort_order', parseInt(e.target.value))} />
                  
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Ad (EN)</label>
                    <Input
                  value={editingItem.name || ''}
                  onChange={(e) => updateEditingItem('name', e.target.value)} />
                
                  </div>
                  <div>
                    <label className="text-sm font-medium">Ad (AZ)</label>
                    <LocalizedInput formData={editingItem} setFormData={setEditingItem} field="name" label="Name" />
                
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium">{tr("adminteething_movqe_509838", "Mövqe")}</label>
                      <Select value={editingItem.position} onValueChange={(v) => updateEditingItem('position', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="upper">{tr("adminteething_yuxari_565e22", "Yuxarı")}</SelectItem>
                          <SelectItem value="lower">{tr("adminteething_asagi_1c27f1", "Aşağı")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">{tr("adminteething_teref_f60bc0", "Tərəf")}</label>
                      <Select value={editingItem.side} onValueChange={(v) => updateEditingItem('side', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Sol</SelectItem>
                          <SelectItem value="right">{tr("adminteething_sag_edbe12", "Sağ")}</SelectItem>
                          <SelectItem value="center">{tr("adminteething_merkez_fa0929", "Mərkəz")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">{tr("adminteething_nov_98ad7c", "Növ")}</label>
                      <Select value={editingItem.tooth_type} onValueChange={(v) => updateEditingItem('tooth_type', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="incisor">{tr("adminteething_kesici_569ec2", "Kəsici")}</SelectItem>
                          <SelectItem value="canine">{tr("adminteething_kopek_b079b8", "Köpək")}</SelectItem>
                          <SelectItem value="molar">{tr("adminteething_azi_462627", "Azı")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Min Ay</label>
                      <Input
                    type="number"
                    value={editingItem.typical_emergence_months_min || ''}
                    onChange={(e) => updateEditingItem('typical_emergence_months_min', parseInt(e.target.value))} />
                  
                    </div>
                    <div>
                      <label className="text-sm font-medium">Max Ay</label>
                      <Input
                    type="number"
                    value={editingItem.typical_emergence_months_max || ''}
                    onChange={(e) => updateEditingItem('typical_emergence_months_max', parseInt(e.target.value))} />
                  
                    </div>
                  </div>
                </>
            }

              {activeTab === 'tips' &&
            <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Emoji</label>
                      <Input
                    value={editingItem.emoji || ''}
                    onChange={(e) => updateEditingItem('emoji', e.target.value)} />
                  
                    </div>
                    <div>
                      <label className="text-sm font-medium">Kateqoriya</label>
                      <Select value={editingItem.category} onValueChange={(v) => updateEditingItem('category', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="before">{tr("adminteething_evvel_b41251", "Əvvəl")}</SelectItem>
                          <SelectItem value="during">{tr("adminteething_zamani_de9ddc", "Zamanı")}</SelectItem>
                          <SelectItem value="after">Sonra</SelectItem>
                          <SelectItem value="pain_relief">{tr("adminteething_agri_kesici_9c92cd", "Ağrı Kəsici")}</SelectItem>
                          <SelectItem value="general">{tr("adminteething_umumi_1b5521", "Ümumi")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">{tr("adminteething_basliq_en_4ac905", "Başlıq (EN)")}</label>
                    <Input
                  value={editingItem.title || ''}
                  onChange={(e) => updateEditingItem('title', e.target.value)} />
                
                  </div>
                  <div>
                    <label className="text-sm font-medium">{tr("adminteething_basliq_az_3e294a", "Başlıq (AZ)")}</label>
                    <LocalizedInput formData={editingItem} setFormData={setEditingItem} field="title" label="Title" />
                
                  </div>
                  <div>
                    <label className="text-sm font-medium">{tr("adminteething_mezmun_en_7541aa", "Məzmun (EN)")}</label>
                    <Textarea
                  value={editingItem.content || ''}
                  onChange={(e) => updateEditingItem('content', e.target.value)}
                  rows={3} />
                
                  </div>
                  <div>
                    <label className="text-sm font-medium">{tr("adminteething_mezmun_az_d18d5f", "Məzmun (AZ)")}</label>
                    <LocalizedTextarea formData={editingItem} setFormData={setEditingItem} field="content" label="Content" rows={3} />
                
                  </div>
                </>
            }

              {activeTab === 'symptoms' &&
            <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Emoji</label>
                      <Input
                    value={editingItem.emoji || ''}
                    onChange={(e) => updateEditingItem('emoji', e.target.value)} />
                  
                    </div>
                    <div>
                      <label className="text-sm font-medium">{tr("adminteething_siddet_afc814", "Şiddət")}</label>
                      <Select value={editingItem.severity} onValueChange={(v) => updateEditingItem('severity', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mild">{tr("adminteething_yungul_2a8010", "Yüngül")}</SelectItem>
                          <SelectItem value="moderate">Orta</SelectItem>
                          <SelectItem value="severe">Ciddi</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Ad (EN)</label>
                    <Input
                  value={editingItem.name || ''}
                  onChange={(e) => updateEditingItem('name', e.target.value)} />
                
                  </div>
                  <div>
                    <label className="text-sm font-medium">Ad (AZ)</label>
                    <LocalizedInput formData={editingItem} setFormData={setEditingItem} field="name" label="Name" />
                
                  </div>
                  <div>
                    <label className="text-sm font-medium">{tr("adminteething_aciqlama_en_6fb6db", "Açıqlama (EN)")}</label>
                    <Textarea
                  value={editingItem.description || ''}
                  onChange={(e) => updateEditingItem('description', e.target.value)}
                  rows={2} />
                
                  </div>
                  <div>
                    <label className="text-sm font-medium">{tr("adminteething_aciqlama_az_86f364", "Açıqlama (AZ)")}</label>
                    <LocalizedTextarea formData={editingItem} setFormData={setEditingItem} field="description" label="Description" rows={2} />
                
                  </div>
                </>
            }

              <Button onClick={handleSave} className="w-full">
                <Save className="w-4 h-4 me-2" />
                Yadda Saxla
              </Button>
            </div>
          }
        </DialogContent>
      </Dialog>

      <UnsavedChangesDialog
        open={hasUnsavedChanges && !showEditModal}
        onOpenChange={(open) => {
          if (!open) setHasUnsavedChanges(false);
        }}
        onSave={handleSave}
        onDiscard={() => {
          setShowEditModal(false);
          setHasUnsavedChanges(false);
        }} />
      
    </div>);

};

export default AdminTeething;