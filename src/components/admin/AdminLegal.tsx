import { useState } from 'react';
import { tr } from '@/lib/tr';
import { FileText, Save, Plus, Eye, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import RichTextEditor from '@/components/ui/RichTextEditor';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAllLegalDocuments, useUpdateLegalDocument, useCreateLegalDocument, LegalDocument } from '@/hooks/useLegalDocuments';
import { toast } from 'sonner';
import MarkdownContent from '@/components/MarkdownContent';
import { LocalizedInput } from "./ui/LocalizedInput";
import { LocalizedTextarea } from "./ui/LocalizedTextarea";
import { useAdminLocalize } from "@/contexts/AdminLanguageContext";

const documentTypeLabels: Record<string, string> = {
  terms_of_service: tr("adminlegal_i_stifade_sertleri_fbbe3d", "\u0130stifad\u0259 \u015E\u0259rtl\u0259ri"),
  privacy_policy: tr("adminlegal_mexfilik_siyaseti_43dc57", "M\u0259xfilik Siyas\u0259ti"),
  gdpr_ccpa: 'GDPR / CCPA',
  disclaimer: tr("adminlegal_tibbi_xeberdarliq_f7b6b5", "Tibbi X\u0259b\u0259rdarl\u0131q"),
  refund_policy: tr("adminlegal_geri_odeme_d650f0", "Geri \xD6d\u0259m\u0259"),
  data_usage: tr("adminlegal_melumat_i_stifadesi_af1211", "M\u0259lumat \u0130stifad\u0259si")
};

