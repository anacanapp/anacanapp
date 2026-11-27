import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Image, Video, Send, Loader2, Play, Smile, Hash, AtSign, EyeOff, X, Languages } from 'lucide-react';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { CommunityGroup, useCreatePost } from '@/hooks/useCommunity';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { hapticFeedback } from '@/lib/native';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from 'next-themes';
import { useUserStore } from '@/store/userStore';
import { detectLang, FEED_LANGS, FeedLang, isFeedLang } from '@/lib/langDetect';
import { tr } from "@/lib/tr";
import { GroupTagPicker } from './GroupPostTags';
import { useBlogAttachment } from '@/hooks/useBlogAttachment';
import BlogAttachmentPicker from './BlogAttachmentPicker';
import { blogCommand, type SharedBlog, validSharedBlog } from '@/lib/community-blog';
import { feature37Text } from '@/lib/feature37-i18n';
import { useMyModerationStatus } from '@/hooks/useModerator';
import RestrictionNote from '@/components/moderation/RestrictionNote';
import { compressImageForUpload } from '@/lib/image-compress';

interface CreatePostScreenProps {
  onBack: () => void;
  groupId: string | null;
  groups: CommunityGroup[];
  initialBlog?: SharedBlog | null;
}

interface Suggestion {
  type: 'user' | 'hashtag';
  value: string;
  display: string;
  avatar?: string;
}

const POPULAR_HASHTAGS = [
  tr("createpostscreen_hamilelik_64e7fe", "hamil\u0259lik"),
  tr("createpostscreen_ana_hashtag", "ana"),
  tr("createpostscreen_korpe_4abca7", "k\xF6rp\u0259"),
  tr("createpostscreen_saglamliq_d183d2", "sa\u011Flaml\u0131q"),
  tr("createpostscreen_qidalanma_hashtag", "qidalanma"),
  tr("createpostscreen_dogus_01c8e6", "do\u011Fu\u015F"),
  tr("createpostscreen_emzirme_1e11e5", "\u0259mzirm\u0259"),
  tr("createpostscreen_yuxu_hashtag", "yuxu"),
  tr("createpostscreen_inkisaf_abc234", "inki\u015Faf"),
  tr("createpostscreen_oyun_hashtag", "oyun"),
  tr("createpostscreen_aile_894dfb", "ail\u0259"),
  tr("createpostscreen_sevgi_hashtag", "sevgi"),
  tr("createpostscreen_xosbextlik_55f22a", "xo\u015Fb\u0259xtlik"),
  tr("createpostscreen_analar_hashtag", "analar"),
  tr("createpostscreen_usaq_36b348", "u\u015Faq")
];


