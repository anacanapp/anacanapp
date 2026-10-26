import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { tr } from '@/lib/group-i18n';
import { motion, AnimatePresence, PanInfo, useReducedMotion } from 'framer-motion';
import { X, Pause, Play, Trash2, Eye, Users, ChevronUp, Heart, MessageCircle, Send, Volume2, VolumeX } from 'lucide-react';
import { Story, UserStoryGroup } from '@/hooks/useStories';
import { useStoryViewers } from '@/hooks/useStoryViewers';
import { useStoryReplies, useCreateStoryReply, useDeleteStoryReply } from '@/hooks/useStoryReplies';
import { useAutoGrowTextarea } from '@/hooks/useAutoGrowTextarea';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { useIsRtl } from '@/lib/rtl';
import { parseStoryScene } from '@/lib/story-editor';
import StoryVideoLayout from './StoryVideoLayout';
import { AdSurface, useAdExperience } from '@/components/ads/AdExperienceProvider';
import ModeratorActionMenu from '@/components/moderation/ModeratorActionMenu';
import ModeratorActionDialog from '@/components/moderation/ModeratorActionDialog';
import { useMyModerationStatus } from '@/hooks/useModerator';
import RestrictionNote from '@/components/moderation/RestrictionNote';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle } from
"@/components/ui/alert-dialog";

interface StoryViewerProps {
  storyGroups: UserStoryGroup[];
  initialGroupIndex: number;
  /** Bildiriş/deep-link ilə: bu qrup daxilində MƏHZ bu ID-li story-dən başla (yoxdursa 0-cı story) */
  initialStoryId?: string | null;
  onClose: () => void;
  onViewed: (storyId: string) => void;
  onDelete?: (storyId: string) => void;
  onToggleLike?: (storyId: string, isLiked: boolean) => void;
  likePending?: boolean;
}

