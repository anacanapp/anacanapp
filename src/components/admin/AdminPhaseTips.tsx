import { useState } from 'react';
import { tr } from '@/lib/tr';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit, Trash2, Save, X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  usePhaseTipsAdmin,
  PhaseTip,
  MenstrualPhase,
  TipCategory,
  PHASE_INFO,
  CATEGORY_INFO } from
'@/hooks/usePhaseTips';
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";

const AdminPhaseTips = () => {
    const localize = useAdminLocalize();
  const { tips, tipsByPhase, isLoading, createTip, updateTip, deleteTip } = usePhaseTipsAdmin();
  const { toast } = useToast();
  const [activePhase, setActivePhase] = useState<MenstrualPhase>('menstrual');
  const [searchQuery, setSearchQuery] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingTip, setEditingTip] = useState<PhaseTip | null>(null);

  const [formData, setFormData] = useState({
    phase: 'menstrual' as MenstrualPhase,
    title: '',
    title_az: '',
    content: '',
    content_az: '',
    emoji: '💡',
    category: 'general' as TipCategory,
    sort_order: 0,
    is_active: true
  });

  const phases: MenstrualPhase[] = ['menstrual', 'follicular', 'ovulation', 'luteal'];
  const categories: TipCategory[] = ['general', 'nutrition', 'exercise', 'selfcare', 'mood', 'intimacy'];

  const handleEdit = (tip: PhaseTip) => {
    setEditingTip(tip);
    setFormData({
      phase: tip.phase,
      title: tip.title,
      title_az: tip.title_az || '',
      content: tip.content,
      content_az: tip.content_az || '',
      emoji: tip.emoji,
      category: tip.category,
      sort_order: tip.sort_order,
      is_active: tip.is_active
    });
    setShowEditor(true);
  };

  const handleCreate = () => {
    setEditingTip(null);
    setFormData({
      phase: activePhase,
      title: '',
      title_az: '',
      content: '',
      content_az: '',
      emoji: '💡',
      category: 'general',
      sort_order: (tipsByPhase[activePhase]?.length || 0) + 1,
      is_active: true
    });
    setShowEditor(true);
  };

  const handleSave = () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      toast({
        title: tr("adminphasetips_xeta_3cdbb6", "Xəta"),
        description: tr("adminphasetips_basliq_ve_mezmun_teleb_olunur_02f6f5", "Başlıq və məzmun tələb olunur"),
        variant: 'destructive'
      });
      return;
    }

    if (editingTip) {
      updateTip({ id: editingTip.id, ...formData });
      toast({ title: tr("adminphasetips_meslehet_yenilendi_a9d1bd", "Məsləhət yeniləndi!") });
    } else {
      createTip(formData);
      toast({ title: tr("adminphasetips_yeni_meslehet_yaradildi_282e6d", "Yeni məsləhət yaradıldı!") });
    }

    setShowEditor(false);
    setEditingTip(null);
  };

  const handleDelete = (id: string) => {
    if (confirm(tr("adminphasetips_bu_mesleheti_silmek_istediyini_c9671e", "Bu m\u0259sl\u0259h\u0259ti silm\u0259k ist\u0259diyiniz\u0259 \u0259minsiniz?"))) {
      deleteTip(id);
      toast({ title: tr("adminphasetips_meslehet_silindi_0a5099", "Məsləhət silindi") });
    }
  };

  const filteredTips = (tipsByPhase[activePhase] || []).filter((tip) =>
  tip.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
  tip.title_az?.toLowerCase().includes(searchQuery.toLowerCase()) ||
  tip.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <h1 className="text-2xl font-bold text-foreground">{tr("adminphasetips_faza_meslehetleri_8df8d3", "Faza Məsləhətləri")}</h1>
          <p className="text-muted-foreground">{tr("adminphasetips_menstruasiya_fazalarina_uygun_meslehetle_26de89", "Menstruasiya fazalarına uyğun məsləhətləri idarə edin")}</p>
        </div>
        <Button onClick={handleCreate} className="bg-primary">
          <Plus className="w-4 h-4 me-2" />
          {tr("adminphasetips_yeni_meslehet_8a124f", "Yeni M\u0259sl\u0259h\u0259t")}
        </Button>
      </div>

      {/* Phase Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {phases.map((phase) =>
        <button
          key={phase}
          onClick={() => setActivePhase(phase)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${
          activePhase === phase ?
          'text-white shadow-lg' :
          'bg-card border border-border text-muted-foreground hover:bg-muted'}`
          }
          style={activePhase === phase ? { backgroundColor: PHASE_INFO[phase].color } : {}}>
          
            <span className="text-lg">{PHASE_INFO[phase].emoji}</span>
            <span>{PHASE_INFO[phase].labelAz}</span>
            <Badge variant="secondary" className="ms-1 text-xs">
              {tipsByPhase[phase]?.length || 0}
            </Badge>
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={tr("adminphasetips_meslehet_axtar_52d3a3", "Məsləhət axtar...")}
          className="ps-10" />
        
      </div>

      {/* Tips Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTips.map((tip) =>
        <motion.div
          key={tip.id}
          layout
          className={`bg-card rounded-xl border p-4 ${!tip.is_active ? 'opacity-50' : ''}`}
          style={{ borderColor: `${PHASE_INFO[tip.phase].color}30` }}>
          
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{tip.emoji}</span>
                <Badge
                variant="secondary"
                className="text-xs"
                style={{ backgroundColor: `${PHASE_INFO[tip.phase].color}20`, color: PHASE_INFO[tip.phase].color }}>
                
                  {CATEGORY_INFO[tip.category].labelAz}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">#{tip.sort_order}</span>
            </div>

            <h3 className="font-bold text-foreground mb-1">{localize(tip, 'title')}</h3>
            <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
              {localize(tip, 'content')}
            </p>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => handleEdit(tip)}>
                <Edit className="w-3 h-3 me-1" />
                {tr("adminphasetips_redakte_d53ba7", "Redakt\u0259")}
              </Button>
              <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => handleDelete(tip.id)}>
              
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </motion.div>
        )}
      </div>

      {filteredTips.length === 0 &&
      <div className="text-center py-12">
          <div className="text-5xl mb-4">{PHASE_INFO[activePhase].emoji}</div>
          <p className="text-muted-foreground">{tr("adminphasetips_bu_faza_ucun_meslehet_yoxdur_c20833", "Bu faza üçün məsləhət yoxdur")}</p>
          <Button onClick={handleCreate} variant="outline" className="mt-4">
            <Plus className="w-4 h-4 me-2" />
            {tr("adminphasetips_i_lk_mesleheti_elave_et_791422", "\u0130lk m\u0259sl\u0259h\u0259ti \u0259lav\u0259 et")}
          </Button>
        </div>
      }

      {/* Editor Modal */}
      <AnimatePresence>
        {showEditor &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowEditor(false)}>
          
            <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            className="bg-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            
              <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
                <h2 className="text-xl font-bold">
                  {editingTip ? tr("adminphasetips_mesleheti_redakte_et_da458b", "M\u0259sl\u0259h\u0259ti Redakt\u0259 Et") : tr("adminphasetips_yeni_meslehet_8a124f", "Yeni M\u0259sl\u0259h\u0259t")}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setShowEditor(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="p-6 space-y-5">
                {/* Phase & Category */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Faza</label>
                    <div className="flex flex-wrap gap-2">
                      {phases.map((phase) =>
                    <button
                      key={phase}
                      type="button"
                      onClick={() => setFormData({ ...formData, phase })}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      formData.phase === phase ?
                      'text-white' :
                      'bg-muted text-muted-foreground'}`
                      }
                      style={formData.phase === phase ? { backgroundColor: PHASE_INFO[phase].color } : {}}>
                      
                          {PHASE_INFO[phase].emoji} {PHASE_INFO[phase].labelAz.split(' ')[0]}
                        </button>
                    )}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Kateqoriya</label>
                    <div className="flex flex-wrap gap-2">
                      {categories.map((cat) =>
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFormData({ ...formData, category: cat })}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      formData.category === cat ?
                      'bg-primary text-primary-foreground' :
                      'bg-muted text-muted-foreground'}`
                      }>
                      
                          {CATEGORY_INFO[cat].emoji}
                        </button>
                    )}
                    </div>
                  </div>
                </div>

                {/* Emoji & Sort Order */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Emoji</label>
                    <Input
                    value={formData.emoji}
                    onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                    placeholder="💡" />
                  
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">{tr("adminphasetips_sira_421c5f", "Sıra")}</label>
                    <Input
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                    min={0} />
                  
                  </div>
                </div>

                {/* Title EN */}
                <div>
                  <label className="text-sm font-medium mb-2 block">{tr("adminphasetips_basliq_en_4ac905", "Başlıq (EN)")}</label>
                  <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Tip title in English" />
                
                </div>

                {/* Title AZ */}
                <div>
                  <label className="text-sm font-medium mb-2 block">{tr("adminphasetips_basliq_az_2bba90", "Başlıq (AZ) *")}</label>
                  <LocalizedInput formData={formData} setFormData={setFormData} field="title" label="Azərbaycan dilində başlıq" />
                
                </div>

                {/* Content EN */}
                <div>
                  <label className="text-sm font-medium mb-2 block">{tr("adminphasetips_mezmun_en_7541aa", "Məzmun (EN)")}</label>
                  <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Tip content in English"
                  rows={3} />
                
                </div>

                {/* Content AZ */}
                <div>
                  <label className="text-sm font-medium mb-2 block">{tr("adminphasetips_mezmun_az_c325f6", "Məzmun (AZ) *")}</label>
                  <LocalizedTextarea formData={formData} setFormData={setFormData} field="content" label="Azərbaycan dilində məzmun" rows={3} />
                
                </div>

                {/* Active Toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
                
                  <span className="text-sm">Aktiv</span>
                </label>
              </div>

              <div className="p-6 border-t border-border flex justify-end gap-3 sticky bottom-0 bg-card">
                <Button variant="outline" onClick={() => setShowEditor(false)}>
                  {tr("adminphasetips_legv_et_b5e49c", "L\u0259\u011Fv et")}
                </Button>
                <Button onClick={handleSave} className="bg-primary">
                  <Save className="w-4 h-4 me-2" />
                  {editingTip ? tr("adminphasetips_yenile_570ce2", "Yenil\u0259") : 'Yarat'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

};

export default AdminPhaseTips;