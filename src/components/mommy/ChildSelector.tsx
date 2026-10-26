import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ChevronDown, Check, Edit, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useChildren, Child } from '@/hooks/useChildren';
import { toast } from 'sonner';
import { tr } from "@/lib/tr";

interface ChildSelectorProps {
  compact?: boolean;
}

const genderOptions = [
{ value: 'boy', label: tr("childselector_oglan_e9715e", 'Oğlan'), emoji: '👦' },
{ value: 'girl', label: tr("childselector_qiz_79bf6b", 'Qız'), emoji: '👧' }];


const ChildSelector = ({ compact = false }: ChildSelectorProps) => {
  const {
    children,
    selectedChild,
    setSelectedChild,
    addChild,
    updateChild,
    deleteChild,
    getChildAge,
    hasChildren
  } = useChildren();

  const [showDropdown, setShowDropdown] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    birth_date: '',
    gender: 'boy' as 'boy' | 'girl'
  });

  const handleAddChild = async () => {
    if (!formData.name || !formData.birth_date) {
      toast.error(tr("childselector_ad_ve_dogum_tarixi_teleb_olunu_bdab04", "Ad v\u0259 do\u011Fum tarixi t\u0259l\u0259b olunur"));
      return;
    }

    const child = await addChild(formData);
    if (child) {
      toast.success(`${formData.name} ${tr("childselector_added", "əlavə edildi")}`);
      setShowAddModal(false);
      setFormData({ name: '', birth_date: '', gender: 'boy' });
      setSelectedChild(child);
    } else {
      toast.error(tr("childselector_xeta_bas_verdi_f22fba", "X\u0259ta ba\u015F verdi"));
    }
  };

  const handleUpdateChild = async () => {
    if (!editingChild || !formData.name || !formData.birth_date) return;

    const success = await updateChild(editingChild.id, {
      name: formData.name,
      birth_date: formData.birth_date,
      gender: formData.gender,
      avatar_emoji: genderOptions.find((g) => g.value === formData.gender)?.emoji || '👶'
    });

    if (success) {
      toast.success(tr("childselector_yenilendi_d10a01", "Yenil\u0259ndi"));
      setEditingChild(null);
    }
  };

  const handleDeleteChild = async (child: Child) => {
    if (confirm(`${child.name} ${tr("childselector_delete_confirm", "silinsin?")}`)) {
      const success = await deleteChild(child.id);
      if (success) {
        toast.success(tr("childselector_deleted", "Silindi"));
      }
    }
  };

  const openEditModal = (child: Child) => {
    setFormData({
      name: child.name,
      birth_date: child.birth_date,
      gender: child.gender === 'unknown' ? 'boy' : child.gender
    });
    setEditingChild(child);
  };

  const openAddModal = () => {
    setFormData({ name: '', birth_date: '', gender: 'boy' });
    setShowAddModal(true);
  };

  // Render add child modal (used in both cases)
  const renderAddModal = () =>
  <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{tr("childselector_usaq_elave_et_d57c06", "Uşaq Əlavə Et")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">{tr("childselector_label_name", "Ad")}</label>
            <Input
            value={formData.name}
            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            placeholder={tr("childselector_korpenin_adi_8a4e9e", "Körpənin adı")} />
          
          </div>
          <div>
            <label className="text-sm font-medium">{tr("childselector_dogum_tarixi_d96907", "Doğum tarixi")}</label>
            <Input
            type="date"
            value={formData.birth_date}
            onChange={(e) => setFormData((p) => ({ ...p, birth_date: e.target.value }))}
            max={new Date().toISOString().split('T')[0]} />
          
          </div>
          <div>
            <label className="text-sm font-medium">{tr("childselector_label_gender", "Cins")}</label>
            <div className="flex gap-2 mt-2">
              {genderOptions.map((opt) =>
            <button
              key={opt.value}
              onClick={() => setFormData((p) => ({ ...p, gender: opt.value as any }))}
              className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
              formData.gender === opt.value ?
              'border-primary bg-primary/10' :
              'border-muted hover:border-muted-foreground/30'}`
              }>
              
                  <span className="text-2xl">{opt.emoji}</span>
                  <span className="text-xs">{opt.label}</span>
                </button>
            )}
            </div>
          </div>
          <Button onClick={handleAddChild} className="w-full">
            {tr("childselector_elave_et_6e1b9b", "Əlavə et")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>;


  // If no children, show add button
  if (!hasChildren) {
    return (
      <>
        <motion.button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-medium text-sm"
          whileTap={{ scale: 0.95 }}>
          
          <Plus className="w-4 h-4" />
          {tr("childselector_usaq_elave_et_48f1f0", "Uşaq əlavə et")}
        </motion.button>
        {renderAddModal()}
      </>);

  }

  return (
    <>
      <div className="relative">
        <motion.button
          onClick={() => setShowDropdown(!showDropdown)}
          className={`flex items-center gap-2 ${
          compact ?
          'px-3 py-1.5 rounded-xl' :
          'px-4 py-2 rounded-2xl bg-card border shadow-sm'}`
          }
          style={compact ? {
            background: 'var(--a-surface)',
            border: '1px solid var(--a-btn-border)',
            boxShadow: '0 6px 14px -8px rgba(217, 108, 74, 0.35)'
          } : undefined}
          whileTap={{ scale: 0.98 }}>
          
          <span className="text-lg">{selectedChild?.avatar_emoji || '👶'}</span>
          <span className={`font-medium ${compact ? 'text-sm' : ''}`} style={compact ? { color: 'var(--a-ink)' } : undefined}>
            {selectedChild?.name || tr("childselector_usaq_sec_bbe44f", "Uşaq seç")}
          </span>
          {children.length > 1 &&
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          }
        </motion.button>

        <AnimatePresence>
          {showDropdown &&
          <>
              <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setShowDropdown(false)} />
            
              <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className={`absolute top-full mt-2 w-64 bg-card rounded-2xl border shadow-xl z-50 overflow-hidden ${compact ? 'end-0' : 'start-0'}`}>
              
                <div className="p-2">
                  {children.map((child) => {
                  const age = getChildAge(child);
                  const isSelected = selectedChild?.id === child.id;

                  return (
                    <motion.div
                      key={child.id}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                      isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'}`
                      }
                      onClick={() => {
                        setSelectedChild(child);
                        setShowDropdown(false);
                      }}>
                      
                        <span className="text-2xl">{child.avatar_emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{child.name}</p>
                          <p className="text-xs text-muted-foreground">{age.displayText}</p>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                        <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(child);
                          setShowDropdown(false);
                        }}
                        className="p-1.5 rounded-lg hover:bg-muted">
                        
                          <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </motion.div>);

                })}
                </div>
                
                <div className="border-t p-2">
                  <button
                  onClick={() => {
                    setShowDropdown(false);
                    openAddModal();
                  }}
                  className="flex items-center gap-2 w-full p-3 rounded-xl text-primary hover:bg-primary/10 transition-colors">
                  
                    <Plus className="w-4 h-4" />
                    <span className="font-medium text-sm">{tr("childselector_yeni_usaq_elave_et_bb2a07", "Yeni uşaq əlavə et")}</span>
                  </button>
                </div>
              </motion.div>
            </>
          }
        </AnimatePresence>
      </div>

      {/* Add Modal */}
      {renderAddModal()}

      {/* Edit Modal */}
      <Dialog open={!!editingChild} onOpenChange={() => setEditingChild(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{tr("childselector_usaq_redakte_et_53eb46", "Uşaq Redaktə Et")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{tr("childselector_label_name", "Ad")}</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} />
              
            </div>
            <div>
              <label className="text-sm font-medium">{tr("childselector_dogum_tarixi_d96907", "Doğum tarixi")}</label>
              <Input
                type="date"
                value={formData.birth_date}
                onChange={(e) => setFormData((p) => ({ ...p, birth_date: e.target.value }))}
                max={new Date().toISOString().split('T')[0]} />
              
            </div>
            <div>
              <label className="text-sm font-medium">{tr("childselector_label_gender", "Cins")}</label>
              <div className="flex gap-2 mt-2">
                {genderOptions.map((opt) =>
                <button
                  key={opt.value}
                  onClick={() => setFormData((p) => ({ ...p, gender: opt.value as any }))}
                  className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                  formData.gender === opt.value ?
                  'border-primary bg-primary/10' :
                  'border-muted hover:border-muted-foreground/30'}`
                  }>
                  
                    <span className="text-2xl">{opt.emoji}</span>
                    <span className="text-xs">{opt.label}</span>
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleUpdateChild} className="flex-1">
                {tr("childselector_save", "Yadda saxla")}
              </Button>
              {editingChild &&
              <Button
                variant="destructive"
                size="icon"
                onClick={() => {
                  handleDeleteChild(editingChild);
                  setEditingChild(null);
                }}>
                
                  <Trash2 className="w-4 h-4" />
                </Button>
              }
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>);

};

export default ChildSelector;