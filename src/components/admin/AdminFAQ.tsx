import { useState, useRef, useCallback } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import { HelpCircle, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAdminFAQ, FAQ } from '@/hooks/useAdminFAQ';
import UnsavedChangesDialog from './UnsavedChangesDialog';
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";

const categories = [
{ id: 'general', label: tr("adminfaq_umumi_1b5521", "Ümumi") },
{ id: 'account', label: 'Hesab' },
{ id: 'subscription', label: tr("adminfaq_abunelik_ce9af7", "Abunəlik") },
{ id: 'pregnancy', label: tr("adminfaq_hamilelik_e86feb", "Hamiləlik") },
{ id: 'baby', label: tr("adminfaq_korpe_fa2b51", "Körpə") },
{ id: 'partner', label: 'Partnyor' }];


const AdminFAQ = () => {
    const localize = useAdminLocalize();
  const { data: faqs = [], isLoading, create, update, remove } = useAdminFAQ();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<FAQ | null>(null);
  const [formData, setFormData] = useState<Partial<FAQ>>({});
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const initialFormDataRef = useRef<string>('');

  const hasUnsavedChanges = useCallback(() => {
    return JSON.stringify(formData) !== initialFormDataRef.current;
  }, [formData]);

  const handleModalClose = useCallback((open: boolean) => {
    if (!open && hasUnsavedChanges()) {
      setShowUnsavedDialog(true);
    } else {
      setShowModal(open);
    }
  }, [hasUnsavedChanges]);

  const handleDiscardChanges = useCallback(() => {
    setShowModal(false);
    setShowUnsavedDialog(false);
  }, []);

  const openCreateModal = () => {
    setEditingItem(null);
    const initialData = {
      question: '',
      question_az: '',
      answer: '',
      answer_az: '',
      category: 'general',
      sort_order: 0,
      is_active: true
    };
    setFormData(initialData);
    initialFormDataRef.current = JSON.stringify(initialData);
    setShowModal(true);
  };

  const openEditModal = (item: FAQ) => {
    setEditingItem(item);
    setFormData({ ...item });
    initialFormDataRef.current = JSON.stringify({ ...item });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (editingItem) {
      await update.mutateAsync({ id: editingItem.id, ...formData });
    } else {
      await create.mutateAsync(formData);
    }
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tr("adminfaq_silmek_istediyinize_eminsiniz_09658f", "Silm\u0259k ist\u0259diyiniz\u0259 \u0259minsiniz?"))) return;
    await remove.mutateAsync(id);
  };

  const filteredFaqs = faqs.filter((f) =>
  (localize(f, 'question')).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{tr("adminfaq_tez_tez_verilen_suallar_af4220", "Tez-Tez Verilən Suallar")}</h1>
          <p className="text-muted-foreground">{tr("adminfaq_faq_bolmesini_idare_edin_02e814", "FAQ bölməsini idarə edin")}</p>
        </div>
        <Button onClick={openCreateModal} className="gap-2">
          <Plus className="w-4 h-4" />
          Yeni Sual
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <HelpCircle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{faqs.length}</p>
              <p className="text-xs text-muted-foreground">{tr("adminfaq_umumi_1b5521", "Ümumi")}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <HelpCircle className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{faqs.filter((f) => f.is_active).length}</p>
              <p className="text-xs text-muted-foreground">Aktiv</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <HelpCircle className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{new Set(faqs.map((f) => f.category)).size}</p>
              <p className="text-xs text-muted-foreground">Kateqoriya</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <HelpCircle className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{faqs.filter((f) => !f.is_active).length}</p>
              <p className="text-xs text-muted-foreground">Gizli</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Sual axtar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-10" />
          
        </div>
      </Card>

      {/* FAQ List */}
      <Card>
        <CardHeader>
          <CardTitle>Suallar ({filteredFaqs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ?
          <div className="text-center py-8 text-muted-foreground">{tr("adminfaq_yuklenir_5557de", "Yüklənir...")}</div> :
          filteredFaqs.length === 0 ?
          <div className="text-center py-8 text-muted-foreground">{tr("adminfaq_sual_tapilmadi_ba44fc", "Sual tapılmadı")}</div> :

          <div className="space-y-3">
              {filteredFaqs.map((faq, index) =>
            <motion.div
              key={faq.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
              
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-medium text-foreground">{localize(faq, 'question')}</p>
                        <Badge variant={faq.is_active ? 'default' : 'secondary'}>
                          {faq.is_active ? 'Aktiv' : 'Gizli'}
                        </Badge>
                        <Badge variant="outline">
                          {categories.find((c) => c.id === faq.category)?.label || faq.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {localize(faq, 'answer')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ms-4">
                      <Button variant="ghost" size="icon" onClick={() => openEditModal(faq)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(faq.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
            )}
            </div>
          }
        </CardContent>
      </Card>

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={handleModalClose}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingItem ? tr("adminfaq_sual_redakte_et_85d075", "Sual Redakt\u0259 Et") : 'Yeni Sual'}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pe-4">
            <div className="space-y-4">
              <Input
                placeholder="Sual (EN)"
                value={formData.question || ''}
                onChange={(e) => setFormData({ ...formData, question: e.target.value })} />
              
              <LocalizedInput formData={formData} setFormData={setFormData} field="question" label="Sual" />
              
              <Textarea
                placeholder="Cavab (EN)"
                value={formData.answer || ''}
                onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                rows={4} />
              
              <LocalizedTextarea formData={formData} setFormData={setFormData} field="answer" label="Cavab" rows={4} />
              
              <div className="grid grid-cols-2 gap-3">
                <Select
                  value={formData.category || 'general'}
                  onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) =>
                    <SelectItem key={cat.id} value={cat.id}>
                        {cat.label}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder={tr("adminfaq_sira_421c5f", "Sıra")}
                  value={formData.sort_order || 0}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })} />
                
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active ?? true}
                  onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} />
                
                <span className="text-sm">Aktiv</span>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleModalClose(false)}>
              {tr("adminfaq_legv_et_b5e49c", "L\u0259\u011Fv et")}
            </Button>
            <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
              {editingItem ? tr("adminfaq_yenile_570ce2", "Yenil\u0259") : tr("adminfaq_elave_et_6e1b9b", "\u018Flav\u0259 et")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onDiscard={handleDiscardChanges}
        onSave={async () => {
          await handleSave();
          setShowUnsavedDialog(false);
        }} />
      
    </div>);

};

export default AdminFAQ;