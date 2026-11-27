// Split out of AdminPushNotifications.tsx (admin redesign). Logic unchanged; shared imports kept verbatim.
import { tr } from '@/lib/tr';
import { Bell, Plus, Users, Baby, Heart, Moon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export const audienceLabels: Record<string, {label: string;icon: any;color: string;}> = {
  all: { label: tr("adminpushnotifications_hami_c33b89", "Hamı"), icon: Users, color: 'bg-blue-500' },
  flow: { label: 'Menstruasiya', icon: Moon, color: 'bg-pink-500' },
  bump: { label: tr("adminpushnotifications_hamile_0080af", "Hamilə"), icon: Baby, color: 'bg-orange-500' },
  mommy: { label: 'Ana', icon: Heart, color: 'bg-red-500' },
  partner: { label: 'Partnyor', icon: Users, color: 'bg-purple-500' }
};

// ==================== SHARED COMPONENTS ====================
export const LoadingSpinner = () =>
<div className="flex items-center justify-center h-64">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>;


export const EmptyState = ({ onAdd }: {onAdd: () => void;}) =>
<Card className="p-8 text-center">
    <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
    <h3 className="font-medium mb-2">{tr("adminpushnotifications_bildiris_yoxdur_806a42", "Bildiriş Yoxdur")}</h3>
    <p className="text-sm text-muted-foreground mb-4">{tr("adminpushnotifications_gundelik_avtomatik_bildirisler_elave_edi_c1a864", "Gündəlik avtomatik bildirişlər əlavə edin")}</p>
    <Button onClick={onAdd}>
      <Plus className="h-4 w-4 me-2" />
      {tr("adminpushnotifications_i_lk_bildirisi_yarat_b9f9ca", "\u0130lk Bildiri\u015Fi Yarat")}
    </Button>
  </Card>;


export const NotificationDialog = ({
  open,
  onOpenChange,
  isEditing,
  form,
  setForm,
  onSave,
  isLoading








}: {open: boolean;onOpenChange: (open: boolean) => void;isEditing: boolean;form: any;setForm: (form: any) => void;onSave: () => void;isLoading: boolean;}) =>
<Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{isEditing ? tr("adminpushnotifications_bildirisi_redakte_et_587e1d", "Bildiri\u015Fi Redakt\u0259 Et") : tr("adminpushnotifications_yeni_bildiris_40105e", "Yeni Bildiri\u015F")}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{tr("adminpushnotifications_basliq_e1f6c5", "Başlıq")}</Label>
          <Input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder={tr("adminpushnotifications_gunun_xatirlatmasi_ec465f", "Günün Xatırlatması 💧")} />
        
        </div>

        <div className="space-y-2">
          <Label>{tr("adminpushnotifications_metn_6e9f0f", "Mətn")}</Label>
          <Textarea
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          placeholder={tr("adminpushnotifications_su_icmeyi_unutma_6feca5", "Su içməyi unutma!")}
          rows={3} />
        
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{tr("adminpushnotifications_hedef_auditoriya_50154d", "Hədəf Auditoriya")}</Label>
            <Select value={form.target_audience} onValueChange={(v) => setForm({ ...form, target_audience: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tr("adminpushnotifications_hami_c33b89", "Hamı")}</SelectItem>
                <SelectItem value="flow">Menstruasiya</SelectItem>
                <SelectItem value="bump">{tr("adminpushnotifications_hamile_0080af", "Hamilə")}</SelectItem>
                <SelectItem value="mommy">Ana</SelectItem>
                <SelectItem value="partner">Partnyor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Prioritet (1-10)</Label>
            <Input
            type="number"
            min={1}
            max={10}
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 1 })} />
          
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <Label>Aktiv</Label>
          <Switch
          checked={form.is_active}
          onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} />
        
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>{tr("adminpushnotifications_legv_et_b5e49c", "Ləğv et")}</Button>
        <Button onClick={onSave} disabled={isLoading}>
          {isEditing ? tr("adminpushnotifications_yenile_570ce2", "Yenil\u0259") : 'Yarat'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;


export const DeleteConfirmDialog = ({
  open,
  onOpenChange,
  onConfirm




}: {open: boolean;onOpenChange: (open: boolean) => void;onConfirm: () => void;}) =>
<AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{tr("adminpushnotifications_bildirisi_silmek_d3457f", "Bildirişi Silmək?")}</AlertDialogTitle>
        <AlertDialogDescription>{tr("adminpushnotifications_bu_emeliyyat_geri_qaytarila_bilmez_b4fea8", "Bu əməliyyat geri qaytarıla bilməz.")}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{tr("adminpushnotifications_legv_et_b5e49c", "Ləğv et")}</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm} className="bg-red-500 hover:bg-red-600">Sil</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;