const CreatePostScreen = ({ onBack, groupId, groups, initialBlog }: CreatePostScreenProps) => {
  const [content, setContent] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(groupId);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<{url: string;type: 'image' | 'video';}[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [taggedGroupIds, setTaggedGroupIds] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  // Post dili: null = avtomatik aşkarlama; istifadəçi çipə toxunsa manual olur
  const [manualLang, setManualLang] = useState<FeedLang | null>(null);

  const uiLang = useUserStore((s) => s.language);
  const fallbackLang: FeedLang = isFeedLang(uiLang) ? uiLang : 'az';
  const detectedLang = useMemo(() => detectLang(content, fallbackLang), [content, fallbackLang]);
  const postLang: FeedLang = manualLang ?? detectedLang;

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Every preview blob URL ever created here; revoked on unmount so leaving the
  // screen without submitting/closing does not leak the selected media.
  const previewUrlsRef = useRef<Set<string>>(new Set());
  const createPreviewUrl = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    previewUrlsRef.current.add(url);
    return url;
  }, []);
  useEffect(() => () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current.clear();
  }, []);
  const blog = useBlogAttachment(content, setContent, textareaRef);
  useEffect(() => { if (validSharedBlog(initialBlog)) blog.setSelected(initialBlog); }, [initialBlog]);

  const createPost = useCreatePost();
  const { data: moderationStatus } = useMyModerationStatus();
  const { toast } = useToast();
  const { theme } = useTheme();

  const searchUsers = useCallback(async (term: string) => {
    if (!term) return [];
    const { data } = await supabase.from('public_profile_cards').select('user_id, name, avatar_url').ilike('name', `%${term}%`).limit(5);
    return (data || []).map((user) => ({ type: 'user' as const, value: user.name || tr("createpostscreen_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i"), display: user.name || tr("createpostscreen_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i"), avatar: user.avatar_url }));
  }, []);

  const searchHashtags = useCallback((term: string): Suggestion[] => {
    return POPULAR_HASHTAGS.filter((tag) => tag.toLowerCase().includes(term.toLowerCase())).slice(0, 5).map((tag) => ({ type: 'hashtag' as const, value: tag, display: `#${tag}` }));
  }, []);

  const handleContentChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    const cursorPos = e.target.selectionStart;
    setContent(newContent);
    setCursorPosition(cursorPos);
    blog.setCursor(cursorPos);
    if (blogCommand(newContent, cursorPos)) { setShowSuggestions(false); setSuggestions([]); return; }
    const textBeforeCursor = newContent.substring(0, cursorPos);
    const words = textBeforeCursor.split(/\s/);
    const currentWord = words[words.length - 1];

    if (currentWord.startsWith('@') && currentWord.length > 1) {
      const userSuggestions = await searchUsers(currentWord.substring(1));
      setSuggestions(userSuggestions);
      setShowSuggestions(userSuggestions.length > 0);
    } else if (currentWord.startsWith('#') && currentWord.length > 1) {
      const hashtagSuggestions = searchHashtags(currentWord.substring(1));
      setSuggestions(hashtagSuggestions);
      setShowSuggestions(hashtagSuggestions.length > 0);
    } else {
      setShowSuggestions(false);setSuggestions([]);
    }
  };

  const applySuggestion = (suggestion: Suggestion) => {
    const textBeforeCursor = content.substring(0, cursorPosition);
    const textAfterCursor = content.substring(cursorPosition);
    const words = textBeforeCursor.split(/\s/);
    words[words.length - 1] = suggestion.type === 'hashtag' ? `#${suggestion.value}` : `@${suggestion.value}`;
    setContent(words.join(' ') + ' ' + textAfterCursor);
    setShowSuggestions(false);setSuggestions([]);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleEmojiSelect = (emojiData: EmojiClickData) => {
    const emoji = emojiData.emoji;
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      setContent(content.substring(0, start) + emoji + content.substring(end));
      setTimeout(() => {textarea.selectionStart = textarea.selectionEnd = start + emoji.length;textarea.focus();}, 0);
    } else {
      setContent((prev) => prev + emoji);
    }
    setShowEmojiPicker(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (files.length + mediaFiles.length > 4) {toast({ title: tr("createpostscreen_limit_asildi_30a129", 'Limit aşıldı'), description: 'Maximum 4 fayl', variant: 'destructive' });return;}
    const maxSize = type === 'video' ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (files.some((f) => f.size > maxSize)) {toast({ title: tr("createpostscreen_fayl_cox_boyukdur_f5cf61", 'Fayl çox böyükdür'), description: type === 'video' ? 'Max 50MB' : 'Max 10MB', variant: 'destructive' });return;}
    setMediaFiles((prev) => [...prev, ...files]);
    setMediaPreviews((prev) => [...prev, ...files.map((file) => ({ url: createPreviewUrl(file), type }))]);
    if (e.target) e.target.value = '';
  };

  const uploadMedia = async (): Promise<string[]> => {
    if (mediaFiles.length === 0) return [];
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const urls: string[] = [];
    for (const original of mediaFiles) {
      const file = await compressImageForUpload(original);
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { error } = await supabase.storage.from('community-media').upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (error) throw new Error(`${tr("community_file_upload_failed", "Fayl yüklənə bilmədi:")} ${error.message}`);
      const { data: { publicUrl } } = supabase.storage.from('community-media').getPublicUrl(fileName);
      urls.push(publicUrl);
    }
    return urls;
  };

  const handleSubmit = async () => {
    if (moderationStatus?.post) return;
    if (!content.trim() && mediaFiles.length === 0 && !blog.selected) {toast({ title: tr("createpostscreen_bos_paylasim_47b52d", 'Boş paylaşım'), description: tr("createpostscreen_metn_yazin_ve_ya_media_elave_edin_18fa25", 'Mətn yazın və ya media əlavə edin'), variant: 'destructive' });return;}
    hapticFeedback.medium();
    setIsUploading(true);
    try {
      const mediaUrls = await uploadMedia();
      await createPost.mutateAsync({ groupId: selectedGroupId, content: content.trim() || (blog.selected ? '📖' : '📷'), mediaUrls, isAnonymous, language: postLang, autoLanguage: manualLang === null, taggedGroupIds, blogPostId: blog.selected?.id });
      blog.setSelected(null);
      mediaPreviews.forEach((p) => URL.revokeObjectURL(p.url));
      setContent('');setMediaFiles([]);setMediaPreviews([]);
      onBack();
    } catch (error) {
      toast({ title: tr("createpostscreen_xeta_3cdbb6", 'Xəta'), description: error instanceof Error ? error.message : tr("createpostscreen_paylasim_yaradila_bilmedi_6354b1", 'Paylaşım yaradıla bilmədi'), variant: 'destructive' });
    } finally {setIsUploading(false);}
  };

  const removeMedia = (index: number) => {
    URL.revokeObjectURL(mediaPreviews[index].url);
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
    setMediaPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const canSubmit = (content.trim() || mediaFiles.length > 0 || !!blog.selected) && !blog.command && !isUploading && !createPost.isPending && !moderationStatus?.post;

  return (
    <div className="a-scope min-h-screen flex flex-col" style={{ background: 'var(--a-bg)' }}>
      <div className="a-shell flex-1 flex flex-col">
        {/* Top bar */}
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.9 }} aria-label={tr("common_geri", "Geri")}>
              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
            </motion.button>
            <p className="a-wordmark" style={{ fontSize: 16 }}>{tr("createpostscreen_yeni_paylasim_4f5b15", "Yeni Paylaşım")}</p>
          </div>
          <div className="a-topbar-actions">
            <motion.button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="a-btn-solid disabled:opacity-40"
              whileTap={canSubmit ? { scale: 0.95 } : undefined}>
              {isUploading || createPost.isPending ?
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
              <><Send size={13} />{tr("createpostscreen_paylas_b4be3b", "Paylaş")}</>}
            </motion.button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 space-y-4 pb-32">
          <RestrictionNote scope="post" />
          {/* Content textarea — white card */}
          <div className="relative">
            <div className="a-card" style={{ padding: 6 }}>
              <Textarea
                ref={textareaRef}
                value={content}
                onChange={handleContentChange}
                onSelect={event => blog.setCursor(event.currentTarget.selectionStart)}
                placeholder={blog.selected ? feature37Text('blog_caption', uiLang) : tr("createpostscreen_ne_dusunursunuz_474859", "Nə düşünürsünüz? ✨")}
                className="min-h-[180px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 pe-12 leading-relaxed"
                style={{ fontSize: 14, color: 'var(--a-ink)' }}
                autoFocus />

              <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                <PopoverTrigger asChild>
                  <button type="button" className="absolute end-4 top-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                  style={{ background: 'var(--a-surface-soft)' }} aria-label="Emoji">
                    <Smile size={16} style={{ color: 'var(--a-ink-soft)' }} />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-0" align="end" side="top">
                  <EmojiPicker onEmojiClick={handleEmojiSelect} theme={theme === 'dark' ? Theme.DARK : Theme.LIGHT} width={300} height={350} searchPlaceholder={tr("community_emoji_axtar_placeholder_f123bc", "Emoji axtar...")} previewConfig={{ showPreview: false }} />
                </PopoverContent>
              </Popover>
            </div>

            {showSuggestions && suggestions.length > 0 &&
            <div className="absolute start-0 end-0 top-full mt-1 z-50 overflow-hidden"
            style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)', borderRadius: 18, boxShadow: 'var(--a-card-shadow)' }}>
                {suggestions.map((suggestion, index) =>
              <button key={`${suggestion.type}-${suggestion.value}-${index}`} onClick={() => applySuggestion(suggestion)}
              className="w-full px-4 py-2.5 flex items-center gap-3 text-start transition-colors"
              style={{ borderBottom: index < suggestions.length - 1 ? '1px solid var(--a-line)' : 'none' }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center overflow-hidden shrink-0" style={{ background: 'var(--a-peach-1)' }}>
                      {suggestion.type === 'user' && suggestion.avatar ?
                  <img src={suggestion.avatar} alt="" className="w-full h-full object-cover" /> :
                  suggestion.type === 'user' ?
                  <AtSign size={13} style={{ color: 'var(--a-accent-ink)' }} /> :

                  <Hash size={13} style={{ color: 'var(--a-accent-ink)' }} />
                  }
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--a-ink)' }}>{suggestion.type === 'hashtag' ? '#' : '@'}{suggestion.value}</span>
                  </button>
              )}
              </div>
            }
          </div>

          {/* Quick Hashtags */}
          <BlogAttachmentPicker attachment={blog} />
          <div className="flex flex-wrap gap-1.5">
            {POPULAR_HASHTAGS.slice(0, 6).map((tag) =>
            <button key={tag} onClick={() => setContent((prev) => prev + (prev ? ' ' : '') + `#${tag}`)} className="a-tag">
                #{tag}
              </button>
            )}
          </div>

          {/* Media Previews */}
          {mediaPreviews.length > 0 &&
          <div className="grid grid-cols-2 gap-2">
              {mediaPreviews.map((preview, index) =>
            <div key={index} className="relative aspect-square overflow-hidden" style={{ borderRadius: 18, background: 'var(--a-surface-soft)' }}>
                  {preview.type === 'video' ?
              <div className="relative w-full h-full">
                      <video src={preview.url} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        {/* Dairə HƏMİŞƏ açıq/ağ qalır (bg-white/90) — ikon rəngi
                            də sabit tünd saxlanılır, əks halda dark modda
                            var(--a-ink) ağa çevrilib ağ dairə üzərində itirdi. */}
                        <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center"><Play className="w-5 h-5 ms-0.5" style={{ color: '#333333' }} /></div>
                      </div>
                    </div> :

              <img src={preview.url} alt="" className="w-full h-full object-cover" />
              }
                  <button onClick={() => removeMedia(index)} className="absolute top-2 end-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center">
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
            )}
            </div>
          }

          <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFileSelect(e, 'image')} />
          <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => handleFileSelect(e, 'video')} />

          {/* Media Actions */}
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--a-ink-soft)' }}>{tr("createpostscreen_elave_et_81035a", "Əlavə et:")}</span>
            <button onClick={() => imageInputRef.current?.click()} disabled={mediaFiles.length >= 4 || isUploading}
            className="a-icon-btn disabled:opacity-40" style={{ width: 40, height: 40 }} aria-label={tr("directmessagescreen_sekil_43e2e3", "Şəkil")}>
              <Image size={17} style={{ color: 'var(--a-accent-ink)' }} />
            </button>
            <button onClick={() => videoInputRef.current?.click()} disabled={mediaFiles.length >= 4 || isUploading}
            className="a-icon-btn disabled:opacity-40" style={{ width: 40, height: 40 }} aria-label="Video">
              <Video size={17} style={{ color: 'var(--a-blue-ink)' }} />
            </button>
            {mediaFiles.length > 0 && <span className="ms-auto" style={{ fontSize: 10, fontWeight: 600, color: 'var(--a-ink-soft)' }}>{mediaFiles.length}/4</span>}
          </div>

          <GroupTagPicker value={taggedGroupIds} onChange={setTaggedGroupIds} disabled={isUploading || isAnonymous}/>

          {/* Post dili — yazdıqca avtomatik aşkarlanır, çiplə düzəldilə bilər.
              Feed bu dilə görə filtrlənir (UI dilinə görə YOX). */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--a-ink-soft)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Languages size={12} /> {tr("createpost_post_dili", "Post dili")}:
            </span>
            {FEED_LANGS.map((l) =>
            <button
              key={l}
              type="button"
              onClick={() => { hapticFeedback.light(); setManualLang(l); }}
              className={`a-tag${postLang === l ? ' on' : ''}`}
              style={{ cursor: 'pointer' }}>
                {l.toUpperCase()}
              </button>
            )}
          </div>

          {/* Anonymous Toggle */}
          <button
            type="button"
            onClick={() => { if (!isAnonymous) setTaggedGroupIds([]); setIsAnonymous(!isAnonymous); }}
            className="w-full flex items-center gap-3 transition-all"
            style={{
              background: 'var(--a-surface)',
              borderRadius: 'var(--a-radius-md)',
              padding: '14px 16px',
              boxShadow: 'var(--a-card-shadow)',
              border: isAnonymous ? '1.5px solid var(--a-lav-2)' : '1.5px solid transparent'
            }}>

            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: isAnonymous ? 'var(--a-lav-1)' : 'var(--a-surface-soft)' }}>
              <EyeOff size={16} style={{ color: isAnonymous ? 'var(--a-lav-ink)' : 'var(--a-ink-soft)' }} />
            </div>
            <div className="flex-1 text-start">
              <p style={{ fontSize: 12.5, fontWeight: 700, color: isAnonymous ? 'var(--a-lav-ink)' : 'var(--a-ink)' }}>{tr("createpostscreen_anonim_paylas_6074c9", "Anonim paylaş")}</p>
              <p style={{ fontSize: 10.5, color: 'var(--a-ink-soft)' }}>{tr("createpostscreen_adiniz_ve_sekliniz_gizledilir_6fc767", "Adınız və şəkliniz gizlədilir")}</p>
            </div>
            <div className="w-10 h-6 rounded-full transition-colors shrink-0" style={{ background: isAnonymous ? 'var(--a-lav-2)' : 'var(--a-line-strong)' }}>
              <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform mt-0.5 ${isAnonymous ? 'ms-[18px]' : 'ms-0.5'}`} />
            </div>
          </button>
        </div>
      </div>
    </div>);

};

export default CreatePostScreen;
