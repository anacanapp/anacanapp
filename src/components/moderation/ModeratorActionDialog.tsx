import { useEffect, useRef, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useModeratorAccess, useModeratorContent, useModeratorMutation } from '@/hooks/useModerator';
import { useUserStore } from '@/store/userStore';
import { moderatorText, type ModeratorTextKey } from '@/lib/moderator-i18n';
import { MODERATOR_REASONS, MODERATOR_SCOPES, moderatorError, moderatorReason, type ModeratorAction, type ModeratorScope, type ModeratorTarget } from '@/lib/moderator';
import { isRtlLang } from '@/lib/rtl';
import ModeratorMedia from './ModeratorMedia';

export default function ModeratorActionDialog({ target, action, onClose, onDone }: { target: ModeratorTarget | null; action: ModeratorAction | null; onClose: () => void; onDone?: () => void }) {
  const language = useUserStore(state => state.language), t = (key: ModeratorTextKey) => moderatorText(key, language);
  const access = useModeratorAccess(), detail = useModeratorContent(target && target.kind !== 'user' && !!action ? target.kind : null, target?.id || null);
  const [reason, setReason] = useState('other'), [note, setNote] = useState(''), [publicDetail, setPublicDetail] = useState(''), [text, setText] = useState('');
  const [scope, setScope] = useState<ModeratorScope>('community'), [seconds, setSeconds] = useState('86400');
  const request = useRef<{ key: string; id: string } | null>(null), loaded = useRef('');
  useEffect(() => { setReason('other'); setNote(''); setPublicDetail(''); setScope('community'); setSeconds('86400'); setText(target?.content || ''); request.current = null; loaded.current = ''; }, [target?.id, action]);
  useEffect(() => { if (detail.data && loaded.current !== detail.data.id) { setText(detail.data.content || detail.data.text_overlay || ''); loaded.current = detail.data.id; } }, [detail.data]);
  const mutation = useModeratorMutation(() => { onDone?.(); onClose(); });
  const contentAction = action && !['warn', 'restrict', 'unrestrict'].includes(action);
  const submit = () => {
    if (!target || !action) return;
    const args: Record<string, unknown> = contentAction ? {
      p_kind: target.kind, p_id: target.id, p_version: detail.data?.version ?? target.version ?? 0,
      p_action: action, p_reason: reason, p_content: action === 'edit' ? text.trim() : null, p_note: note.trim(),
    } : {
      p_user: target.userId, p_action: action, p_reason: reason, p_detail: publicDetail.trim(),
      p_options: action === 'restrict' ? { scope, seconds: seconds === 'permanent' ? null : Number(seconds), note: note.trim() }
        : action === 'unrestrict' ? { restriction_id: target.restrictionId, legacy: !!target.legacy, note: note.trim() } : { note: note.trim() },
    };
    const key = JSON.stringify(args); if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
    mutation.mutate({ rpc: contentAction ? 'moderator_content_action_v1' : 'moderator_user_action_v1', args: { ...args, p_request: request.current.id } });
  };
  const busy = mutation.isPending || contentAction && detail.isPending;
  return <Dialog open={!!target && !!action} onOpenChange={open => { if (!open && !mutation.isPending) onClose(); }}>
    <DialogContent closeLabel={t('close')} overlayClassName="z-[330]" dir={isRtlLang(language) ? 'rtl' : 'ltr'} className="z-[340] w-[calc(100%_-_24px)] max-w-xl max-h-[calc(100dvh_-_24px)] overflow-y-auto">
      <DialogHeader className="text-start"><DialogTitle className="flex gap-2 items-center"><ShieldCheck size={20} />{action ? t(action) : t('moderate')}</DialogTitle>
        <DialogDescription>{target?.name || t('user')}</DialogDescription></DialogHeader>
      {contentAction && detail.isError ? <div role="alert" className="space-y-3"><p>{moderatorError(detail.error, language)}</p><Button onClick={() => void detail.refetch()}>{t('refresh')}</Button></div> : <div className="space-y-4">
        {contentAction && detail.data && <ModeratorMedia content={detail.data} />}
        {action === 'edit' && <label className="block space-y-2"><span className="text-sm font-medium">{t('updated')}</span><Textarea value={text} maxLength={target?.kind === 'comment' ? 8000 : 20000} rows={7} onChange={event => setText(event.target.value)} dir="auto" />
          {target?.kind === 'post' && <span className="block text-xs text-muted-foreground">{t('edit_recheck')}</span>}</label>}
        {action === 'restore' && <p className="text-sm text-muted-foreground">{t('restore_recheck')}</p>}
        {action === 'warn' && <p className="text-sm leading-relaxed text-muted-foreground">{t('warning_hint')}</p>}
        {action === 'restrict' && <div className="grid sm:grid-cols-2 gap-3"><label className="block space-y-1"><span className="text-sm">{t('scope')}</span>
          <select aria-label={t('scope')} value={scope} onChange={event => setScope(event.target.value as ModeratorScope)} className="w-full min-h-11 border rounded-xl bg-background px-3 text-sm">
            {MODERATOR_SCOPES.map(value => <option key={value} value={value}>{t(`scope_${value}`)}</option>)}</select></label>
          <label className="block space-y-1"><span className="text-sm">{t('duration')}</span><select aria-label={t('duration')} value={seconds} onChange={event => setSeconds(event.target.value)} className="w-full min-h-11 border rounded-xl bg-background px-3 text-sm">
            {([['900', '15m'], ['3600', '1h'], ['86400', '1d'], ['604800', '7d'], ['2592000', '30d'], ...(access.data?.role === 'admin' ? [['permanent', 'permanent']] : [])]).map(([value, label]) => <option key={value} value={value}>{t(`duration_${label}` as ModeratorTextKey)}</option>)}</select></label></div>}
        <label className="block space-y-1"><span className="text-sm font-medium">{t('reason')}</span><select aria-label={t('reason')} value={reason} onChange={event => setReason(event.target.value)} className="w-full min-h-11 border rounded-xl bg-background px-3 text-sm">
          {MODERATOR_REASONS.map(value => <option key={value} value={value}>{moderatorReason(value, language)}</option>)}</select></label>
        {['warn', 'restrict'].includes(action || '') && <label className="block space-y-1"><span className="text-sm font-medium">{t('public_detail')}</span><Textarea value={publicDetail} onChange={event => setPublicDetail(event.target.value)} maxLength={1000} rows={3} />
          <span className="block text-xs text-muted-foreground">{t('public_detail_hint')}</span></label>}
        <label className="block space-y-1"><span className="text-sm font-medium">{t('note')}</span><Textarea value={note} onChange={event => setNote(event.target.value)} maxLength={2000} rows={3} /><span className="block text-xs text-muted-foreground">{t('note_hint')}</span></label>
        {mutation.isError && <p role="alert" className="text-sm text-destructive">{moderatorError(mutation.error, language)}</p>}
        <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={mutation.isPending} onClick={onClose}>{t('cancel')}</Button>
          <Button variant={['remove', 'restrict'].includes(action || '') ? 'destructive' : 'default'} disabled={!!busy || !access.data?.allowed || action === 'edit' && !text.trim()} className="min-h-11 h-auto whitespace-normal" onClick={submit}>
            {busy && <Loader2 size={16} className="animate-spin" />}{action ? t(action) : t('save')}</Button></div>
      </div>}
    </DialogContent>
  </Dialog>;
}
