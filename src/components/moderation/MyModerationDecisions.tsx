import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { moderatorText } from '@/lib/moderator-i18n';
import { moderatorError, moderatorReason } from '@/lib/moderator';
import { useModeratorMutation } from '@/hooks/useModerator';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export default function MyModerationDecisions({ onBack }: { onBack?: () => void }) {
  const { user } = useAuth(), language = useUserStore(state => state.language), backend = getBackendConfig().url;
  const [selected, setSelected] = useState<string | null>(null), [text, setText] = useState('');
  const request = useRef<{ key: string; id: string } | null>(null);
  useEffect(() => { setSelected(null); setText(''); request.current = null; }, [user?.id, backend]);
  const query = useQuery({ queryKey: ['my-moderation-decisions', backend, user?.id], enabled: !!user, meta: { persist: false }, staleTime: 0,
    queryFn: async ({ signal }) => { const { data, error } = await (supabase as any).rpc('my_moderator_decisions_v1', { p_actor: user?.id, p_limit: 30 }).abortSignal(signal); if (error) throw error; return data as any[]; } });
  const mutation = useModeratorMutation(() => { setSelected(null); setText(''); void query.refetch(); });
  const appeal = (id: string) => {
    const args = { p_actor: user?.id, p_action: id, p_body: text.trim() };
    const key = JSON.stringify([backend, args]);
    if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
    mutation.mutate({ rpc: 'submit_moderator_appeal_v1', args: { ...args, p_id: request.current.id } });
  };
  return <section className="a-scope a-subscreen" data-ad-block="true"><header className="a-topbar px-4"><div className="flex items-center gap-2 min-w-0">{onBack && <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="rtl:rotate-180" /></Button>}<h1 className="font-bold">{moderatorText('user_history', language)}</h1></div></header>
    <div className="flex-1 min-h-0 overflow-y-auto space-y-3 p-4 pb-24">
      {query.isPending && <div className="flex gap-2 py-8" role="status"><Loader2 className="animate-spin" />{moderatorText('loading', language)}</div>}
      {query.isError && <p role="alert">{moderatorError(query.error, language)}</p>}
      {query.data?.map(item => <article key={item.id} className="a-card space-y-3"><h2 className="font-bold text-sm">{moderatorReason(item.reason, language)}</h2>
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{item.public_detail || moderatorReason(item.reason, language, true)}</p>
        {item.appeal?.state === 'open' ? <p className="text-sm text-muted-foreground">{moderatorText('appeal_pending', language)}</p> : item.appeal?.response ? <p className="rounded-xl bg-muted p-3 text-sm whitespace-pre-wrap">{item.appeal.response}</p>
          : selected === item.id ? <div className="space-y-2"><Textarea aria-label={moderatorText('appeal_text', language)} value={text} onChange={event => setText(event.target.value)} maxLength={2000} rows={4} />
            <Button disabled={mutation.isPending || text.trim().length < 10} onClick={() => appeal(item.id)}><Send size={16} />{moderatorText('appeal_send', language)}</Button>
          </div> : <Button variant="outline" className="min-h-11 h-auto whitespace-normal" onClick={() => { setSelected(item.id); setText(''); }}>{moderatorText('appeal', language)}</Button>}
      </article>)}
      {query.data?.length === 0 && <p className="text-muted-foreground py-10 text-center">{moderatorText('empty', language)}</p>}
    </div>
  </section>;
}
