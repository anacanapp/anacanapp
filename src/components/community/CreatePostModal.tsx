import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Image, Video, Send, Loader2, Play, Smile, Hash, AtSign, EyeOff, ChevronDown } from 'lucide-react';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { CommunityGroup, useCreatePost } from '@/hooks/useCommunity';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { hapticFeedback } from '@/lib/native';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from 'next-themes';
import { tr } from "@/lib/tr";
import { GroupTagPicker } from './GroupPostTags';
import { useBlogAttachment } from '@/hooks/useBlogAttachment';
import BlogAttachmentPicker from './BlogAttachmentPicker';
import { blogCommand } from '@/lib/community-blog';
import { useMyModerationStatus } from '@/hooks/useModerator';
import RestrictionNote from '@/components/moderation/RestrictionNote';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string | null;
  groups: CommunityGroup[];
}

interface Suggestion {
  type: 'user' | 'hashtag';
  value: string;
  display: string;
  avatar?: string;
}

const POPULAR_HASHTAGS = [
  tr("createpostmodal_hamilelik_64e7fe", "hamil\u0259lik"),
  tr("createpostmodal_ana_hashtag", "ana"),
  tr("createpostmodal_korpe_4abca7", "k\xF6rp\u0259"),
  tr("createpostmodal_saglamliq_d183d2", "sa\u011Flaml\u0131q"),
  tr("createpostmodal_qidalanma_hashtag", "qidalanma"),
  tr("createpostmodal_dogus_01c8e6", "do\u011Fu\u015F"),
  tr("createpostmodal_emzirme_1e11e5", "\u0259mzirm\u0259"),
  tr("createpostmodal_yuxu_hashtag", "yuxu"),
  tr("createpostmodal_inkisaf_abc234", "inki\u015Faf"),
  tr("createpostmodal_oyun_hashtag", "oyun"),
  tr("createpostmodal_aile_894dfb", "ail\u0259"),
  tr("createpostmodal_sevgi_hashtag", "sevgi"),
  tr("createpostmodal_xosbextlik_55f22a", "xo\u015Fb\u0259xtlik"),
  tr("createpostmodal_analar_hashtag", "analar"),
  tr("createpostmodal_usaq_36b348", "u\u015Faq")
];


