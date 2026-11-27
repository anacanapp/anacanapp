/**
 * Second-hand market safety (App Store 1.2): report a listing / user / conversation and block a user.
 * Tables: public.market_reports and public.market_blocks (supabase/migrations/20261108120000_market_reports_and_height.sql).
 * The server refuses messages between blocked users (MARKET_BLOCKED); the app additionally hides the
 * blocked user's listings and messages for the blocker. Until the migration is applied every call here
 * fails quietly (no blocks, report reported as unavailable).
 */

export type MarketReportTarget = 'listing' | 'user' | 'conversation';
export type MarketReportReason = 'spam' | 'scam' | 'inappropriate' | 'harassment' | 'prohibited' | 'other';

export const MARKET_REPORT_REASONS: MarketReportReason[] = ['spam', 'scam', 'inappropriate', 'harassment', 'prohibited', 'other'];
export const MARKET_REPORT_NOTE_MAX = 500;

export interface MarketReportInput {
  target: MarketReportTarget;
  listingId?: string | null;
  reportedUserId?: string | null;
  reason: MarketReportReason;
  note?: string;
}

/** Minimal shape of the Supabase client used here (keeps the helpers unit-testable). */
type Result = { data?: unknown; error: { code?: string; message?: string } | null };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = { from: (table: string) => any };

/** Row for market_reports, or null when the input is incomplete. reporter_id is fixed by RLS + trigger. */
export function buildMarketReport(reporterId: string, input: MarketReportInput) {
  if (!reporterId || !MARKET_REPORT_REASONS.includes(input.reason)) return null;
  const note = (input.note ?? '').trim().slice(0, MARKET_REPORT_NOTE_MAX);
  const listing_id = input.listingId || null;
  const reported_user_id = input.target === 'listing' ? null : input.reportedUserId || null;
  if (input.target === 'listing' && !listing_id) return null;
  if (input.target === 'user' && !reported_user_id) return null;
  if (input.target === 'conversation' && (!listing_id || !reported_user_id)) return null;
  if (reported_user_id && reported_user_id === reporterId) return null;
  return { reporter_id: reporterId, target_type: input.target, listing_id, reported_user_id, reason: input.reason, note: note || null };
}

/** The conversation is reportable only once there is at least one message; before that the user is reported. */
export const reportTargetForContact = (messageCount: number): MarketReportTarget => (messageCount > 0 ? 'conversation' : 'user');

export type MarketReportOutcome = 'sent' | 'duplicate' | 'unavailable' | 'failed';

export async function submitMarketReport(client: Client, reporterId: string, input: MarketReportInput): Promise<MarketReportOutcome> {
  const row = buildMarketReport(reporterId, input);
  if (!row) return 'failed';
  try {
    const { error } = (await client.from('market_reports').insert(row)) as Result;
    if (!error) return 'sent';
    if (error.code === '23505') return 'duplicate';
    if (isMissingRelation(error)) return 'unavailable';
    return 'failed';
  } catch {
    return 'failed';
  }
}

export async function loadMarketBlocks(client: Client, userId: string | null | undefined): Promise<Set<string>> {
  if (!userId) return new Set();
  try {
    const { data, error } = (await client.from('market_blocks').select('blocked_id').eq('blocker_id', userId)) as Result;
    if (error || !Array.isArray(data)) return new Set();
    return new Set((data as { blocked_id: string }[]).map((r) => r.blocked_id).filter(Boolean));
  } catch {
    return new Set();
  }
}

export async function blockMarketUser(client: Client, userId: string, blockedId: string): Promise<boolean> {
  if (!userId || !blockedId || userId === blockedId) return false;
  try {
    const { error } = (await client.from('market_blocks').insert({ blocker_id: userId, blocked_id: blockedId })) as Result;
    return !error || error.code === '23505';
  } catch {
    return false;
  }
}

export async function unblockMarketUser(client: Client, userId: string, blockedId: string): Promise<boolean> {
  try {
    const { error } = (await client.from('market_blocks').delete().eq('blocker_id', userId).eq('blocked_id', blockedId)) as Result;
    return !error;
  } catch {
    return false;
  }
}

/** Listings of blocked users are hidden for the blocker (her own listings always stay). */
export function visibleListings<T extends { user_id: string }>(listings: T[], blocked: Set<string>, myId?: string | null): T[] {
  if (!blocked.size) return listings;
  return listings.filter((l) => l.user_id === myId || !blocked.has(l.user_id));
}

/** Messages sent by a blocked user are hidden for the blocker. */
export function visibleMessages<T extends { sender_id: string }>(messages: T[], blocked: Set<string>): T[] {
  if (!blocked.size) return messages;
  return messages.filter((m) => !blocked.has(m.sender_id));
}

/** The server refused the message because one side blocked the other. */
export function isMarketBlockedError(error: { code?: string; message?: string } | null | undefined): boolean {
  return !!error && /MARKET_BLOCKED/.test(error.message ?? '');
}

export function isMissingRelation(error: { code?: string; message?: string } | null | undefined): boolean {
  return !!error && (error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST204' || error.code === '42703');
}
