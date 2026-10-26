import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Check, CheckCheck, ChevronDown, ImagePlus, Loader2, Mic, MoreHorizontal, Plus, Reply, Send, Smile, Square, Trash2, Video, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useFullScreenChat } from '@/hooks/useChatChrome';
import { useAdSafetyBlock } from '@/components/ads/AdExperienceProvider';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { createAudioRecorder, getAudioErrorToast, openMicrophone, releaseAudioRecording } from '@/lib/audioRecording';
import { CHAT_REACTIONS, chatError, chatPreview, discardChatAttachment, reactionColumn, resolveChatMedia, uploadChatMedia, type ChatAttachment, type ChatKind, type ChatMessage, type ChatMediaType } from '@/lib/chat';
import { getLocaleTag } from '@/lib/i18n';
import { pushBackHandler } from '@/lib/backButton';
import { tr } from '@/lib/group-i18n';
import PhotoGalleryViewer from '@/components/PhotoGalleryViewer';
import VoiceMessage from './VoiceMessage';
import ChatMediaAttachment from './ChatMediaAttachment';
import CommentText from '@/components/community/CommentText';
import '@/styles/chat.css';
import { useMyModerationStatus } from '@/hooks/useModerator';
import RestrictionNote from '@/components/moderation/RestrictionNote';

const UserProfile = lazy(() => import('@/components/community/UserProfileScreen'));
interface Props { kind: ChatKind; target: string; title: string; avatar?: string | null; subtitle?: string;
  onBack: () => void; onDetails?: () => void; canModerate?: boolean; readOnly?: boolean }

const NO_REACTIONS: never[] = [];

export default function ConversationScreen(props: Props) {
  const { user } = useAuth();
  return <Conversation key={`${props.kind}:${props.target}:${user?.id}`} {...props} />;
}

