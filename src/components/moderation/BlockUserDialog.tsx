import { useState } from 'react';
import { tr } from '@/lib/tr';
import { Ban, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle } from
'@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
'@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { moderatorError } from '@/lib/moderator';

type BlockDuration = '1d' | '7d' | '30d' | 'permanent';

interface BlockUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Bloklanacaq istifadəçinin auth user_id-si */
  userId: string | null;
  userName?: string | null;
  /** Uğurlu blokdan sonra çağırılır (siyahını yeniləmək üçün) */
  onDone?: () => void;
}

/**
 * Paylaşılan "İstifadəçini blokla" dialoqu — AdminModeration, AdminUsers və
 * (admin üçün) community PostCard-dan istifadə olunur.
 *
 * Blok növləri:
 *   community — yalnız community yazıları (post/şərh/story/DM) bloklanır
 *   full      — istifadəçi tətbiqə girəndə tam blok ekranı görür
 *
 * İcra DB səviyyəsindədir: BEFORE INSERT trigger-lər (Duzelis61.sql,
 * enforce_community_block) + client gate-lər (Index.tsx, CommunityScreen).
 * Səbəb istifadəçiyə blok ekranında GÖSTƏRİLİR — təhqiredici mətn yazmayın.
 */
const BlockUserDialog = ({ open, onOpenChange, userId, userName, onDone }: BlockUserDialogProps) => {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [blockType, setBlockType] = useState<'community' | 'full'>('community');
  const [duration, setDuration] = useState<BlockDuration>(isAdmin ? 'permanent' : '7d');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setBlockType('community');
    setDuration(isAdmin ? 'permanent' : '7d');
    setReason('');
  };

  const computeExpiresAt = (): string | null => {
    if (duration === 'permanent') return null;
    const days = duration === '1d' ? 1 : duration === '7d' ? 7 : 30;
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
  };

  const handleBlock = async () => {
    if (!userId) return;
    if (!reason.trim()) {
      toast({
        title: tr('blockdialog_xeta', 'Xəta'),
        description: tr('blockdialog_reason_required', 'Səbəb yazılmalıdır — istifadəçi bunu blok ekranında görəcək'),
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await (supabase as any).rpc('moderator_user_action_v1', {
        p_user: userId, p_action: 'restrict', p_reason: 'other', p_detail: reason.trim(),
        p_options: { scope: blockType, seconds: duration === 'permanent' ? null : (duration === '1d' ? 1 : duration === '7d' ? 7 : 30) * 86400 }, p_request: crypto.randomUUID(),
      });
      if (error) throw error;

      toast({
        title: tr('blockdialog_ugurlu', 'Uğurlu'),
        description: tr('blockdialog_user_blocked', 'İstifadəçi bloklandı')
      });
      reset();
      onOpenChange(false);
      onDone?.();
    } catch (e: any) {
      toast({ title: tr('blockdialog_xeta', 'Xəta'), description: moderatorError(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => {if (!o) reset();onOpenChange(o);}}>
      <DialogContent className="sm:max-w-md max-w-[92vw] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="w-5 h-5 text-red-500" />
            {tr('blockdialog_title', 'İstifadəçini Blokla')}
          </DialogTitle>
          {userName &&
          <DialogDescription>{userName}</DialogDescription>
          }
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">{tr('blockdialog_type', 'Blok Növü')}</label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={blockType === 'community' ? 'default' : 'outline'}
                onClick={() => setBlockType('community')}
                className="flex-1">
                {tr('blockdialog_type_community', 'Yalnız Community')}
              </Button>
              <Button
                type="button"
                variant={blockType === 'full' ? 'destructive' : 'outline'}
                onClick={() => setBlockType('full')}
                className="flex-1">
                {tr('blockdialog_type_full', 'Tam Blok (tətbiq)')}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {blockType === 'community' ?
              tr('blockdialog_type_community_hint', 'Post, şərh, story və mesaj yaza bilməyəcək — tətbiqin qalan hissəsi işləyəcək') :
              tr('blockdialog_type_full_hint', 'Tətbiqə girəndə tam blok ekranı görəcək, heç nə edə bilməyəcək')}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{tr('blockdialog_duration', 'Müddət')}</label>
            <Select value={duration} onValueChange={(v: BlockDuration) => setDuration(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">{tr('blockdialog_duration_1d', '1 gün')}</SelectItem>
                <SelectItem value="7d">{tr('blockdialog_duration_7d', '7 gün')}</SelectItem>
                <SelectItem value="30d">{tr('blockdialog_duration_30d', '30 gün')}</SelectItem>
                {isAdmin && <SelectItem value="permanent">{tr('blockdialog_duration_permanent', 'Daimi')}</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{tr('blockdialog_reason', 'Səbəb')}</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={tr('blockdialog_reason_placeholder', 'Bloklama səbəbini yazın (istifadəçi bunu görəcək)...')}
              rows={3} />
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              {tr('blockdialog_cancel', 'Ləğv et')}
            </Button>
            <Button type="button" onClick={handleBlock} disabled={saving} variant="destructive" className="flex-1">
              {saving ?
              <Loader2 className="w-4 h-4 me-2 animate-spin" /> :
              <Ban className="w-4 h-4 me-2" />
              }
              {tr('blockdialog_confirm', 'Blokla')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>);

};

export default BlockUserDialog;
