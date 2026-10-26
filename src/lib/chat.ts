import { supabase } from '@/integrations/supabase/client';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { tr } from '@/lib/group-i18n';

export type ChatKind = 'direct' | 'partner' | 'group';
export type ChatMediaType = 'image' | 'video' | 'audio';
export interface ChatMessage {
  id: string; sender_id: string; receiver_id?: string; group_id?: string;
  content: string | null; message_type: string; media_url?: string | null;
  media_path?: string | null; media_mime?: string | null; duration_ms?: number | null;
  reply_to_id?: string | null; is_read?: boolean; created_at: string;
}
export interface ChatReaction {
  id: string; user_id: string; emoji: string;
  direct_message_id?: string | null; partner_message_id?: string | null; group_message_id?: string | null;
}
export interface ChatAttachment { path: string; mime: string; type: ChatMediaType; durationMs?: number }
export const CHAT_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏'] as const;
export const chatTable = (kind: ChatKind) => kind === 'group' ? 'group_messages' : kind === 'partner' ? 'partner_messages' : 'direct_messages';
export const reactionColumn = (kind: ChatKind) => kind === 'group' ? 'group_message_id' : kind === 'partner' ? 'partner_message_id' : 'direct_message_id';
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
  'audio/mp4': 'm4a', 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/wav': 'wav',
};
export function chatError(error: unknown): string {
  const code = (error as { message?: string; code?: string })?.message ?? '';
  if (/CHAT_GROUP_BLOCKED|CHAT_GROUP_UNBLOCK_FIRST/.test(code)) return tr('group_blocked');
  if (/CHAT_GROUP_ADMINS_ONLY/.test(code)) return tr('group_admins_only');
  if (/CHAT_TAG_OWN_GROUPS_ONLY/.test(code)) return tr('group_tag_note');
  if (/CHAT_(GROUP_ADMIN|GROUP_OWNER)_REQUIRED/.test(code)) return tr('chat_admin_only', 'Bu əməliyyatı qrup administratoru edə bilər.');
  if (/CHAT_GROUP_(MEMBERSHIP_REQUIRED|INVITE_REQUIRED|UNAVAILABLE)/.test(code)) return tr('chat_group_access', 'Qrupa girişiniz yoxdur və ya qrup artıq aktiv deyil.');
  if (/CHAT_ACCOUNT_(CHANGED|BLOCKED)/.test(code)) return tr('chat_account_unavailable', 'Hesabı və giriş icazəsini yoxlayın.');
  if (/CHAT_GROUP_FULL/.test(code)) return tr('chat_group_full', 'Qrupun üzv limiti dolub.');
  if (/CHAT_(INVALID_MEDIA|MEDIA_TOO_LARGE)/.test(code)) return tr('chat_media_invalid', 'Uyğun şəkil, səs və ya 25 MB-dan kiçik video seçin.');
  if ((error as { code?: string })?.code === 'PGRST202') return tr('chat_update_pending', 'Mesajlaşma yenilənməsi serverdə hələ hazır deyil. Bir qədər sonra yenidən yoxlayın.');
  return tr('chat_action_failed', 'Əməliyyat alınmadı. Bağlantını yoxlayıb yenidən cəhd edin.');
}
export function chatPreview(message: Pick<ChatMessage, 'content' | 'message_type'>) {
  if (message.message_type === 'image') return tr('chat_image', 'Şəkil');
  if (message.message_type === 'audio') return tr('chat_voice', 'Səs mesajı');
  if (message.message_type === 'video') return tr('chat_video', 'Video');
  return message.content || tr('chat_message', 'Mesaj');
}