function Conversation({ kind, target, title, avatar, subtitle, onBack, onDetails, canModerate = false, readOnly: inheritedReadOnly = false }: Props) {
  useFullScreenChat(); useAdSafetyBlock(true);
  const { data: moderationStatus } = useMyModerationStatus();
  const readOnly = inheritedReadOnly || !!moderationStatus?.message;
  const chat = useChatMessages(kind, target), { toast } = useToast();
  const [text, setText] = useState(''), [reply, setReply] = useState<ChatMessage | null>(null);
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null), [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false), [recording, setRecording] = useState(false), [recordedSeconds, setRecordedSeconds] = useState(0);
  const [showAttachments, setShowAttachments] = useState(false), [emojiComposer, setEmojiComposer] = useState(false);
  const [actionsFor, setActionsFor] = useState<string | null>(null), [profile, setProfile] = useState<string | null>(null);
  const [photo, setPhoto] = useState<{ id: string; url: string } | null>(null), [newMessages, setNewMessages] = useState(0);
  const [viewport, setViewport] = useState(() => ({ height: window.visualViewport?.height ?? window.innerHeight, top: window.visualViewport?.offsetTop ?? 0 }));
  const scroller = useRef<HTMLDivElement>(null), input = useRef<HTMLTextAreaElement>(null), imageInput = useRef<HTMLInputElement>(null), videoInput = useRef<HTMLInputElement>(null);
  const stream = useRef<MediaStream | null>(null), recorder = useRef<MediaRecorder | null>(null), timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const controller = useRef<AbortController | null>(null), alive = useRef(true), atBottom = useRef(true), lastMessage = useRef<string | null>(null);
  const chunks = useRef<Blob[]>([]), recordingStarted = useRef(0), hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retry = useRef<{ fingerprint: string; id: string } | null>(null), backRef = useRef(onBack);
  const attachmentRef = useRef<ChatAttachment | null>(null), sendAttempted = useRef(false);
  backRef.current = onBack;
  const cleanupRecording = () => {
    if (timer.current) clearInterval(timer.current); timer.current = null;
    releaseAudioRecording(recorder.current, stream.current); recorder.current = null; stream.current = null; chunks.current = [];
  };
  const cancelRecording = () => {
    controller.current?.abort(); controller.current = null; cleanupRecording();
    if (alive.current) { setRecording(false); setUploading(false); setRecordedSeconds(0); }
  };
  useEffect(() => { if (readOnly) cancelRecording(); }, [readOnly]);
  useEffect(() => {
    alive.current = true;
    // visualViewport hadisələri kadr başına bir dəfə emal olunur; dəyər dəyişməyibsə state yenilənmir
    let viewportFrame = 0;
    const resize = () => {
      if (viewportFrame) return;
      viewportFrame = requestAnimationFrame(() => {
        viewportFrame = 0;
        const height = window.visualViewport?.height ?? window.innerHeight, top = window.visualViewport?.offsetTop ?? 0;
        setViewport(current => current.height === height && current.top === top ? current : { height, top });
      });
    };
    window.visualViewport?.addEventListener('resize', resize); window.visualViewport?.addEventListener('scroll', resize);
    const background = () => { if (document.visibilityState === 'hidden') cancelRecording(); };
    document.addEventListener('visibilitychange', background);
    return () => { alive.current = false; cancelRecording(); if (hold.current) clearTimeout(hold.current);
      if (attachmentRef.current && !sendAttempted.current) void discardChatAttachment(attachmentRef.current.path);
      document.removeEventListener('visibilitychange', background); window.visualViewport?.removeEventListener('resize', resize); window.visualViewport?.removeEventListener('scroll', resize);
      if (viewportFrame) cancelAnimationFrame(viewportFrame); };
  }, []);
  useEffect(() => pushBackHandler(() => {
    if (photo) setPhoto(null); else if (profile) setProfile(null); else if (actionsFor) setActionsFor(null);
    else { cancelRecording(); backRef.current(); }
    return true;
  }), [photo, profile, actionsFor]);
  useEffect(() => {
    const latest = chat.messages[chat.messages.length - 1];
    if (!latest || latest.id === lastMessage.current) return;
    if (!lastMessage.current || atBottom.current || latest.sender_id === chat.actor) {
      requestAnimationFrame(() => { const element = scroller.current; if (element) element.scrollTop = element.scrollHeight; });
    } else setNewMessages(count => count + 1);
    lastMessage.current = latest.id;
  }, [chat.messages, chat.actor]);
  useEffect(() => {
    const element = input.current;
    if (element) { element.style.height = 'auto'; element.style.height = `${Math.min(130, element.scrollHeight)}px`; }
  }, [text]);

  const reportFailure = (error: unknown) => toast({ title: chatError(error), variant: 'destructive' });
  // Reaksiyalar mesaj id-sinə görə bir dəfə qruplaşdırılır (hər mesaj üçün filter əvəzinə)
  const reactionsByMessage = useMemo(() => {
    const column = reactionColumn(kind), map = new Map<string, typeof chat.reactions>();
    for (const reaction of chat.reactions) {
      const id = reaction[column] as string | null | undefined;
      if (!id) continue;
      const list = map.get(id);
      if (list) list.push(reaction); else map.set(id, [reaction]);
    }
    return map;
  }, [chat.reactions, kind]);
  // Tarix/saat formatlayıcıları hər render-də yox, dil dəyişəndə yaradılır
  const localeTag = getLocaleTag();
  const dayFormat = useMemo(() => new Intl.DateTimeFormat(localeTag, { day: 'numeric', month: 'long' }), [localeTag]);
  const timeFormat = useMemo(() => new Intl.DateTimeFormat(localeTag, { hour: '2-digit', minute: '2-digit' }), [localeTag]);
  const upload = async (file: Blob, type: ChatMediaType, ownController = new AbortController(), durationMs?: number) => {
    if (!chat.actor || uploading || chat.sending || readOnly) return;
    controller.current = ownController; setUploading(true); setShowAttachments(false);
    try {
      const result = await uploadChatMedia(chat.actor, kind, target, file, type, ownController.signal);
      if (!result || !alive.current || ownController.signal.aborted) return;
      const uploaded = { ...result, durationMs };
      attachmentRef.current = uploaded; sendAttempted.current = false;
      setAttachment(uploaded);
      const url = await resolveChatMedia({ id: 'preview', sender_id: chat.actor, created_at: '', message_type: type,
        content: '', media_path: result.path, media_mime: result.mime });
      if (alive.current && !ownController.signal.aborted) setAttachmentUrl(url);
    } catch (error) { if (!ownController.signal.aborted && alive.current) reportFailure(error); }
    finally { if (controller.current === ownController) controller.current = null; if (alive.current && !ownController.signal.aborted) setUploading(false); }
  };
  const beginRecording = async () => {
    if (controller.current || uploading || attachment || chat.sending || readOnly) return;
    const ownController = new AbortController(); controller.current = ownController;
    let captured: MediaStream | null = null;
    try {
      captured = await openMicrophone();
      if (ownController.signal.aborted || !alive.current) { releaseAudioRecording(null, captured); return; }
      stream.current = captured; const audioRecorder = createAudioRecorder(captured); recorder.current = audioRecorder; chunks.current = [];
      audioRecorder.ondataavailable = event => { if (!ownController.signal.aborted && event.data.size) chunks.current.push(event.data); };
      audioRecorder.onstop = () => {
        if (ownController.signal.aborted) return;
        const durationMs = Math.min(180000, Date.now() - recordingStarted.current);
        const file = new Blob(chunks.current, { type: audioRecorder.mimeType || chunks.current[0]?.type });
        cleanupRecording(); setRecording(false);
        void upload(file, 'audio', ownController, durationMs);
      };
      audioRecorder.onerror = error => { cancelRecording(); toast(getAudioErrorToast(error, 'audio')); };
      recordingStarted.current = Date.now(); audioRecorder.start(500); setRecording(true); setRecordedSeconds(0);
      timer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStarted.current) / 1000); setRecordedSeconds(elapsed);
        if (elapsed >= 180 && audioRecorder.state === 'recording') audioRecorder.stop();
      }, 1000);
    } catch (error) { if (!ownController.signal.aborted) { cancelRecording(); toast(getAudioErrorToast(error, captured ? 'audio' : 'microphone')); } }
  };
  const stopRecording = () => { try { if (recorder.current?.state === 'recording') recorder.current.stop(); } catch (error) { cancelRecording(); toast(getAudioErrorToast(error, 'audio')); } };
  const send = async () => {
    if (uploading || chat.sending || readOnly || (!text.trim() && !attachment)) return;
    const payload = { text: text.trim(), attachment, replyTo: reply?.id ?? null };
    const fingerprint = JSON.stringify(payload);
    const attempt = retry.current?.fingerprint === fingerprint ? retry.current : { fingerprint, id: crypto.randomUUID() };
    retry.current = attempt;
    sendAttempted.current = true;
    try {
      await chat.send({ id: attempt.id, ...payload });
      if (!alive.current) return;
      setText(''); setReply(null); setAttachment(null); setAttachmentUrl(null); attachmentRef.current = null; retry.current = null; atBottom.current = true;
      input.current?.focus();
    } catch (error) { if (alive.current) reportFailure(error); }
  };
  const renew = async (message: ChatMessage) => {
    return chat.renewMedia(message);
  };
  const loadOlder = async () => {
    const before = scroller.current?.scrollHeight ?? 0;
    await chat.loadOlder();
    requestAnimationFrame(() => { if (scroller.current) scroller.current.scrollTop += scroller.current.scrollHeight - before; });
  };
  const selectEmoji = (emoji: string) => {
    const start = input.current?.selectionStart ?? text.length, end = input.current?.selectionEnd ?? start;
    setText(value => value.slice(0, start) + emoji + value.slice(end)); input.current?.focus();
  };
  const content = profile ? <Suspense fallback={<div className="chat-empty"><Loader2 className="animate-spin" /></div>}>
    <UserProfile userId={profile} onBack={() => setProfile(null)} onUserClick={setProfile} />
  </Suspense> : <>
    <header className="chat-topbar">
      <button type="button" className="chat-icon-button" aria-label={tr('common_geri', 'Geri')} onClick={() => { cancelRecording(); onBack(); }}><ArrowLeft size={21} className="rtl:rotate-180" /></button>
      <button type="button" className="chat-topbar-profile" onClick={() => kind === 'group' ? onDetails?.() : setProfile(target)} aria-label={tr('chat_view_profile', 'Profilə bax')}>
        <Avatar className="h-10 w-10"><AvatarImage src={avatar || undefined} /><AvatarFallback>{title.charAt(0) || '💬'}</AvatarFallback></Avatar>
        <span className="min-w-0"><span className="chat-topbar-name block">{title}</span>
          <span className="chat-topbar-subtitle block">{subtitle || tr('chat_profile_hint', 'Profilə baxmaq üçün toxunun')}</span></span>
      </button>
      {kind === 'group' && <button type="button" className="chat-icon-button" onClick={onDetails} aria-label={tr('chat_group_details', 'Qrup məlumatları')}><MoreHorizontal size={22} /></button>}
    </header>
    <div className="chat-history" ref={scroller} data-scroll-ignore onScroll={() => {
      const element = scroller.current; if (element) { atBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 90; if (atBottom.current) setNewMessages(0); }
    }}>
      <div className="chat-history-inner">
        {chat.hasOlder && <button type="button" className="chat-notice w-full" disabled={chat.loadingOlder} onClick={loadOlder}>{chat.loadingOlder ? '…' : tr('chat_older', 'Əvvəlki mesajları göstər')}</button>}
        {chat.loading ? <div className="chat-empty"><Loader2 className="animate-spin" /></div> : chat.error ? <div className="chat-empty" role="alert">
          <p>{chatError(chat.error)}</p><button type="button" onClick={() => chat.refetch()}>{tr('chat_retry', 'Yenidən cəhd et')}</button>
        </div> : chat.messages.length === 0 ? <div className="chat-empty"><Avatar className="h-16 w-16"><AvatarImage src={avatar || undefined} /><AvatarFallback>{title.charAt(0)}</AvatarFallback></Avatar>
          <strong>{title}</strong><p>{tr('chat_empty', 'İlk mesajı göndərin. Söhbət buradan başlayır.')}</p></div> : null}
        {chat.messages.map((message, index) => {
          const own = message.sender_id === chat.actor, quoted = message.reply_to_id ? chat.allMessages.get(message.reply_to_id) : null;
          const author = chat.authors[message.sender_id], url = chat.media[message.id];
          const created = new Date(message.created_at);
          const previous = chat.messages[index - 1];
          const showDate = !previous || new Date(previous.created_at).toDateString() !== created.toDateString();
          const reactions = reactionsByMessage.get(message.id) ?? NO_REACTIONS;
          const grouped = [...new Set(reactions.map(reaction => reaction.emoji))];
          return <div key={message.id} id={`chat-message-${message.id}`}>
            {showDate && <div className="chat-day">{dayFormat.format(created)}</div>}
            <div className={`chat-message-row ${own ? 'chat-message-row-own' : ''}`}>
              {kind === 'group' && !own && <button type="button" onClick={() => setProfile(message.sender_id)} aria-label={tr('chat_view_profile', 'Profilə bax')}><Avatar className="h-7 w-7"><AvatarImage src={author?.avatar_url || undefined} /><AvatarFallback>{author?.name?.charAt(0) || '•'}</AvatarFallback></Avatar></button>}
              <div className="chat-message-stack">
                <div className={`chat-message ${own ? 'chat-message-own' : ''}`} onContextMenu={event => { event.preventDefault(); setActionsFor(message.id); }}>
                  {kind === 'group' && !own && <button type="button" className="chat-message-author" onClick={() => setProfile(message.sender_id)}>{author?.name || tr('chat_member', 'Üzv')}</button>}
                  {quoted && <button type="button" className="chat-reply-preview w-full text-start" onClick={() => document.getElementById(`chat-message-${quoted.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                    <strong>{quoted.sender_id === chat.actor ? tr('chat_you', 'Siz') : chat.authors[quoted.sender_id]?.name || title}</strong><p>{chatPreview(quoted)}</p></button>}
                  {['image', 'video', 'audio'].includes(message.message_type) ? url ?
                    <ChatMediaAttachment src={url} type={message.message_type as ChatMediaType} own={own} onRenew={() => renew(message)} onPhoto={source => setPhoto({ id: message.id, url: source })} />
                    : <button type="button" className="chat-notice" onClick={() => renew(message).catch(reportFailure)}>{tr('chat_load_media', 'Faylı yüklə')}</button>
                    : <p className="chat-message-text" dir="auto"><CommentText content={message.message_type === 'love' ? '❤️' : message.content || ''} allowLinks /></p>}
                  {!!message.media_path && !!message.content && <p className="chat-message-text mt-1" dir="auto"><CommentText content={message.content} allowLinks /></p>}
                  <div className="chat-message-meta"><time>{timeFormat.format(created)}</time>
                    {own && kind !== 'group' && (message.is_read ? <CheckCheck size={13} className="text-sky-600" /> : <Check size={12} />)}
                    <button type="button" className="chat-icon-button chat-icon-button-small" onClick={() => setActionsFor(actionsFor === message.id ? null : message.id)} aria-label={tr('chat_message_actions', 'Mesaj seçimləri')}><MoreHorizontal size={15} /></button>
                  </div>
                </div>
                {grouped.length > 0 && <div className="chat-reactions">{grouped.map(emoji => {
                  const selected = reactions.some(reaction => reaction.user_id === chat.actor && reaction.emoji === emoji);
                  return <button type="button" key={emoji} className="chat-reaction" data-selected={selected} disabled={chat.reacting}
                    onClick={() => chat.react({ message: message.id, emoji: selected ? null : emoji }).catch(reportFailure)}>{emoji} {reactions.filter(reaction => reaction.emoji === emoji).length}</button>;
                })}</div>}
                {actionsFor === message.id && <div className="chat-reaction-picker" role="group" aria-label={tr('chat_react', 'Reaksiya ver')}>
                  <button type="button" aria-label={tr('chat_reply', 'Cavab ver')} onClick={() => { setReply(message); setActionsFor(null); input.current?.focus(); }}><Reply size={18} /></button>
                  {CHAT_REACTIONS.map(emoji => <button type="button" key={emoji} disabled={chat.reacting} aria-label={emoji} onClick={() => {
                    const selected = reactions.some(reaction => reaction.user_id === chat.actor && reaction.emoji === emoji);
                    void chat.react({ message: message.id, emoji: selected ? null : emoji }).then(() => setActionsFor(null)).catch(reportFailure);
                  }}>{emoji}</button>)}
                  {kind === 'group' && (own || canModerate) && <button type="button" className="text-destructive" aria-label={tr('group_delete_message')} disabled={chat.removing} onClick={() => {
                    if (confirm(tr('group_delete_message') + '?')) void chat.remove(message.id).then(() => { setActionsFor(null); if (reply?.id === message.id) setReply(null); }).catch(reportFailure);
                  }}><Trash2 size={17}/></button>}
                </div>}
              </div>
            </div>
          </div>;
        })}
      </div>
    </div>
    {newMessages > 0 && <button type="button" className="chat-notice flex items-center justify-center gap-1" onClick={() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; setNewMessages(0); }}><ChevronDown size={15} />{tr('chat_new_messages', 'Yeni mesajlar')} · {newMessages}</button>}
    {readOnly ? <footer className="chat-composer chat-notice">{moderationStatus?.message ? <RestrictionNote scope="message" /> : tr('group_admins_only')}</footer> : <footer className="chat-composer"><div className="chat-composer-inner">
      {reply && <div className="flex items-center gap-2"><div className="chat-reply-preview flex-1"><strong>{tr('chat_reply', 'Cavab ver')} · {reply.sender_id === chat.actor ? tr('chat_you', 'Siz') : chat.authors[reply.sender_id]?.name || title}</strong><p>{chatPreview(reply)}</p></div><button type="button" className="chat-icon-button" aria-label={tr('chat_cancel_reply', 'Cavabı ləğv et')} onClick={() => setReply(null)}><X size={18} /></button></div>}
      {attachment && <div className="flex items-center gap-2 pb-2"><div className="min-w-0 flex-1">
        {attachment.type === 'audio' && attachmentUrl ? <VoiceMessage src={attachmentUrl} /> : <p className="chat-notice text-start">{chatPreview({ message_type: attachment.type, content: '' })} · {tr('chat_ready_to_send', 'Göndərməyə hazırdır')}</p>}
      </div><button type="button" className="chat-icon-button" aria-label={tr('chat_remove_attachment', 'Faylı sil')} onClick={() => {
        if (attachmentRef.current && !sendAttempted.current) void discardChatAttachment(attachmentRef.current.path);
        attachmentRef.current = null; setAttachment(null); setAttachmentUrl(null);
      }}><X size={18} /></button></div>}
      {showAttachments && <div className="chat-attachment-options"><button type="button" onClick={() => imageInput.current?.click()}><ImagePlus size={18} />{tr('chat_image', 'Şəkil')}</button><button type="button" onClick={() => videoInput.current?.click()}><Video size={18} />{tr('chat_video', 'Video')}</button></div>}
      {emojiComposer && <div className="chat-reaction-picker">{['😊', '❤️', '😂', '👍', '🙏', '😘', '🥰', '🎉'].map(emoji => <button type="button" key={emoji} onClick={() => selectEmoji(emoji)}>{emoji}</button>)}</div>}
      <input type="file" ref={imageInput} accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file, 'image'); }} />
      <input type="file" ref={videoInput} accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file, 'video'); }} />
      {recording ? <div className="chat-recording"><span className="chat-recording-dot" /><span className="text-sm tabular-nums">{Math.floor(recordedSeconds / 60)}:{String(recordedSeconds % 60).padStart(2, '0')}</span><span className="flex-1 text-xs">{tr('chat_recording', 'Səs yazılır…')}</span>
        <button type="button" className="chat-icon-button" onClick={cancelRecording} aria-label={tr('common_legv_et', 'Ləğv et')}><X size={19} /></button><button type="button" className="chat-send" onClick={stopRecording} aria-label={tr('chat_stop_recording', 'Səs yazısını bitir')}><Square size={16} /></button></div>
        : <div className="chat-compose-row">
          <button type="button" className="chat-icon-button" disabled={uploading || chat.sending || !!attachment} onClick={() => setShowAttachments(value => !value)} aria-label={tr('chat_attach', 'Fayl əlavə et')}><Plus size={23} /></button>
          <textarea ref={input} rows={1} maxLength={10000} value={text} disabled={chat.sending} onChange={event => setText(event.target.value)} className="chat-text-input" dir="auto"
            placeholder={tr('directmessagescreen_mesaj_yazin_e69f84', 'Mesaj yazın…')} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} />
          <button type="button" className="chat-icon-button" disabled={chat.sending} onClick={() => setEmojiComposer(value => !value)} aria-label={tr('chat_emoji', 'Emoji')}><Smile size={21} /></button>
          {!text.trim() && !attachment && !uploading ? <button type="button" className="chat-send" disabled={chat.sending} onClick={beginRecording} aria-label={tr('conversationlistscreen_ses_mesaji_acd8d9', '🎤 Səs mesajı')}><Mic size={20} /></button>
            : <button type="button" className="chat-send" disabled={uploading || chat.sending || (!text.trim() && !attachment)} onClick={send} aria-label={tr('directmessagescreen_send', 'Göndər')}>{uploading || chat.sending ? <Loader2 size={19} className="animate-spin" /> : <Send size={18} />}</button>}
        </div>}
      {uploading && <p role="status" className="chat-notice">{tr('chat_uploading', 'Fayl yüklənir…')}</p>}
    </div></footer>}
  </>;
  return createPortal(<section className="chat-screen a-scope" aria-label={title} data-ad-block="true" data-no-swipe
    style={{ height: viewport.height, top: viewport.top, bottom: 'auto' }}>
    {content}
    {photo && <PhotoGalleryViewer photos={[photo]} initialIndex={0} isOpen onClose={() => setPhoto(null)} />}
  </section>, document.body);
}