const CreatePostModal = ({ isOpen, onClose, groupId, groups }: CreatePostModalProps) => {
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
  const [suggestionType, setSuggestionType] = useState<'user' | 'hashtag' | null>(null);
  const [cursorPosition, setCursorPosition] = useState(0);

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
  const blog = useBlogAttachment(content, setContent, textareaRef, isOpen);

  const createPost = useCreatePost();
  const { data: moderationStatus } = useMyModerationStatus();
  const { toast } = useToast();
  const { theme } = useTheme();

  const searchUsers = useCallback(async (term: string) => {
    if (!term) return [];
    const { data } = await supabase.from('public_profile_cards').select('user_id, name, avatar_url').ilike('name', `%${term}%`).limit(5);
    return (data || []).map((user) => ({ type: 'user' as const, value: user.name || tr("createpostmodal_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i"), display: user.name || tr("createpostmodal_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i"), avatar: user.avatar_url }));
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
      setSuggestionType('user');
      const userSuggestions = await searchUsers(currentWord.substring(1));
      setSuggestions(userSuggestions);
      setShowSuggestions(userSuggestions.length > 0);
    } else if (currentWord.startsWith('#') && currentWord.length > 1) {
      setSuggestionType('hashtag');
      const hashtagSuggestions = searchHashtags(currentWord.substring(1));
      setSuggestions(hashtagSuggestions);
      setShowSuggestions(hashtagSuggestions.length > 0);
    } else {
      setShowSuggestions(false);setSuggestions([]);setSuggestionType(null);
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
    if (files.length + mediaFiles.length > 4) {toast({ title: tr("createpostmodal_limit_asildi_30a129", 'Limit aşıldı'), description: 'Maximum 4 fayl', variant: 'destructive' });return;}
    const maxSize = type === 'video' ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (files.some((f) => f.size > maxSize)) {toast({ title: tr("createpostmodal_fayl_cox_boyukdur_f5cf61", 'Fayl çox böyükdür'), description: type === 'video' ? 'Max 50MB' : 'Max 10MB', variant: 'destructive' });return;}
    setMediaFiles((prev) => [...prev, ...files]);
    setMediaPreviews((prev) => [...prev, ...files.map((file) => ({ url: createPreviewUrl(file), type }))]);
    if (e.target) e.target.value = '';
  };

  const uploadMedia = async (): Promise<string[]> => {
    if (mediaFiles.length === 0) return [];
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const urls: string[] = [];
    for (const file of mediaFiles) {
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
    if (!content.trim() && mediaFiles.length === 0 && !blog.selected) {toast({ title: tr("createpostmodal_bos_paylasim_47b52d", 'Boş paylaşım'), description: tr("createpostmodal_metn_yazin_ve_ya_media_elave_edin_18fa25", 'Mətn yazın və ya media əlavə edin'), variant: 'destructive' });return;}
    hapticFeedback.medium();
    setIsUploading(true);
    try {
      const mediaUrls = await uploadMedia();
      await createPost.mutateAsync({ groupId: selectedGroupId, content: content.trim() || (blog.selected ? '📖' : '📷'), mediaUrls, isAnonymous, taggedGroupIds, blogPostId: blog.selected?.id });
      blog.setSelected(null);
      mediaPreviews.forEach((p) => URL.revokeObjectURL(p.url));
      setContent('');setMediaFiles([]);setMediaPreviews([]);onClose();
    } catch (error) {
      toast({ title: tr("createpostmodal_xeta_3cdbb6", 'Xəta'), description: error instanceof Error ? error.message : tr("createpostmodal_paylasim_yaradila_bilmedi_6354b1", 'Paylaşım yaradıla bilmədi'), variant: 'destructive' });
    } finally {setIsUploading(false);}
  };

  const removeMedia = (index: number) => {
    URL.revokeObjectURL(mediaPreviews[index].url);
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
    setMediaPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClose = () => {
    blog.setSelected(null);
    mediaPreviews.forEach((p) => URL.revokeObjectURL(p.url));
    setContent('');setMediaFiles([]);setMediaPreviews([]);setShowEmojiPicker(false);setShowSuggestions(false);setIsAnonymous(false);setTaggedGroupIds([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen &&
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end justify-center"
        onClick={handleClose}>
        
          <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 380 }}
          className="w-full max-w-md bg-card rounded-t-[28px] max-h-[90vh] overflow-y-auto"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 20px)' }}
          onClick={(e) => e.stopPropagation()}>
          
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-border/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3">
              <h3 className="text-[17px] font-black text-foreground">{tr("createpostmodal_yeni_paylasim_4f5b15", "Yeni Paylaşım")}</h3>
              <button onClick={handleClose} className="w-8 h-8 rounded-full bg-muted/60 flex items-center justify-center">
                <X className="w-4 h-4 text-muted-foreground/80" />
              </button>
            </div>

            <div className="px-5 space-y-4">
              {/* Group Selector removed as per request */}

              {/* Content */}
              <RestrictionNote scope="post" />
              <div className="relative">
                <Textarea
                ref={textareaRef}
                value={content}
                onChange={handleContentChange}
                onSelect={event => blog.setCursor(event.currentTarget.selectionStart)}
                placeholder={tr("createpostmodal_ne_dusunursunuz_474859", "Nə düşünürsünüz? ✨")}
                className="min-h-[130px] rounded-2xl resize-none text-[14px] bg-muted/25 border-border/25 focus:border-primary/30 pe-12 leading-relaxed" />
              
                <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                  <PopoverTrigger asChild>
                    <button type="button" className="absolute end-3 top-3 w-8 h-8 rounded-full bg-muted/50 hover:bg-muted/70 flex items-center justify-center transition-colors">
                      <Smile className="w-4 h-4 text-muted-foreground/80" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-0" align="end" side="top">
                    <EmojiPicker onEmojiClick={handleEmojiSelect} theme={theme === 'dark' ? Theme.DARK : Theme.LIGHT} width={300} height={350} searchPlaceholder={tr("community_emoji_axtar_placeholder_f123bc", "Emoji axtar...")} previewConfig={{ showPreview: false }} />
                  </PopoverContent>
                </Popover>

                {showSuggestions && suggestions.length > 0 &&
              <div className="absolute start-0 end-0 top-full mt-1 bg-popover border border-border/15 rounded-2xl shadow-lg z-50 overflow-hidden">
                    {suggestions.map((suggestion, index) =>
                <button key={`${suggestion.type}-${suggestion.value}-${index}`} onClick={() => applySuggestion(suggestion)}
                className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-muted/50 transition-colors text-start">
                        <div className="w-7 h-7 rounded-full bg-primary/8 flex items-center justify-center overflow-hidden">
                          {suggestion.type === 'user' && suggestion.avatar ?
                    <img src={suggestion.avatar} alt="" className="w-full h-full object-cover" /> :
                    suggestion.type === 'user' ?
                    <AtSign className="w-3.5 h-3.5 text-primary" /> :

                    <Hash className="w-3.5 h-3.5 text-primary" />
                    }
                        </div>
                        <span className="font-medium text-[12px]">{suggestion.type === 'hashtag' ? '#' : '@'}{suggestion.value}</span>
                      </button>
                )}
                  </div>
              }
              </div>

              {/* Quick Hashtags */}
              <BlogAttachmentPicker attachment={blog} />
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_HASHTAGS.slice(0, 5).map((tag) =>
              <button key={tag} onClick={() => setContent((prev) => prev + (prev ? ' ' : '') + `#${tag}`)}
              className="px-2.5 py-1 rounded-full bg-muted/35 text-[10px] font-bold text-muted-foreground/75 hover:bg-primary/15 hover:text-primary transition-colors">
                    #{tag}
                  </button>
              )}
              </div>

              {/* Media Previews */}
              {mediaPreviews.length > 0 &&
            <div className="grid grid-cols-2 gap-2">
                  {mediaPreviews.map((preview, index) =>
              <div key={index} className="relative aspect-square rounded-2xl overflow-hidden bg-muted">
                      {preview.type === 'video' ?
                <div className="relative w-full h-full">
                          <video src={preview.url} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            {/* Dairə HƏMİŞƏ açıq/ağ qalır (bg-white/90) — text-foreground
                                dark modda ağ olur və ağ dairə üzərində itir, ona görə
                                sabit tünd rəng istifadə olunur. */}
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
              <div className="flex items-center gap-2.5 py-2">
                <span className="text-[11px] text-muted-foreground/65 font-medium">{tr("createpostmodal_elave_et_81035a", "Əlavə et:")}</span>
                <button onClick={() => imageInputRef.current?.click()} disabled={mediaFiles.length >= 4 || isUploading}
              className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center disabled:opacity-40 transition-colors active:bg-primary/25">
                  <Image className="w-4 h-4 text-primary" />
                </button>
                <button onClick={() => videoInputRef.current?.click()} disabled={mediaFiles.length >= 4 || isUploading}
              className="w-9 h-9 rounded-full bg-blue-500/15 flex items-center justify-center disabled:opacity-40 transition-colors active:bg-blue-500/25">
                  <Video className="w-4 h-4 text-blue-500" />
                </button>
                {mediaFiles.length > 0 && <span className="text-[10px] text-muted-foreground/60 font-medium ms-auto">{mediaFiles.length}/4</span>}
              </div>

              <GroupTagPicker value={taggedGroupIds} onChange={setTaggedGroupIds} disabled={isUploading || isAnonymous}/>

              {/* Anonymous Toggle */}
              <button
              type="button"
              onClick={() => { if (!isAnonymous) setTaggedGroupIds([]); setIsAnonymous(!isAnonymous); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
              isAnonymous ? 'bg-primary/15 border border-primary/30' : 'bg-muted/25 border border-border/25'}`
              }>
              
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isAnonymous ? 'bg-primary text-primary-foreground' : 'bg-muted/70 text-muted-foreground/75'}`}>
                  <EyeOff className="w-4 h-4" />
                </div>
                <div className="flex-1 text-start">
                  <p className={`text-[12px] font-bold ${isAnonymous ? 'text-primary' : 'text-foreground'}`}>{tr("createpostmodal_anonim_paylas_6074c9", "Anonim paylaş")}</p>
                  <p className="text-[10px] text-muted-foreground/65">{tr("createpostmodal_adiniz_gizledilir_fb1df0", "Adınız gizlədilir")}</p>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors ${isAnonymous ? 'bg-primary' : 'bg-muted-foreground/40'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform mt-0.5 ${isAnonymous ? 'ms-[18px]' : 'ms-0.5'}`} />
                </div>
              </button>

              {/* Submit */}
              <Button
              onClick={handleSubmit}
              disabled={!content.trim() && mediaFiles.length === 0 && !blog.selected || !!blog.command || isUploading || createPost.isPending || moderationStatus?.post}
              className="w-full h-11 rounded-full gradient-primary font-bold text-[13px] shadow-lg shadow-primary/20">
              
                {isUploading || createPost.isPending ?
              <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /><span>{tr("createpostmodal_yuklenir_5557de", "Yüklənir...")}</span></div> :

              <><Send className="w-4 h-4 me-2" />{tr("createpostmodal_paylas_b4be3b", "Paylaş")}</>
              }
              </Button>
            </div>
          </motion.div>
        </motion.div>
      }
    </AnimatePresence>);

};

export default CreatePostModal;
