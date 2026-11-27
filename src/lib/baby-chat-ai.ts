/**
 * Optional AI reply for "Körpəmdən mesajlar" (server function baby-chat-reply, off by default).
 * Returns null whenever the AI is off, limited, filtered, slow or unreachable — the caller then
 * uses a curated line, so the mother never sees an error.
 */
import { supabase } from '@/integrations/supabase/client';
import type { BabyWeekFacts } from '@/lib/baby-chat';

export interface BabyAiResult { reply: string | null; care: boolean }

export async function askBabyAi(message: string, facts: BabyWeekFacts, language: string, timeoutMs = 5000): Promise<BabyAiResult> {
  const call = supabase.functions.invoke('baby-chat-reply', {
    body: { message, language, week: facts.week, fruit: facts.fruit, cm: facts.cm, weeksLeft: facts.weeksLeft },
  }).then(({ data, error }) => {
    if (error || !data || typeof data !== 'object') return { reply: null, care: false };
    const reply = typeof data.reply === 'string' && data.reply.trim() && data.reply.length <= 160 ? data.reply.trim() : null;
    return { reply, care: data.care === true };
  }).catch(() => ({ reply: null, care: false }));
  const timeout = new Promise<BabyAiResult>((resolve) => setTimeout(() => resolve({ reply: null, care: false }), timeoutMs));
  return Promise.race([call, timeout]);
}
