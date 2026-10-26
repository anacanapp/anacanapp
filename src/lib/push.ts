import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';

type InteractionPushData<Type extends string, Context extends string, Fields = object> = {
  type: Type;
  context: Context;
  interactionId: string;
} & Fields;

export type PushEventData =
  | { type: 'diagnostic'; context: 'self' }
  | InteractionPushData<'direct_message', 'direct_message', { sender_id: string; messageId: string }>
  | InteractionPushData<'group_message', 'group_message', { groupId: string; messageId: string }>
  | InteractionPushData<'community_like', 'community_post', { postId: string; groupId?: string | null }>
  | InteractionPushData<'community_comment', 'community_post', { postId: string }>
  | InteractionPushData<'story_like', 'community_story', { storyId: string }>
  | InteractionPushData<'story_reply', 'community_story', { storyId: string }>
  | InteractionPushData<'comment_like', 'post_comment', { commentId: string; postId: string }>
  | InteractionPushData<'community_reply', 'post_comment', { commentId: string; postId: string }>
  | InteractionPushData<'partner_message', 'partner', { messageId: string }>
  | InteractionPushData<'thank_you', 'partner', { messageId: string }>
  | InteractionPushData<'contraction_511', 'partner'>
  | InteractionPushData<'shopping_list', 'partner'>
  | InteractionPushData<'sos_alert', 'partner', { alertId: string }>
  | InteractionPushData<'birth_alert', 'partner', { alertId: string }>;

export interface SendPushPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Diaqnostika üçün: xəta reportlarında görünən qısa ad (məs. 'community_like') */
  kind?: string;
}

export interface SendPushResult {
  ok: boolean;
  sent: number;
  skipped?: string;
  data?: Record<string, unknown>;
  error?: unknown;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const contracts: Record<string, {
  context: string;
  required: string[];
  optional?: string[];
  interactionAlias?: string;
}> = {
  diagnostic: { context: 'self', required: [] },
  direct_message: {
    context: 'direct_message',
    required: ['sender_id', 'messageId'],
    interactionAlias: 'messageId'
  },
  group_message: { context: 'group_message', required: ['groupId', 'messageId'], interactionAlias: 'messageId' },
  community_like: { context: 'community_post', required: ['postId'], optional: ['groupId'] },
  community_comment: { context: 'community_post', required: ['postId'] },
  story_like: { context: 'community_story', required: ['storyId'] },
  story_reply: { context: 'community_story', required: ['storyId'] },
  comment_like: { context: 'post_comment', required: ['commentId', 'postId'] },
  community_reply: { context: 'post_comment', required: ['commentId', 'postId'] },
  partner_message: { context: 'partner', required: ['messageId'], interactionAlias: 'messageId' },
  thank_you: { context: 'partner', required: ['messageId'], interactionAlias: 'messageId' },
  contraction_511: { context: 'partner', required: [] },
  shopping_list: { context: 'partner', required: [] },
  sos_alert: { context: 'partner', required: ['alertId'], interactionAlias: 'alertId' },
  birth_alert: { context: 'partner', required: ['alertId'], interactionAlias: 'alertId' }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function pushContractError(payload: SendPushPayload): string | null {
  if (!uuid.test(payload.userId)) return 'invalid target user id';
  if (typeof payload.title !== 'string' || typeof payload.body !== 'string'
    || !payload.title.trim() || !payload.body.trim()) return 'empty title or body';
  if (!isRecord(payload.data)) return 'missing event data';

  const type = payload.data.type;
  if (typeof type !== 'string' || !Object.prototype.hasOwnProperty.call(contracts, type)) {
    return 'unsupported event type';
  }
  if (payload.kind && payload.kind !== type) return 'kind does not match event type';

  const contract = contracts[type];
  if (payload.data.context !== contract.context) return 'unsupported event context';

  const allowed = new Set(['type', 'context', ...contract.required, ...(contract.optional || [])]);
  if (type !== 'diagnostic') allowed.add('interactionId');
  if (Object.keys(payload.data).some((key) => !allowed.has(key))) return 'unsupported event data field';

  if (type === 'diagnostic') return null;
  if (typeof payload.data.interactionId !== 'string' || !uuid.test(payload.data.interactionId)) {
    return 'missing or invalid interaction id';
  }

  for (const field of contract.required) {
    const value = payload.data[field];
    if (typeof value !== 'string' || !uuid.test(value)) return `missing or invalid ${field}`;
  }
  for (const field of contract.optional || []) {
    if (!Object.prototype.hasOwnProperty.call(payload.data, field)) continue;
    const value = payload.data[field];
    if (field === 'groupId' && value === null) continue;
    if (typeof value !== 'string' || !uuid.test(value)) return `invalid ${field}`;
  }
  if (contract.interactionAlias && payload.data[contract.interactionAlias] !== payload.data.interactionId) {
    return `${contract.interactionAlias} does not match interaction id`;
  }
  return null;
}

/**
 * Invokes send-push-notification and logs actionable failures (no tokens, FCM missing, etc.).
 */
export async function invokeSendPush(payload: SendPushPayload): Promise<SendPushResult> {
  const kind = payload.kind || String((payload.data as any)?.type || 'push');
  const report = (reason: string, extra?: Record<string, unknown>) => {
    // Admin → Crash Reports-da görünsün ("pushlar getmir"in dəqiq səbəbi)
    import('@/lib/crashReporter').
    then((m) => m.reportPushFailure(kind, reason, extra)).
    catch(() => {});
  };

  const contractError = pushContractError(payload);
  if (contractError) {
    const error = new Error(`Invalid push contract: ${contractError}`);
    console.error('[Push] contract error:', contractError);
    report(`contract error: ${contractError}`);
    return { ok: false, sent: 0, error };
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        userId: payload.userId,
        title: payload.title,
        body: payload.body,
        data: payload.data
      }
    });

    if (error) {
      console.error('[Push] invoke error:', error);
      report(`invoke error: ${(error as any)?.message || String(error)}`);
      return { ok: false, sent: 0, error };
    }

    const sent = typeof data?.sent === 'number' ? data.sent : 0;
    const skipped = data?.skipped as string | undefined;

    if (sent === 0) {
      const reason =
      skipped ||
      data?.message || (
      data?.error ? String(data.error) : tr("push_push_gonderilmedi_sent_0_7d1a2a", "Push g\xF6nd\u0259rilm\u0259di (sent: 0)"));
      console.warn('[Push] not delivered:', reason, data);
      // "no_device_tokens" ən çox rast gəlinən real səbəbdir — o da reportlanır
      // ki, admin hansı istifadəçilərin tokensiz qaldığını görsün
      report(String(reason), { response: data });
      return { ok: false, sent: 0, skipped: reason, data };
    }

    return { ok: true, sent, data };
  } catch (err) {
    console.error('[Push] exception:', err);
    report(`exception: ${(err as any)?.message || String(err)}`);
    return { ok: false, sent: 0, error: err };
  }
}
