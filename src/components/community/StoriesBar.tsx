import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Camera, Image as ImageIcon, X } from 'lucide-react';
import { UserStoryGroup, useStories, useToggleStoryLike } from '@/hooks/useStories';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import StoryViewer from './StoryViewer';
import StoryCropEditor, { type StoryEditorResult } from './StoryCropEditor';
import { tr } from "@/lib/tr";
import { useMyModerationStatus } from '@/hooks/useModerator';
import RestrictionNote from '@/components/moderation/RestrictionNote';

interface StoriesBarProps {
  groupId?: string | null;
  /** Bildiriş/deep-link ilə: bu ID-li story-ni tapıb avtomatik aç (bax CommunityScreen.tsx) */
  autoOpenStoryId?: string | null;
  /** autoOpenStoryId "istehlak" olunduqdan sonra valideyndə təmizləmək üçün */
  onAutoOpenConsumed?: () => void;
}

const StoriesBar = ({ groupId, autoOpenStoryId, onAutoOpenConsumed }: StoriesBarProps) => {
  const { user, profile } = useAuth();
  const { data: moderationStatus } = useMyModerationStatus();
  const queryClient = useQueryClient();
  const { storyGroups, isLoading, isFetching, refetch, createStoryAsync, isCreating, markAsViewed, deleteStory } = useStories(groupId);
  const toggleStoryLike = useToggleStoryLike();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [initialGroupIndex, setInitialGroupIndex] = useState(0);
  const [initialStoryId, setInitialStoryId] = useState<string | null>(null);
  const refreshedStoryId = useRef<string | null>(null);
  const consumedStoryId = useRef<string | null>(null);

  // Bildirişdən gələn storyId — story-lər yükləndikdən sonra hansı qrupda
  // olduğunu tapıb ORAYA açır (StoryViewer öz stack-i daxilində düz story-yə keçir).
  useEffect(() => {
    if (!autoOpenStoryId) { refreshedStoryId.current = null; consumedStoryId.current = null; return; }
    if (consumedStoryId.current === autoOpenStoryId) return;
    const groupIdx = storyGroups.findIndex((g) => g.stories.some((s) => s.id === autoOpenStoryId));
    if (groupIdx >= 0) {
      setInitialGroupIndex(groupIdx);
      setInitialStoryId(autoOpenStoryId);
      setViewerOpen(true);
    } else {
      if (isLoading || isFetching) return;
      if (refreshedStoryId.current !== autoOpenStoryId) {
        refreshedStoryId.current = autoOpenStoryId;
        void refetch();
        return;
      }
    }
    consumedStoryId.current = autoOpenStoryId;
    onAutoOpenConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenStoryId, storyGroups, isLoading, isFetching, refetch]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const draftIdRef = useRef<string | null>(null);
  const uploadedPaths = useRef<string[]>([]);
  const publishingRef = useRef(false);
  useEffect(() => () => { if (cropImageUrl) URL.revokeObjectURL(cropImageUrl); }, [cropImageUrl]);

  // Yükləmə overlay-i üçün qoruyucu: zəif şəbəkədə mutation asılı qalsa,
  // tam-ekran overlay bütün app-ı əbədi bloklamasın — 15 saniyədən sonra
  // "Bağla" düyməsi görünür (yükləmə arxa planda davam edir).
  const overlayVisible = uploading || isCreating;
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  const [overlayEscapable, setOverlayEscapable] = useState(false);
  useEffect(() => {
    if (!overlayVisible) {
      setOverlayDismissed(false);
      setOverlayEscapable(false);
      return;
    }
    const timer = setTimeout(() => setOverlayEscapable(true), 15000);
    return () => clearTimeout(timer);
  }, [overlayVisible]);

  const handleStoryClick = (index: number) => {setInitialGroupIndex(index);setViewerOpen(true);};

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user || moderationStatus?.story) return;
    setShowCreateModal(false);
    draftIdRef.current = crypto.randomUUID();
    uploadedPaths.current = [];
    setSelectedFile(file);
    setCropImageUrl(URL.createObjectURL(file));
  };

  const handleCropConfirm = async ({ image, scene }: StoryEditorResult) => {
    if (moderationStatus?.story) throw new Error('MODERATOR_ACTIVITY_RESTRICTED');
    if (!selectedFile || !user || !draftIdRef.current) throw new Error('STORY_DRAFT_MISSING');
    if (publishingRef.current) throw new Error('STORY_UPLOAD_IN_PROGRESS');
    publishingRef.current = true;
    const actorId = user.id;
    const storyId = draftIdRef.current;
    const paths = uploadedPaths.current;
    const mediaType = image ? 'image' : 'video';
    const file = image ? new File([image], `story_${storyId}.jpg`, { type: 'image/jpeg' }) : selectedFile;
    setUploading(true);
    try {
      const extension = mediaType === 'image' ? 'jpg' : file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'mp4';
      const fileName = `${actorId}/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from('community-media').upload(fileName, file, { upsert: false, cacheControl: '3600' });
      if (error) throw error;
      paths.push(fileName);
      const { data: urlData } = supabase.storage.from('community-media').getPublicUrl(fileName);
      await createStoryAsync({ mediaUrl: urlData.publicUrl, mediaType, groupId: groupId || undefined, storyId,
        backgroundColor: scene.background, editorLayout: mediaType === 'video' ? scene : null,
        textOverlay: mediaType === 'video' ? scene.texts.map(text => text.text).join('\n') : undefined });
      const obsolete = paths.filter(path => path !== fileName);
      if (obsolete.length) void supabase.storage.from('community-media').remove(obsolete);
      if (draftIdRef.current === storyId) {
        setCropImageUrl(null); setSelectedFile(null); draftIdRef.current = null; uploadedPaths.current = [];
      }
    } finally { publishingRef.current = false; setUploading(false); }
  };

  const handleCropCancel = () => {
    setCropImageUrl(null);setSelectedFile(null);
  };

  const userStoryGroup = storyGroups.find((g) => g.user_id === user?.id);
  const hasOwnStory = !!userStoryGroup;

  return (
    <>
      <RestrictionNote scope="story" />
      <div className="flex gap-3.5 overflow-x-auto hide-scrollbar py-2 -mx-5 px-5" style={{ scrollPaddingInline: 20 }}>
        {/* Own Story */}
        <motion.button
          onClick={() => hasOwnStory ? handleStoryClick(0) : !moderationStatus?.story && setShowCreateModal(true)}
          className="flex-shrink-0 flex flex-col items-center gap-1.5"
          whileTap={{ scale: 0.92 }}>
          
          <div className="relative">
            <div
              className={`w-[62px] h-[62px] rounded-full p-[2.5px] transition-all`}
              style={hasOwnStory ?
              { background: 'linear-gradient(135deg, var(--a-peach-2), var(--a-pink-2), var(--a-lav-2))' } :
              { background: 'var(--a-line-strong)' }
              }>
              
              <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center" style={{ background: 'var(--a-surface)' }}>
                {hasOwnStory ?
                profile?.avatar_url ?
                <img loading="lazy" decoding="async" src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> :

                <span className="text-base font-black" style={{ color: 'var(--a-accent-ink)' }}>{(profile?.name || 'S').charAt(0).toUpperCase()}</span> :


                <div className="w-full h-full rounded-full flex items-center justify-center" style={{ background: 'var(--a-surface-soft)' }}>
                    <Plus className="w-5 h-5" style={{ color: 'var(--a-peach-2)' }} />
                  </div>
                }
              </div>
            </div>
            <div
              className="absolute -bottom-0.5 -end-0.5 w-5 h-5 rounded-full flex items-center justify-center shadow-sm cursor-pointer"
              style={{ background: 'var(--a-peach-2)', border: '2px solid var(--a-surface)' }}
              onClick={(e) => {e.stopPropagation();if (!moderationStatus?.story) setShowCreateModal(true);}}>
              
              <Plus className="w-2.5 h-2.5 text-white" strokeWidth={3} />
            </div>
          </div>
          <span className="text-[10px] font-bold truncate w-[62px] text-center leading-tight" style={{ color: 'var(--a-ink-soft)' }}>
            {hasOwnStory ? tr("storiesbar_sizin", "Sizin") : tr("storiesbar_elave_et_6e1b9b", "\u018Flav\u0259 et")}
          </span>
        </motion.button>

        {/* Others */}
        {storyGroups.filter((g) => g.user_id !== user?.id).map((group) =>
        <motion.button
          key={group.user_id}
          onClick={() => handleStoryClick(storyGroups.indexOf(group))}
          className="flex-shrink-0 flex flex-col items-center gap-1.5"
          whileTap={{ scale: 0.92 }}>
          
            <div
            className="w-[62px] h-[62px] rounded-full p-[2.5px] transition-all"
            style={{
              background: group.has_unviewed ?
              'linear-gradient(135deg, var(--a-peach-2), var(--a-pink-2), var(--a-lav-2))' :
              'var(--a-line-strong)'
            }}>
            
              <div className="w-full h-full rounded-full overflow-hidden" style={{ background: 'var(--a-surface)' }}>
                {group.user_avatar ?
              <img loading="lazy" decoding="async" src={group.user_avatar} alt={group.user_name} className="w-full h-full object-cover" /> :

              <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--a-surface-soft)' }}>
                    <span className="text-base font-black" style={{ color: 'var(--a-accent-ink)' }}>{group.user_name.charAt(0).toUpperCase()}</span>
                  </div>
              }
              </div>
            </div>
            <span className="text-[10px] font-bold truncate w-[62px] text-center leading-tight" style={{ color: 'var(--a-ink-soft)' }}>
              {group.user_name.split(' ')[0]}
            </span>
          </motion.button>
        )}

        {isLoading && [1, 2, 3].map((i) =>
        <div key={i} className="flex flex-col items-center gap-1.5">
            <div className="w-[62px] h-[62px] rounded-full animate-pulse" style={{ background: 'var(--a-surface-soft)' }} />
            <div className="w-9 h-2 rounded-full animate-pulse" style={{ background: 'var(--a-surface-soft)' }} />
          </div>
        )}
      </div>

      <AnimatePresence>
        {viewerOpen && <StoryViewer storyGroups={storyGroups} initialGroupIndex={initialGroupIndex} initialStoryId={initialStoryId} onClose={() => {setViewerOpen(false);setInitialStoryId(null);
          // markAsViewed artıq refetch ETMİR (açıq viewer altında sıra
          // dəyişməsin deyə) — halqaların "baxılıb" vəziyyəti viewer
          // bağlananda BİR DƏFƏ yenilənir
          queryClient.invalidateQueries({ queryKey: ['stories'] });}} onViewed={markAsViewed} onDelete={deleteStory} likePending={toggleStoryLike.isPending} onToggleLike={(storyId, isLiked) => toggleStoryLike.mutate({ storyId, isLiked })} />}
      </AnimatePresence>
      <AnimatePresence>
        {cropImageUrl && <StoryCropEditor key={cropImageUrl} imageUrl={cropImageUrl} mediaType={selectedFile?.type.startsWith('video/') ? 'video' : 'image'} onConfirm={handleCropConfirm} onCancel={handleCropCancel} />}
      </AnimatePresence>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end justify-center"
        onClick={() => setShowCreateModal(false)}>
          
            <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            className="w-full max-w-md bg-card rounded-t-[28px]"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 90px)' }}
            onClick={(e) => e.stopPropagation()}>
            
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-9 h-1 rounded-full bg-border/30" />
              </div>
              <div className="p-5 pt-3">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-[16px] font-black text-foreground">{tr("storiesbar_story_elave_et_21f0b9", "Story Əlavə Et")}</h3>
                  <button onClick={() => setShowCreateModal(false)} className="w-8 h-8 rounded-full bg-muted/40 flex items-center justify-center">
                    <X className="w-4 h-4 text-muted-foreground/60" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-3 p-6 bg-gradient-to-br from-primary/5 to-accent/3 rounded-2xl border border-primary/8 active:border-primary/20 transition-all"
                  whileTap={{ scale: 0.96 }}>
                  
                    <div className="w-12 h-12 rounded-full bg-primary/8 flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-primary/60" />
                    </div>
                    <span className="font-bold text-[12px] text-foreground">{tr("untranslated_qalereyadan_w37f0m", "Qalereyadan")}</span>
                  </motion.button>
                  <motion.button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center gap-3 p-6 bg-gradient-to-br from-blue-500/5 to-cyan-500/3 rounded-2xl border border-blue-500/8 active:border-blue-500/20 transition-all"
                  whileTap={{ scale: 0.96 }}>
                  
                    <div className="w-12 h-12 rounded-full bg-blue-500/8 flex items-center justify-center">
                      <Camera className="w-5 h-5 text-blue-500/60" />
                    </div>
                    <span className="font-bold text-[12px] text-foreground">{tr("untranslated_kamera_qucuxi", "Kamera")}</span>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {overlayVisible && !cropImageUrl && !overlayDismissed &&
      <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center">
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-card rounded-2xl p-6 flex flex-col items-center gap-3 shadow-xl">
            <div className="w-10 h-10 border-[2.5px] border-primary/25 border-t-primary rounded-full animate-spin" />
            <p className="font-bold text-[12px] text-foreground">{tr("storiesbar_story_yuklenir_a92632", "Story yüklənir...")}</p>
            {overlayEscapable &&
            <button
              onClick={() => setOverlayDismissed(true)}
              className="mt-1 px-4 py-1.5 rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
                {tr("common_close", "Bağla")}
              </button>
            }
          </motion.div>
        </div>
      }

      <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileSelect} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
    </>);

};

export default StoriesBar;
