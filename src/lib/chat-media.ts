import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Audit-2 finding #1: the chat-media bucket is private (signed URLs only). Direct-
// message and AI-chat photos/voice notes are reached through createSignedUrl at
// render time, mirroring baby-photos / baby-album / pregnancy-album. This helper
// also keeps legacy rows working: older messages stored a full getPublicUrl string
// that 404s once the bucket is private, so we extract the object path (everything
// after `/chat-media/`) and re-sign it. New rows store the bare object path.

const CHAT_MEDIA_BUCKET = 'chat-media';
/** Signed-URL lifetime. Long enough to read a thread, short enough to limit sharing. */
export const CHAT_MEDIA_SIGNED_TTL_SECONDS = 60 * 60; // 1 hour

interface SignedCacheEntry {
  url: string;
  /** Local-clock ms at which we refuse the cached url and re-sign. */
  expiresAt: number;
}

// In-memory, per object path. Scrolling a long thread re-mounts bubbles; the cache
// means each path is signed once per TTL window instead of on every render.
const signedCache = new Map<string, SignedCacheEntry>();

function sanitizeObjectPath(raw: string): string | null {
  const clean = raw.replace(/^\/+/, '');
  if (!clean || clean.includes('\\') || clean.includes('\0')) return null;
  const parts = clean.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) return null;
  return clean;
}

/**
 * Normalize a stored chat-media value to its storage object path.
 * Accepts a bare object path (new rows, e.g. `<user-id>/<ts>.jpg`) or a full
 * http(s) public/sign URL that embeds `/chat-media/<path>` (legacy rows).
 * Returns null for anything else (blob:/data: previews, foreign URLs, junk).
 */
export function chatMediaObjectPath(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const value = stored.trim();
  if (!value) return null;
  // A value with a URL scheme is only accepted when it is an http(s) URL that
  // embeds a chat-media object. blob:/data: previews and other schemes -> null.
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return null;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const match = /\/chat-media\/(.+)$/.exec(url.pathname);
    if (!match) return null;
    let decoded: string;
    try {
      decoded = decodeURIComponent(match[1]);
    } catch {
      return null;
    }
    return sanitizeObjectPath(decoded);
  }
  return sanitizeObjectPath(value);
}

/**
 * Create (or reuse a cached) signed URL for a stored chat-media value.
 * Returns null when the value is not a chat-media object or signing fails.
 */
export async function signChatMediaUrl(
  stored: string | null | undefined,
  ttlSeconds: number = CHAT_MEDIA_SIGNED_TTL_SECONDS,
): Promise<string | null> {
  const path = chatMediaObjectPath(stored);
  if (!path) return null;
  const now = Date.now();
  const cached = signedCache.get(path);
  if (cached && cached.expiresAt > now) return cached.url;
  const { data, error } = await supabase.storage.from(CHAT_MEDIA_BUCKET).createSignedUrl(path, ttlSeconds);
  if (error || !data?.signedUrl) return null;
  // Re-sign a minute before the real expiry so an on-screen image never 404s.
  const safeTtlMs = Math.max(ttlSeconds - 60, 1) * 1000;
  signedCache.set(path, { url: data.signedUrl, expiresAt: now + safeTtlMs });
  return data.signedUrl;
}

/** Test-only / logout cleanup: drop every cached signed URL. */
export function clearChatMediaSignedCache(): void {
  signedCache.clear();
}

/**
 * Resolve a stored chat-media value to a displayable src at render time.
 * Local blob:/data: previews are returned as-is (already authorised, instant);
 * everything else is signed (cached per path) and re-resolved when `stored`
 * changes, so a scrolled-away/scrolled-back bubble picks up a fresh signature.
 */
export function useChatMediaSrc(
  stored: string | null | undefined,
  ttlSeconds: number = CHAT_MEDIA_SIGNED_TTL_SECONDS,
): string | null {
  const preview = stored && /^(blob:|data:)/i.test(stored.trim()) ? stored.trim() : null;
  const [src, setSrc] = useState<string | null>(preview);
  useEffect(() => {
    const value = stored?.trim();
    if (!value) {
      setSrc(null);
      return;
    }
    if (/^(blob:|data:)/i.test(value)) {
      setSrc(value);
      return;
    }
    let active = true;
    setSrc(null);
    signChatMediaUrl(value, ttlSeconds)
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {
        if (active) setSrc(null);
      });
    return () => {
      active = false;
    };
  }, [stored, ttlSeconds]);
  return src;
}
