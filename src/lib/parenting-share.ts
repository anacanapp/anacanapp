/**
 * Tərbiyə: send an SOS card or an article to the linked partner, or share it through the phone's share sheet.
 *
 * The partner gets an ordinary partner chat message (partner_messages, type 'text', same RPC + push as the chat):
 * the title, a one-line summary and a link https://app.anacan.az/parenting/<kind>/<id>. His Tərbiyə screen lists
 * the items she sent (readPartnerShares) and opens them directly; the link itself is routed by parseDeeplink.
 * No new message type, table or push contract is needed.
 */
import type { ParentingTarget } from './parenting-target';

export type ShareKind = 'sos' | 'article';
export interface ShareItem {
  kind: ShareKind;
  id: string;
  emoji: string;
  title: string;
  /** Article summary or the SOS card's moment. */
  summary: string;
}

const ID = /^[a-z0-9-]{1,60}$/;
export const PARENTING_LINK_BASE = 'https://app.anacan.az/parenting';
const LINK = /https:\/\/app\.anacan\.az\/parenting\/(sos|article)\/([a-z0-9-]{1,60})(?![a-z0-9-])/;

/** The in-app link of an item (also a universal link). */
export const parentingItemLink = (kind: ShareKind, id: string) => `${PARENTING_LINK_BASE}/${kind}/${id}`;

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

/** The partner message: emoji + title, the summary, the "open in Tərbiyə" hint and the link. */
export function partnerShareText(item: ShareItem, hint: string): string {
  return [`${item.emoji} ${clip(item.title, 120)}`, clip(item.summary, 280), '', hint, parentingItemLink(item.kind, item.id)].join('\n');
}

/** The share-sheet text (no partner linked or any other app): title, summary and where it is from. */
export function plainShareText(item: ShareItem, footer: string): string {
  return [`${item.emoji} ${clip(item.title, 120)}`, clip(item.summary, 400), '', footer].join('\n');
}

/** The item a partner message points to (null when the message is not a Tərbiyə share). */
export function parseParentingShare(content: string | null | undefined): ParentingTarget | null {
  const m = typeof content === 'string' ? LINK.exec(content) : null;
  return m && ID.test(m[2]) ? { kind: m[1] as ShareKind, id: m[2] } : null;
}

/**
 * Send to the mother's linked partner. The partner's user id is read from his profile (the profile link holds
 * the profile id); the message goes through the chat RPC, which also checks the link and sends the push.
 */
export async function sendParentingToPartner(actor: { userId: string; partnerProfileId: string }, text: string): Promise<boolean> {
  const { supabase } = await import('@/integrations/supabase/client');
  const { data, error } = await supabase.from('profiles').select('user_id').eq('id', actor.partnerProfileId).maybeSingle();
  const partnerUserId = (data as { user_id?: string } | null)?.user_id;
  if (error || !partnerUserId) return false;
  const { sendPartnerMessage } = await import('@/lib/chat');
  await sendPartnerMessage(actor.userId, partnerUserId, text);
  return true;
}

/** The phone's share sheet (web: Web Share API, else the clipboard). */
export async function shareParentingItem(text: string, title: string): Promise<boolean> {
  try {
    const { nativeShare } = await import('@/lib/native');
    return await nativeShare({ title, text });
  } catch {
    return false;
  }
}

/** The few query-builder calls used here (partner_messages is typed loosely to keep this module light). */
interface Query extends PromiseLike<{ data: unknown; error: unknown }> {
  select(cols: string): Query;
  update(values: Record<string, unknown>): Query;
  eq(col: string, value: unknown): Query;
  like(col: string, pattern: string): Query;
  gte(col: string, value: string): Query;
  order(col: string, o: { ascending: boolean }): Query;
  limit(n: number): Query;
}
/** The client (loaded on use); `from` returns a thenable builder, so it is not awaited before the query is built. */
const db = async () => (await import('@/integrations/supabase/client')).supabase as unknown as { from: (t: string) => Query };

export interface PartnerShare extends ParentingTarget {
  messageId: string;
  at: string;
  read: boolean;
}

/** Items the mother sent to this partner (newest first, one row per item, last 60 days, at most `limit`). */
export async function readPartnerShares(userId: string, o: { limit?: number; now?: number } = {}): Promise<PartnerShare[]> {
  const since = new Date((o.now ?? Date.now()) - 60 * 86_400_000).toISOString();
  const { data, error } = await (await db()).from('partner_messages')
    .select('id, content, created_at, is_read')
    .eq('receiver_id', userId)
    .eq('message_type', 'text')
    .like('content', `%${PARENTING_LINK_BASE}/%`)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error || !Array.isArray(data)) return [];
  return dedupeShares(data as { id: string; content: string | null; created_at: string; is_read?: boolean | null }[], o.limit ?? 5);
}

/** One entry per item (the newest message wins). */
export function dedupeShares(rows: { id: string; content: string | null; created_at: string; is_read?: boolean | null }[], limit = 5): PartnerShare[] {
  const seen = new Set<string>();
  const out: PartnerShare[] = [];
  for (const r of rows) {
    const t = parseParentingShare(r.content);
    if (!t || seen.has(`${t.kind}:${t.id}`)) continue;
    seen.add(`${t.kind}:${t.id}`);
    out.push({ ...t, messageId: r.id, at: r.created_at, read: !!r.is_read });
    if (out.length >= limit) break;
  }
  return out;
}

/** Mark the partner message read once he opened the item (best effort). */
export async function markPartnerShareRead(userId: string, messageId: string): Promise<void> {
  try {
    await (await db()).from('partner_messages').update({ is_read: true }).eq('id', messageId).eq('receiver_id', userId);
  } catch { /* the list still opens the item */ }
}