const AdminLegal = () => {
    const localize = useAdminLocalize();
  const { data: documents = [], isLoading } = useAllLegalDocuments();
  const updateDocument = useUpdateLegalDocument();
  const createDocument = useCreateLegalDocument();

  const [selectedDoc, setSelectedDoc] = useState<LegalDocument | null>(null);
  const [editForm, setEditForm] = useState<Partial<LegalDocument>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleEdit = (doc: LegalDocument) => {
    setSelectedDoc(doc);
    setEditForm({
      title: doc.title,
      title_az: doc.title_az,
      content: doc.content,
      content_az: doc.content_az,
      version: doc.version,
      is_active: doc.is_active
    });
    setIsCreating(false);
  };

  const handleCreate = () => {
    setSelectedDoc(null);
    setEditForm({
      document_type: '',
      title: '',
      title_az: '',
      content: '',
      content_az: '',
      version: '1.0',
      is_active: true
    });
    setIsCreating(true);
  };

  const handleSave = async () => {
    try {
      if (isCreating) {
        await createDocument.mutateAsync(editForm as any);
        toast.success(tr("adminlegal_sened_yaradildi_d5d8b0", "S\u0259n\u0259d yarad\u0131ld\u0131"));
      } else if (selectedDoc) {
        await updateDocument.mutateAsync({
          id: selectedDoc.id,
          ...editForm
        });
        toast.success(tr("adminlegal_sened_yenilendi_c399bf", "S\u0259n\u0259d yenil\u0259ndi"));
      }
      setSelectedDoc(null);
      setIsCreating(false);
    } catch (error) {
      toast.error(tr("adminlegal_xeta_bas_verdi_f22fba", "X\u0259ta ba\u015F verdi"));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>);

  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{tr("adminlegal_huquqi_senedler_ca8c60", "Hüquqi Sənədlər")}</h2>
          <p className="text-muted-foreground">{tr("adminlegal_sertler_mexfilik_gdpr_ve_diger_senedleri_4d1d93", "Şərtlər, Məxfilik, GDPR və digər sənədləri idarə edin")}</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 me-2" />
          {tr("adminlegal_yeni_sened_98a562", "Yeni S\u0259n\u0259d")}
        </Button>
      </div>

      <div className="grid gap-4">
        {documents.map((doc) =>
        <Card key={doc.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${doc.is_active ? 'bg-green-500/10' : 'bg-gray-500/10'}`}>
                  <FileText className={`h-5 w-5 ${doc.is_active ? 'text-green-500' : 'text-gray-500'}`} />
                </div>
                <div>
                  <h3 className="font-medium">{localize(doc, 'title')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {documentTypeLabels[doc.document_type] || doc.document_type} • v{doc.version}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedDoc(doc);
                  setPreviewOpen(true);
                }}>
                
                  <Eye className="h-4 w-4 me-1" />
                  {tr("adminlegal_onizleme_1f8cc7", "\xD6nizl\u0259m\u0259")}
                </Button>
                <Button size="sm" onClick={() => handleEdit(doc)}>
                  <Edit className="h-4 w-4 me-1" />
                  {tr("adminlegal_redakte_d53ba7", "Redakt\u0259")}
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={selectedDoc !== null || isCreating} onOpenChange={(open) => {
        if (!open) {
          setSelectedDoc(null);
          setIsCreating(false);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {isCreating ? tr("adminlegal_yeni_sened_98a562", "Yeni S\u0259n\u0259d") : tr("adminlegal_senedi_redakte_et_abb678", "S\u0259n\u0259di Redakt\u0259 Et")}
            </DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="content" className="flex-1">
            <TabsList className="w-full">
              <TabsTrigger value="content" className="flex-1">{tr("adminlegal_mezmun_f1d51d", "Məzmun")}</TabsTrigger>
              <TabsTrigger value="settings" className="flex-1">{tr("adminlegal_parametrler_5d664b", "Parametrlər")}</TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[60vh] mt-4">
              <TabsContent value="content" className="space-y-4 px-1">
                {isCreating &&
                <div className="space-y-2">
                    <Label>{tr("adminlegal_sened_novu_ingilisce_925de7", "Sənəd Növü (ingiliscə)")}</Label>
                    <Input
                    value={editForm.document_type || ''}
                    onChange={(e) => setEditForm({ ...editForm, document_type: e.target.value })}
                    placeholder="privacy_policy" />
                  
                  </div>
                }

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{tr("adminlegal_basliq_en_4ac905", "Başlıq (EN)")}</Label>
                    <Input
                      value={editForm.title || ''}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                    
                  </div>
                  <div className="space-y-2">
                    <Label>{tr("adminlegal_basliq_az_3e294a", "Başlıq (AZ)")}</Label>
                    <LocalizedInput formData={editForm} setFormData={setEditForm} field="title" label="Title" />
                    
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{tr("adminlegal_mezmun_az_d18d5f", "Məzmun (AZ)")}</Label>
                  <RichTextEditor
                    content={editForm.content_az || ''}
                    onChange={(html) => setEditForm({ ...editForm, content_az: html })}
                    placeholder={tr("adminlegal_huquqi_senedin_mezmunu_0db749", "Hüquqi sənədin məzmunu...")} />
                  
                </div>

                <div className="space-y-2">
                  <Label>{tr("adminlegal_mezmun_en_7541aa", "Məzmun (EN)")}</Label>
                  <RichTextEditor
                    content={editForm.content || ''}
                    onChange={(html) => setEditForm({ ...editForm, content: html })}
                    placeholder="Legal document content..." />
                  
                </div>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4 px-1">
                <div className="space-y-2">
                  <Label>Versiya</Label>
                  <Input
                    value={editForm.version || ''}
                    onChange={(e) => setEditForm({ ...editForm, version: e.target.value })}
                    placeholder="1.0" />
                  
                </div>

                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <Label>Aktiv</Label>
                    <p className="text-sm text-muted-foreground">{tr("adminlegal_senedi_istifadecilere_goster_7e821b", "Sənədi istifadəçilərə göstər")}</p>
                  </div>
                  <Switch
                    checked={editForm.is_active ?? true}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, is_active: checked })} />
                  
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => {setSelectedDoc(null);setIsCreating(false);}}>
              {tr("adminlegal_legv_et_b5e49c", "L\u0259\u011Fv et")}
            </Button>
            <Button onClick={handleSave} disabled={updateDocument.isPending || createDocument.isPending}>
              <Save className="h-4 w-4 me-2" />
              Yadda saxla
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selectedDoc?.title_az || selectedDoc?.title}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[70vh]">
            <div className="prose prose-sm dark:prose-invert max-w-none p-4">
              <MarkdownContent content={selectedDoc?.content_az || selectedDoc?.content || ''} />
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>);

};

export default AdminLegal;