export async function notifyChatMessage(kind: ChatKind, target: string, message: ChatMessage): Promise<void> {
  const { invokeSendPush } = await import('@/lib/push');
  const title = tr('directmessages_yeni_mesaj', 'Yeni mesaj');
  const body = chatPreview(message).slice(0, 120) || title;
  if (kind === 'group') {
    const { data, error } = await (supabase as any).rpc('chat_group_members_v2', { p_group: target });
    if (error) return;
    const recipients = (data || []).filter((member: { user_id: string }) => member.user_id !== message.sender_id);
    for (let offset = 0; offset < recipients.length; offset += 4) await Promise.all(recipients.slice(offset, offset + 4).map((member: { user_id: string }) =>
      invokeSendPush({ userId: member.user_id, title, body, kind: 'group_message', data: {
        type: 'group_message', context: 'group_message', groupId: target, messageId: message.id, interactionId: message.id,
      } })));
  } else {
    await invokeSendPush({ userId: target, title, body, kind: kind === 'partner' ? 'partner_message' : 'direct_message',
      data: kind === 'partner' ? { type: 'partner_message', context: 'partner', messageId: message.id, interactionId: message.id }
        : { type: 'direct_message', context: 'direct_message', sender_id: message.sender_id, messageId: message.id, interactionId: message.id } });
  }
}

export async function uploadChatMedia(actor: string, kind: ChatKind, target: string, file: Blob, type: ChatMediaType, signal?: AbortSignal): Promise<ChatAttachment | null> {
  const mime = file.type.toLowerCase().split(';')[0];
  const ext = MIME_EXTENSIONS[mime];
  if (!ext || !mime.startsWith(`${type}/`) || file.size === 0) throw new Error('CHAT_INVALID_MEDIA');
  if (file.size > (type === 'image' ? 10 : 25) * 1024 * 1024) throw new Error('CHAT_MEDIA_TOO_LARGE');
  if (signal?.aborted) return null;
  const path = `${actor}/${kind}/${target}/${crypto.randomUUID()}.${ext}`;
  // Blob uploads use the multipart part's type, even when contentType is supplied.
  // Keep codec information in the encoded bytes, with a canonical bucket MIME.
  const payload = file.type === mime ? file : file.slice(0, file.size, mime);
  const { error } = await supabase.storage.from('conversation-media').upload(path, payload, { contentType: mime, upsert: false });
  if (error) throw error;
  if (signal?.aborted) {
    try { const { error: removal } = await supabase.storage.from('conversation-media').remove([path]); if (removal) throw removal; }
    catch { console.error('Failed to remove cancelled chat media upload'); }
    return null;
  }
  return { path, mime, type };
}

export async function discardChatAttachment(path: string): Promise<void> {
  // Storage RLS rejects removal once a persisted message references this path.
  try { await supabase.storage.from('conversation-media').remove([path]); } catch { /* Never erase a sent message to clean an upload. */ }
}

export async function resolveChatMedia(message: ChatMessage): Promise<string | null> {
  if (message.media_path) {
    const { data, error } = await supabase.storage.from('conversation-media').createSignedUrl(message.media_path, 300);
    if (error) throw error;
    return data.signedUrl;
  }
  const legacy = message.media_url || (['audio', 'image', 'video'].includes(message.message_type) ? message.content : null);
  if (!legacy) return null;
  let url: URL;
  try { url = new URL(legacy); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  const ownHosts = [new URL(getBackendConfig().url).hostname, 'api.anacan.az', 'tntbjulojatnrqmylorp.supabase.co',
    'anacan-gateway.grayocean-6fd65b89.westeurope.azurecontainerapps.io'];
  const match = /^\/storage\/v1\/object\/(public|sign)\/(chat-media|conversation-media)\/(.+)$/.exec(url.pathname);
  if (ownHosts.includes(url.hostname) && match) {
    let path: string;
    try { path = decodeURIComponent(match[3]); } catch { return null; }
    if (path.startsWith('/') || path.includes('\\') || path.includes('\0') || path.split('/').some(part => !part || part === '..' || part === '.')) return null;
    // Sign with the selected backend only. Never forward an Azure session to Source.
    const { data, error } = await supabase.storage.from(match[2]).createSignedUrl(path, 300);
    if (!error && data?.signedUrl) return data.signedUrl;
    // Only URLs originally published in the legacy public bucket may use the
    // public compatibility path. Private conversation media is never downgraded.
    if (match[1] === 'public' && match[2] === 'chat-media') return supabase.storage.from('chat-media').getPublicUrl(path).data.publicUrl;
    throw error || new Error('CHAT_MEDIA_SIGNING_FAILED');
  }
  return url.href;
}