const StoryViewer = ({
  storyGroups: liveStoryGroups,
  initialGroupIndex,
  initialStoryId,
  onClose,
  onViewed,
  onDelete,
  onToggleLike,
  likePending = false,
}: StoryViewerProps) => {
  const { user, profile, isAdmin } = useAuth();
  const { data: moderationStatus } = useMyModerationStatus();
  const isRtl = useIsRtl();
  const reducedMotion = useReducedMotion();
  const [likeBurst, setLikeBurst] = useState<{ storyId: string; id: number } | null>(null);
  const likeBurstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const likeSequence = useRef(0);
  const ads = useAdExperience();
  const adApi = useRef(ads); adApi.current = ads;
  const [adTransitioning, setAdTransitioning] = useState(false);
  const advancing = useRef(false), alive = useRef(true), storyStartedAt = useRef(Date.now());
  const countedStories = useRef(new Set<string>()), viewerSession = useRef(crypto.randomUUID());
  const navigationKey = useRef('');
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  // KRİTİK: qruplar AÇILIŞ ANINDA dondurulur. Əvvəllər canlı prop istifadə
  // olunurdu — hər baxış qeydiyyatı storyGroups-un yenidən sıralanmasına,
  // indekslərin sürüşməsinə və "2-3 story birdən keçdi" xaosuna səbəb olurdu.
  // Silinən story-lər üçün canlı siyahıdan yalnız MÖVCUDLUQ yoxlanılır.
  const [storyGroups] = useState(() => liveStoryGroups);

  const [currentGroupIndex, setCurrentGroupIndex] = useState(initialGroupIndex);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(() => {
    if (initialStoryId) {
      const idx = liveStoryGroups[initialGroupIndex]?.stories.findIndex((s) => s.id === initialStoryId);
      if (idx !== undefined && idx >= 0) return idx;
    }
    return 0;
  });
  const [isPaused, setIsPaused] = useState(false);
  // Instagram kimi: video story-lər İLK avtomatik başlayanda səssiz olmalıdır
  // (brauzer/WebView autoplay siyasəti buna görə tələb edir) — istifadəçi
  // toxunanda (user-gesture daxilində) səsi aça bilər. Əvvəllər <video muted>
  // statik idi, açma düyməsi/məntiqi ümumiyyətlə yox idi — səs HEÇ VAXT
  // işləmirdi. Seçim story-dən story-yə keçəndə DƏYİŞMİR (bir dəfə açsa davam edir).
  const [isMuted, setIsMuted] = useState(true);
  // Progress artıq 100ms state tick deyil: zolaq CSS animasiyası ilə dolur,
  // keçid isə qalan müddət üçün TƏK setTimeout ilə. progressRun = yenidən başlat.
  const [progressRun, setProgressRun] = useState(0);
  const restartProgress = useCallback(() => setProgressRun((r) => r + 1), []);
  const elapsedRef = useRef(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [moderationOpen, setModerationOpen] = useState(false), [moderatorRemove, setModeratorRemove] = useState(false), [warningOpen, setWarningOpen] = useState(() => !!document.querySelector('[data-testid="moderator-warning"]'));
  useEffect(() => {
    const change = (event: Event) => setWarningOpen(!!(event as CustomEvent).detail?.open);
    window.addEventListener('anacan-moderation-overlay', change);
    return () => window.removeEventListener('anacan-moderation-overlay', change);
  }, []);
  const [showViewers, setShowViewers] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replyText, setReplyText] = useState('');
  const { ref: replyTextareaRef } = useAutoGrowTextarea(replyText, 80);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);
  // Şəkil üçün 6s (İnstagram hissi); video üçün real müddət (onLoadedMetadata)
  const [storyDuration, setStoryDuration] = useState(6000);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Baxış qeydiyyatının təkrarını önləyən dəst (obyekt identikliyi dəyişsə belə)
  const viewedSetRef = useRef<Set<string>>(new Set());

  const currentGroup = storyGroups[currentGroupIndex];
  const currentStory = currentGroup?.stories[currentStoryIndex];
  const editorLayout = parseStoryScene(currentStory?.editor_layout);
  const isOwnStory = currentStory?.user_id === user?.id;
  navigationKey.current = currentStory?.id ?? '';

  // Bəyənmə statusu canlı keşdən oxunur (snapshot köhnələ bilər)
  const liveCurrentStory = liveStoryGroups.
  find((g) => g.user_id === currentGroup?.user_id)?.stories.
  find((s) => s.id === currentStory?.id);
  const currentIsLiked = liveCurrentStory?.is_liked ?? currentStory?.is_liked ?? false;
  const currentLikesCount = liveCurrentStory?.likes_count ?? currentStory?.likes_count ?? 0;
  useEffect(() => {
    setLikeBurst(null);
    if (likeBurstTimer.current) clearTimeout(likeBurstTimer.current);
    return () => { if (likeBurstTimer.current) clearTimeout(likeBurstTimer.current); };
  }, [currentStory?.id]);

  // Fetch actual viewers for own stories
  const { data: viewers = [], isLoading: viewersLoading } = useStoryViewers(
    isOwnStory && showViewers ? currentStory?.id : null
  );

  // Story-yə cavablar — hamı üçün (yalnız sheet açıq olanda yüklənir)
  const { data: replies = [], isLoading: repliesLoading } = useStoryReplies(
    showReplies ? currentStory?.id ?? null : null,
    showReplies
  );
  const createStoryReply = useCreateStoryReply();
  const deleteStoryReply = useDeleteStoryReply();

  const advanceToNextStory = useCallback(() => {
    if (!currentGroup) return;
    if (currentStoryIndex < currentGroup.stories.length - 1) {
      setCurrentStoryIndex((prev) => prev + 1);
      restartProgress();
    } else if (currentGroupIndex < storyGroups.length - 1) {
      setCurrentGroupIndex((prev) => prev + 1);
      setCurrentStoryIndex(0);
      restartProgress();
    } else {
      onClose();
    }
  }, [currentGroup, currentStoryIndex, currentGroupIndex, storyGroups.length, onClose, restartProgress]);
  const goToNextStory = useCallback(async () => {
    if (advancing.current || !currentStory || !currentGroup) return;
    advancing.current = true;
    const key = currentStory.id;
    try {
      const hasNext = currentStoryIndex < currentGroup.stories.length - 1 || currentGroupIndex < storyGroups.length - 1;
      const minimum = adApi.current.configuration?.placements.find(item => item.id === 'community_story_break')?.min_screen_seconds ?? 2;
      if (hasNext && !isOwnStory && !countedStories.current.has(key) && Date.now() - storyStartedAt.current >= minimum * 1000) {
        countedStories.current.add(key);
        if (adApi.current.opportunity('community_story_break', `${viewerSession.current}:${countedStories.current.size}`)) {
          setAdTransitioning(true); videoRef.current?.pause();
          await adApi.current.showStory();
        }
      }
      if (alive.current && navigationKey.current === key) advanceToNextStory();
    } finally { advancing.current = false; if (alive.current) setAdTransitioning(false); }
  }, [currentStory, currentGroup, currentStoryIndex, currentGroupIndex, storyGroups.length, isOwnStory, advanceToNextStory]);

  const goToPrevStory = useCallback(() => {
    if (advancing.current) return;
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex((prev) => prev - 1);
      restartProgress();
    } else if (currentGroupIndex > 0) {
      setCurrentGroupIndex((prev) => prev - 1);
      const prevGroup = storyGroups[currentGroupIndex - 1];
      setCurrentStoryIndex(prevGroup.stories.length - 1);
      restartProgress();
    } else {
      // İlk qrupun ilk story-si: Instagram davranışı — cari story-ni yenidən başlat
      restartProgress();
    }
  }, [currentStoryIndex, currentGroupIndex, storyGroups, restartProgress]);
  const goToNextRef = useRef(goToNextStory);
  goToNextRef.current = goToNextStory;

  // Mark story as viewed — hər story yalnız BİR dəfə (ref-dəst qoruması:
  // obyekt identikliyi dəyişəndə effektin təkrar işə düşməsi zərərsizləşir)
  useEffect(() => {
    if (currentStory && !currentStory.is_viewed && !isOwnStory && !viewedSetRef.current.has(currentStory.id)) {
      viewedSetRef.current.add(currentStory.id);
      onViewed(currentStory.id);
    }
  }, [currentStory, isOwnStory, onViewed]);

  // Story dəyişəndə: progress sıfırla + media növünə görə müddət
  useEffect(() => {
    storyStartedAt.current = Date.now();
    elapsedRef.current = 0;
    if (currentStory?.media_type !== 'video') {
      setStoryDuration(6000);
    }
    // video müddəti onLoadedMetadata-da təyin olunur (aşağıda)
  }, [currentGroupIndex, currentStoryIndex, currentStory?.media_type]);

  // Yenidən başlatma (əvvəlki story-yə keçid / ilk story-ni təkrar) — keçən vaxt sıfırlanır.
  // Taymer effektinin cleanup-ından SONRA işləməsi üçün ondan əvvəl elan olunub.
  useEffect(() => {
    elapsedRef.current = 0;
  }, [progressRun]);

  const progressPaused = isPaused || adTransitioning || ads.busy || showDeleteConfirm || showViewers || showReplies || moderationOpen || moderatorRemove || warningOpen;

  // Progress taymeri — qalan müddət üçün tək setTimeout; pauzada keçən vaxt yadda saxlanır.
  // goToNextStory ref-dən çağırılır (yan təsir state updater-dən kənarda).
  useEffect(() => {
    if (progressPaused || !currentStory) return;
    const startedAt = Date.now();
    const remaining = Math.max(0, storyDuration - elapsedRef.current);
    const timeout = setTimeout(() => {
      elapsedRef.current = storyDuration;
      goToNextRef.current();
    }, remaining);
    return () => {
      clearTimeout(timeout);
      elapsedRef.current = Math.min(storyDuration, elapsedRef.current + (Date.now() - startedAt));
    };
  }, [progressPaused, currentStory, storyDuration, progressRun]);

  // Video: pauza sinxronu — isPaused olanda video da dayansın
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isPaused || adTransitioning || ads.busy || showDeleteConfirm || showViewers || showReplies || moderationOpen || moderatorRemove || warningOpen) v.pause();else
    v.play().catch(() => {});
  }, [isPaused, adTransitioning, ads.busy, showDeleteConfirm, showViewers, showReplies, currentStoryIndex, currentGroupIndex, moderationOpen, moderatorRemove, warningOpen]);

  // Video: mute sinxronu — JSX `muted` prop-u DOM-da mount-dan sonra bəzi
  // WebView-larda etibarlı yenilənmir; imperativ təyinat bunu təmin edir.
  // Story dəyişəndə videoRef YENİ elementə keçir — ona görə currentStoryIndex də dependency-dir.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = isMuted;
  }, [isMuted, currentStoryIndex, currentGroupIndex]);

  // Long press to pause (Instagram-style)
  const handlePointerDown = () => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setIsPaused(true);
    }, 200);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (isLongPress.current) {
      setIsPaused(false);
      isLongPress.current = false;
      return;
    }
    // Tap navigation — RTL-də oxu istiqamətinə uyğun güzgülənir (sağ tərəf = əvvəlki)
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const tappedFirstThird = x < width / 3;
    if (tappedFirstThird) {
      isRtl ? goToNextStory() : goToPrevStory();
    } else if (!tappedFirstThird && x > width / 3) {
      isRtl ? goToPrevStory() : goToNextStory();
    }
  };

  const handleDrag = (_: any, info: PanInfo) => {
    if (Math.abs(info.offset.y) > 100 && info.offset.y > 0) {
      onClose(); // Swipe down to close
    } else if (info.offset.x > 80) {
      isRtl ? goToNextStory() : goToPrevStory();
    } else if (info.offset.x < -80) {
      isRtl ? goToPrevStory() : goToNextStory();
    }
  };

  const handleDelete = () => {
    if (currentStory && onDelete) {
      onDelete(currentStory.id);
      setShowDeleteConfirm(false);
      advanceToNextStory();
    }
  };

  const handleToggleLike = () => {
    if (currentStory && onToggleLike && !likePending && !isOwnStory) {
      if (likeBurstTimer.current) clearTimeout(likeBurstTimer.current);
      if (!currentIsLiked) {
        setLikeBurst({ storyId: currentStory.id, id: ++likeSequence.current });
        likeBurstTimer.current = setTimeout(() => setLikeBurst(null), 900);
      } else setLikeBurst(null);
      // Snapshot köhnələ bilər — bəyənmə statusu canlı keşdən (currentIsLiked)
      onToggleLike(currentStory.id, currentIsLiked);
    }
  };

  const handleSendReply = () => {
    const content = replyText.trim();
    if (!content || !currentStory || moderationStatus?.comment) return;
    createStoryReply.mutate({
      storyId: currentStory.id,
      content,
      storyAuthorId: currentStory.user_id,
      replierName: profile?.name
    });
    setReplyText('');
  };

  const handleDeleteReply = (replyId: string) => {
    if (!currentStory) return;
    deleteStoryReply.mutate({ replyId, storyId: currentStory.id });
  };

  if (!currentGroup || !currentStory) return null;
  // Community tab-ın .a-shell (z-index: 1, öz stacking context-i) və səhifə-keçid
  // motion.div-inin (transform → fixed üçün containing block yaradır) içərisindən
  // adi "fixed inset-0" alt naviqasiyanın (BottomNav, z-40) ARXASINDA qalırdı —
  // DailyStoryCards.tsx-dəki eyni problemin həllini təkrarlayaraq body-ə portallanır.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <AdSurface id="community_story_break" />
      {moderatorRemove && <ModeratorActionDialog target={{ kind: 'story', id: currentStory.id, userId: currentStory.user_id, name: currentGroup.user_name }}
        action="remove" onClose={() => setModeratorRemove(false)} onDone={onClose} />}
      <motion.div
        data-story-viewer={currentStory.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] bg-black flex items-center justify-center" data-ad-block="true"
        data-ad-allow={!showDeleteConfirm && !showViewers && !showReplies && !moderationOpen && !moderatorRemove && !warningOpen ? 'community_story_break' : ''}>

        {/* Progress bars + header — EKRANIN yuxarısında (letterbox üstündə).
            Əvvəllər 9:16 kətanın İÇİNDƏ idi — kətan şaquli mərkəzləndiyi üçün
            uzun ekranlarda xətt "çox aşağıda" görünürdü. İndi Instagram kimi
            həmişə ekranın ən yuxarısındadır. */}
        <div
          className="absolute start-0 end-0 z-30 pointer-events-none"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}>
          {/* Progress bars */}
          <div className="flex gap-[3px] px-3">
            <style>{'@keyframes anacan-story-progress{from{transform:scaleX(0)}to{transform:scaleX(1)}}'}</style>
            {currentGroup.stories.map((_, index) =>
            <div
              key={index}
              className="flex-1 h-[3px] bg-white/30 rounded-full overflow-hidden">
                {index === currentStoryIndex ?
              // Aktiv zolaq: kompozitor animasiyası (re-render yoxdur); key dəyişəndə yenidən başlayır
              <div
                key={`${currentGroupIndex}-${currentStoryIndex}-${progressRun}`}
                className="h-full w-full bg-white rounded-full"
                style={{
                  transform: 'scaleX(0)',
                  transformOrigin: isRtl ? 'right' : 'left',
                  animation: `anacan-story-progress ${storyDuration}ms linear forwards`,
                  animationPlayState: progressPaused ? 'paused' : 'running',
                  willChange: 'transform'
                }} /> :
              <div
                className="h-full bg-white rounded-full"
                style={{ width: index < currentStoryIndex ? '100%' : '0%' }} />
              }
              </div>
            )}
          </div>

          {/* Header */}
          <div className="px-3 mt-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-full ring-2 ring-white/80 overflow-hidden shrink-0">
                  {currentGroup.user_avatar ?
                  <img
                    src={currentGroup.user_avatar}
                    alt={currentGroup.user_name}
                    className="w-full h-full object-cover" /> :


                  <div className="w-full h-full bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">
                        {currentGroup.user_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  }
                </div>
                <div className="min-w-0">
                  <p className="text-white font-semibold text-[13px] leading-tight truncate">{currentGroup.user_name}</p>
                  <p className="text-white/50 text-[11px]">
                    {formatDistanceToNow(new Date(currentStory.created_at), {
                      addSuffix: true,
                      locale: getCurrentDateLocale()
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 pointer-events-auto">
                <ModeratorActionMenu target={{ kind: 'story', id: currentStory.id, userId: currentStory.user_id, name: currentGroup.user_name,
                  version: currentStory.moderation_version || 0, removed: !!currentStory.moderation_removed_at }} onOpenChange={setModerationOpen} onDone={onClose} />
                <button
                  onClick={(e) => {e.stopPropagation();setIsPaused(!isPaused);}}
                  aria-label={isPaused ? tr('storyviewer_resume', 'Davam et') : tr('storyviewer_pause', 'Dayandır')}
                  className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center">
                  
                  {isPaused ? <Play className="w-4 h-4 text-white" /> : <Pause className="w-4 h-4 text-white" />}
                </button>
                {currentStory.media_type === 'video' &&
                <button
                  onClick={(e) => {e.stopPropagation();setIsMuted((m) => !m);}}
                  aria-label={isMuted ? tr('storyviewer_sesi_ac', 'Səsi aç') : tr('storyviewer_sesi_bagla', 'Səsi bağla')}
                  className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center">
                  
                    {isMuted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
                  </button>
                }
                {(isOwnStory || isAdmin) && onDelete &&
                <button
                  onClick={(e) => {e.stopPropagation();if (isAdmin && !isOwnStory) setModeratorRemove(true); else { setShowDeleteConfirm(true);setIsPaused(true); }}}
                  aria-label={tr('stories_story_sil', 'Story-ni sil')}
                  className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center">
                  
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                }
                <button
                  onClick={(e) => {e.stopPropagation();onClose();}}
                  aria-label={tr('common_close', 'Bağla')}
                  className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center">
                  
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Instagram-tipli standart 9:16 (1080x1920) "story kətanı" — cihazın öz ekran
            nisbətindən ASILI OLMAYARAQ sabit qalır. Ekran 9:16-dan enlidirsə (planşet və s.)
            yanlarda, dardırsa (bugünkü çox telefon 9:19-19.5-dir) yuxarı/aşağı qara zolaq
            (letterbox) əlavə olunur — Instagram/YouTube-un standart üsulu. Əvvəllər tam
            ekrana (cihazın öz nisbətinə) "object-cover" ilə uzadılırdı, bu da fərqli
            cihazlarda fərqli hissələrin kəsilməsinə səbəb olurdu.
            CSS min()-trick: hər iki ölçünü ekrana həm sığdırır, həm nisbəti qoruyur. */}
        <div
          className="relative bg-black overflow-hidden"
          style={{
            aspectRatio: '9 / 16',
            width: 'min(100dvw, 100dvh * 9 / 16)',
            height: 'min(100dvh, 100dvw * 16 / 9)'
          }}>
          
          <motion.div
            className="w-full h-full relative"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={handleDrag}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}>
            
            {/* Story media — tam görünmə təmin edilir (object-contain): heç bir hissəsi kəsilmir,
                mənbə şəkil/video 9:16-dan fərqlidirsə çərçivə daxilində öz fon rəngi ilə tamamlanır */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStory.id}
                initial={{ opacity: 0, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0"
                style={{ backgroundColor: currentStory.background_color || '#000' }}>
                
                {currentStory.media_type === 'video' ?
                <StoryVideoLayout
                  videoRef={videoRef}
                  src={currentStory.media_url}
                  layout={editorLayout}
                  muted={isMuted}
                  onDuration={(d) => {
                    // Video story real müddəti qədər oynayır (max 30s, Instagram kimi)
                    if (Number.isFinite(d) && d > 0) setStoryDuration(Math.min(d * 1000, 30000));
                  }}
                  onEnded={() => goToNextRef.current()} /> :


                <img
                  src={currentStory.media_url}
                  alt="Story"
                  className="w-full h-full object-contain" />

                }
              </motion.div>
            </AnimatePresence>

          {likeBurst?.storyId === currentStory.id && <motion.div
            key={likeBurst.id} data-story-like-animation aria-hidden="true"
            className="absolute inset-0 z-20 grid place-items-center pointer-events-none"
            initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.45 }}
            animate={{ opacity: [0, 1, 1, 0], scale: reducedMotion ? 1 : [0.45, 1.12, 1, 0.94] }}
            exit={{ opacity: 0 }} transition={{ duration: 0.85, times: [0, 0.22, 0.66, 1] }}>
            <Heart className="h-24 w-24 fill-white text-white drop-shadow-xl" strokeWidth={1.5}/>
          </motion.div>}

          {/* Gradient overlays for readability */}
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/60 to-transparent z-10 pointer-events-none" />

          {/* Text overlay */}
          {!editorLayout && currentStory.text_overlay &&
          <div className="absolute bottom-24 start-4 end-4 text-center z-20 pointer-events-none">
              <p className="text-white text-lg font-medium drop-shadow-lg bg-black/40 rounded-2xl px-5 py-3">
                {currentStory.text_overlay}
              </p>
            </div>
          }

          {/* Bottom cluster: (sahib) baxış+bəyənmə → (hamı) cavab sayı → (hamı) cavab yaz + bəyən.
              Toxunma/sürüşdürmə naviqasiyasına qarışmasın deyə bütün blok pointer hadisələrini
              özündə saxlayır (dış konteynerin tap-zone/drag handler-lərinə çatmır). */}
          <div
            className="absolute bottom-0 start-0 end-0 z-20 pb-[calc(env(safe-area-inset-bottom,16px)+12px)] px-3 flex flex-col items-center gap-2"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}>
            
            {isOwnStory &&
            <div className="flex items-center gap-2">
                <motion.button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowViewers(true);
                  setIsPaused(true);
                }}
                className="flex flex-col items-center gap-1"
                whileTap={{ scale: 0.95 }}>
                
                  <ChevronUp className="w-5 h-5 text-white/70" />
                  <div className="flex items-center gap-2 bg-black/50 rounded-full px-4 py-2">
                    <Eye className="w-4 h-4 text-white" />
                    <span className="text-white text-sm font-medium">{currentStory.view_count} {tr("storyviewer_baxis_d4da3e", "bax\u0131\u015F")}</span>
                  </div>
                </motion.button>
              </div>
            }

            {currentStory.replies_count > 0 &&
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                setShowReplies(true);
                setIsPaused(true);
              }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1.5 bg-black/50 rounded-full px-3.5 py-1.5">
              
                <MessageCircle className="w-3.5 h-3.5 text-white" />
                <span className="text-white text-xs font-medium">
                  {currentStory.replies_count} {tr('storyviewer_cavab_sayi', 'cavab')}
                </span>
              </motion.button>
            }

            <RestrictionNote scope="comment" />
            <div className="w-full flex items-end gap-2">
              <textarea
                ref={replyTextareaRef}
                value={replyText}
                disabled={moderationStatus?.comment || createStoryReply.isPending}
                onChange={(e) => setReplyText(e.target.value)}
                onFocus={() => setIsPaused(true)}
                onBlur={() => setIsPaused(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendReply();
                  }
                }}
                placeholder={tr('storyviewer_cavab_yaz', 'Cavab yaz...')}
                rows={1}
                className="flex-1 min-w-0 px-4 py-2.5 rounded-2xl bg-white/20 text-white placeholder:text-white/60 text-sm border border-white/20 focus:outline-none focus:border-white/40 resize-none"
                style={{ lineHeight: 1.35, overflowY: 'hidden', maxHeight: 80 }} />
              
              {replyText.trim() &&
              <motion.button
                onClick={(e) => {e.stopPropagation();handleSendReply();}}
                disabled={createStoryReply.isPending || moderationStatus?.comment}
                whileTap={{ scale: 0.9 }}
                className="w-11 h-11 flex-shrink-0 rounded-full bg-white flex items-center justify-center disabled:opacity-50">
                
                  <Send className="w-4 h-4 text-black" />
                </motion.button>
              }
              {!isOwnStory && onToggleLike &&
              <motion.button
                onClick={(e) => {e.stopPropagation();handleToggleLike();}}
                aria-label={tr(currentIsLiked ? 'story_unlike' : 'story_like')}
                aria-pressed={currentIsLiked}
                disabled={likePending}
                whileTap={{ scale: 1.25 }}
                className="w-11 h-11 flex-shrink-0 rounded-full bg-black/50 flex items-center justify-center gap-1 disabled:opacity-60">
                
                  <motion.span
                  key={currentIsLiked ? 'liked' : 'unliked'}
                  initial={false}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
                  
                    <Heart
                    className="w-5 h-5"
                    style={currentIsLiked ? { fill: '#ef4444', color: '#ef4444' } : { color: '#fff' }} />
                  
                  </motion.span>
                </motion.button>
              }
            </div>
          </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={(open) => {
        setShowDeleteConfirm(open);
        if (!open) setIsPaused(false);
      }}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{tr("untranslated_story_silinsin_yil9td", "Story silinsin?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tr("storyviewer_bu_story_hemiselik_silinecek_b_577f00", "Bu story h\u0259mi\u015F\u0259lik silin\u0259c\u0259k. Bu \u0259m\u0259liyyat geri al\u0131na bilm\u0259z.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsPaused(false)}>{tr("storyviewer_legv_et_b5e49c", "Ləğv et")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">{tr("untranslated_sil_zwa7lz", "Sil")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Viewers Bottom Sheet */}
      <AnimatePresence>
        {showViewers &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] bg-black/50"
          onClick={() => {setShowViewers(false);setIsPaused(false);}}>
          
            <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="absolute bottom-0 start-0 end-0 max-h-[70vh] bg-card rounded-t-3xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pb-4 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Eye className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-foreground">{tr("storyviewer_baxislar_e938f5", "Baxışlar")}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <span>{currentStory.view_count} {tr("storyviewer_nefer_dbca98", "n\u0259f\u0259r")}</span>
                      {currentLikesCount > 0 &&
                    <span className="inline-flex items-center gap-0.5">
                          <Heart className="w-3 h-3 fill-red-500 text-red-500" />
                          {currentLikesCount}
                        </span>
                    }
                    </p>
                  </div>
                </div>
                <button
                onClick={() => {setShowViewers(false);setIsPaused(false);}}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Viewers List */}
              <div className="overflow-y-auto max-h-[50vh]" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 20px)' }}>
                {viewersLoading ?
              <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div> :
              viewers.length === 0 ?
              <div className="text-center py-12">
                    <Eye className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">{tr("storyviewer_hele_hec_kim_baxmayib_30427f", "Hələ heç kim baxmayıb")}</p>
                  </div> :

              <div className="px-5 py-2">
                    {viewers.map((viewer) =>
                <div
                  key={viewer.user_id}
                  className="flex items-center gap-3 py-3">
                  
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex-shrink-0">
                          {viewer.avatar_url ?
                    <img
                      src={viewer.avatar_url}
                      alt={viewer.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover" /> :


                    <div className="w-full h-full bg-gradient-to-br from-primary/30 to-pink-500/30 flex items-center justify-center">
                              <span className="text-sm font-bold text-primary">
                                {viewer.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                    }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground truncate flex items-center gap-1.5">
                            {viewer.name}
                            {/* Bəyənənlərin adının yanında ürək (Instagram kimi) */}
                            {viewer.has_liked &&
                      <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500 shrink-0" />
                      }
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatDistanceToNow(new Date(viewer.viewed_at), {
                        addSuffix: true,
                        locale: getCurrentDateLocale()
                      })}
                          </p>
                        </div>
                      </div>
                )}
                  </div>
              }
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Replies Bottom Sheet */}
      <AnimatePresence>
        {showReplies &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] bg-black/50"
          onClick={() => {setShowReplies(false);setIsPaused(false);}}>
          
            <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="absolute bottom-0 start-0 end-0 max-h-[70vh] bg-card rounded-t-3xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
                <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pb-4 border-b border-border/50 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <MessageCircle className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-foreground">{tr('storyviewer_cavablar_basliq', 'Cavablar')}</h3>
                    <p className="text-xs text-muted-foreground">{currentStory.replies_count} {tr("storyviewer_nefer_dbca98", "n\u0259f\u0259r")}</p>
                  </div>
                </div>
                <button
                onClick={() => {setShowReplies(false);setIsPaused(false);}}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Replies List */}
              <div className="overflow-y-auto flex-1" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 20px)' }}>
                {repliesLoading ?
              <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div> :
              replies.length === 0 ?
              <div className="text-center py-12">
                    <MessageCircle className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">{tr('storyviewer_hele_cavab_yoxdur', 'Hələ heç kim cavab verməyib')}</p>
                  </div> :

              <div className="px-5 py-2">
                    {replies.map((reply) =>
                <div
                  key={reply.id}
                  className="flex items-start gap-3 py-3">
                  
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-muted flex-shrink-0">
                          {reply.author?.avatar_url ?
                    <img
                      src={reply.author.avatar_url}
                      alt={reply.author.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover" /> :


                    <div className="w-full h-full bg-gradient-to-br from-primary/30 to-pink-500/30 flex items-center justify-center">
                              <span className="text-xs font-bold text-primary">
                                {(reply.author?.name || '?').charAt(0).toUpperCase()}
                              </span>
                            </div>
                    }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">
                            <span className="font-semibold">{reply.author?.name}</span>{' '}
                            <span className="text-foreground/90">{reply.content}</span>
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(reply.created_at), {
                        addSuffix: true,
                        locale: getCurrentDateLocale()
                      })}
                          </p>
                        </div>
                        {(reply.user_id === user?.id || isAdmin) &&
                  <button
                    onClick={() => handleDeleteReply(reply.id)}
                    className="w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive">
                    
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                  }
                      </div>
                )}
                  </div>
              }
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
    </>,
    document.body
  );

};

export default StoryViewer;
