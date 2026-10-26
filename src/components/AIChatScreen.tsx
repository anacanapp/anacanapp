import { takeAiDraft } from '@/lib/ai-draft';
import { Mascot } from '@/components/anacan/Mascot';
import { rd } from '@/lib/redesign-i18n';
import { useState, useRef, useEffect, forwardRef, memo, useCallback } from 'react';
import { getLocaleTag } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, User, Bot, Loader2, RefreshCw, X, ChevronDown, ChevronUp, Copy, Check, Square, ArrowDown, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

import { useUserStore } from '@/store/userStore';
import { useShallow } from 'zustand/react/shallow';
import { usePregnancyContentByDay } from '@/hooks/usePregnancyContent';
import { useFruitImages, getDynamicFruitData } from '@/hooks/useFruitData';
import { useAIChatHistory } from '@/hooks/useAIChatHistory';
import { useAuth } from '@/hooks/useAuth';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics, trackEvent } from '@/hooks/useScreenAnalytics';
import { FRUIT_SIZES } from '@/types/anacan';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { useAISuggestedQuestions } from '@/hooks/useDynamicTools';
import { getPregnancyDay } from '@/lib/pregnancy-utils';
import { getPhaseInfoForDate } from '@/lib/cycle-utils';
import { useBabyLogs } from '@/hooks/useBabyLogs';
import { useDailyLogs } from '@/hooks/useDailyLogs';
import { useChildren } from '@/hooks/useChildren';
import { useMealLogs } from '@/hooks/useMealLogs';
import { useWeightEntries } from '@/hooks/useWeightEntries';
import { useKickSessions } from '@/hooks/useKickSessions';
import { useSubscription } from '@/hooks/useSubscription';
import PremiumModal from '@/components/PremiumModal';
import MarkdownContent from './MarkdownContent';
import { tr } from "@/lib/tr";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  /** İstifadəçinin mesaja qoşduğu şəkil (chat-media URL) — Gemini vision */
  imageUrl?: string | null;
}

/**
 * Şəkli AI üçün sıxır: max 1280px tərəf, JPEG 0.85.
 * Qaytarır: { blob (yükləmə üçün), base64 (Gemini inline_data üçün, prefikssiz) }
 */
async function compressImageForAI(file: File): Promise<{ blob: Blob; base64: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Image load failed'));
      i.src = url;
    });
    const maxSide = 1280;
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/jpeg', 0.85)
    );
    const base64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] || '');
      r.onerror = () => reject(new Error('read failed'));
      r.readAsDataURL(blob);
    });
    return { blob, base64 };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Memo-lu mesaj sətri — streaming zamanı YALNIZ aktiv mesaj yenidən render olunur.
 * Uzun tarixçələrdə markdown parse yükünü kəskin azaldır (peşəkar chat sürəti).
 */
const ChatMessageRow = memo(({ message, copied, onCopy }: {
  message: Message;
  copied: boolean;
  onCopy: (id: string, content: string) => void;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.18 }}
    className={`a-chat-msg-row${message.role === 'user' ? ' user' : ''}`}>

    <span className={`a-chat-avatar${message.role === 'user' ? ' user' : ''}`}>
      {message.role === 'user' ?
      <User size={13} strokeWidth={2.2} /> :
      <AssistantFace />}
    </span>
    <div className="a-chat-bubble-wrap">
      <div className={`a-chat-bubble ${message.role === 'user' ? 'user' : 'ai'}`}>
        {/* Mesaja qoşulmuş şəkil */}
        {message.imageUrl &&
        <img
          src={message.imageUrl}
          alt=""
          style={{ maxWidth: 220, maxHeight: 260, borderRadius: 12, display: 'block', marginBottom: message.content ? 6 : 0, objectFit: 'cover' }} />
        }
        {/* Typing göstəricisi — ilk token gələnə qədər 3 nöqtə */}
        {message.isStreaming && !message.content ?
        <span className="inline-flex items-center gap-1 py-1" aria-label={tr('aichat_thinking', 'Düşünür...')}>
            {[0, 1, 2].map((i) =>
          <span
            key={i}
            className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: 'var(--a-peach-2)', animationDelay: `${i * 0.15}s` }} />
          )}
          </span> :
        message.role === 'assistant' && !message.isStreaming ?
        <MarkdownContent content={message.content} variant="chat" /> :
        <span className="whitespace-pre-wrap">{message.content}</span>}
        {message.isStreaming && message.content &&
        <span
          className="inline-block w-1.5 h-3.5 ms-1 align-middle animate-pulse"
          style={{ background: 'var(--a-peach-2)', borderRadius: 2 }} />}
      </div>
      {!message.isStreaming &&
      <span className="a-chat-time" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {message.timestamp.toLocaleTimeString(getLocaleTag(), { hour: '2-digit', minute: '2-digit' })}
          {/* Kopyala — text seçimi bağlı olduğu üçün vacibdir */}
          {message.role === 'assistant' && message.content &&
        <button
          type="button"
          onClick={() => onCopy(message.id, message.content)}
          aria-label={tr('aichat_copy', 'Kopyala')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 3, opacity: 0.75 }}>
              {copied ?
          <><Check size={11} strokeWidth={2.4} style={{ color: 'var(--a-green-ink)' }} /><span style={{ fontSize: 9.5, color: 'var(--a-green-ink)', fontWeight: 700 }}>{tr('aichat_copied', 'Kopyalandı')}</span></> :
          <Copy size={11} strokeWidth={2.2} />}
            </button>}
        </span>}
    </div>
  </motion.div>
));
ChatMessageRow.displayName = 'ChatMessageRow';

const companionStage = (stage?: string | null) => (stage === 'bump' || stage === 'mommy' ? stage : 'flow') as 'bump' | 'mommy' | 'flow';

/** Assistant avatar in bubbles: the stage companion's face. */
function AssistantFace() {
  const stage = useUserStore((s) => s.lifeStage);
  return <Mascot stage={companionStage(stage)} pose="mode" width={26} />;
}

const AIChatScreen = forwardRef<HTMLDivElement>((_, ref) => {
  useScrollToTop();
  useScreenAnalytics('AIChat', 'Chat');

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(takeAiDraft);
  const [isLoading, setIsLoading] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const { checkAndConsume } = useSubscription();
  const [isInitialized, setIsInitialized] = useState(false);

  // Şəkil qoşması (Gemini vision): seçilmiş fayl + önizləmə
  const [attachedImage, setAttachedImage] = useState<{file: File;preview: string;} | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 15 * 1024 * 1024) {
      toast({ title: tr('aichat_image_too_big', 'Şəkil çox böyükdür (max 15MB)'), variant: 'destructive' });
      return;
    }
    if (attachedImage) URL.revokeObjectURL(attachedImage.preview);
    setAttachedImage({ file, preview: URL.createObjectURL(file) });
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const clearAttachedImage = () => {
    if (attachedImage) URL.revokeObjectURL(attachedImage.preview);
    setAttachedImage(null);
  };

  // Tibbi xəbərdarlıq banneri: default YIĞILMIŞ, toxununca açılır, X ilə birdəfəlik bağlanır
  const [warnExpanded, setWarnExpanded] = useState(false);
  const [warnVisible, setWarnVisible] = useState(() => {
    try {return !localStorage.getItem('anacan_ai_warn_dismissed');} catch {return true;}
  });
  const dismissWarn = () => {
    setWarnVisible(false);
    try {localStorage.setItem('anacan_ai_warn_dismissed', '1');} catch {/* boş */}
  };

  // ── Peşəkar scroll sistemi (ChatGPT/Claude davranışı) ──
  // pinned = istifadəçi dibdədir → streaming zamanı avtomatik aşağıda qalır.
  // Yuxarı sürüşdürsə → pin açılır, məcburi scroll YOXDUR, "aşağı" düyməsi görünür.
  const viewportRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const [showJumpDown, setShowJumpDown] = useState(false);

  const scrollToBottom = (smooth = false) => {
    const el = viewportRef.current;
    if (!el) return;
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  };

  const handleViewportScroll = () => {
    const el = viewportRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const pinned = distance < 90;
    pinnedRef.current = pinned;
    setShowJumpDown(!pinned);
  };

  // Streaming zamanı hər token-də: pinned-disə dibdə saxla (rAF ilə, jitter-siz)
  useEffect(() => {
    if (!pinnedRef.current) return;
    const raf = requestAnimationFrame(() => scrollToBottom(false));
    return () => cancelAnimationFrame(raf);
  }, [messages]);

  // İlk yüklənmədə (tarixçə bərpasında) dərhal dibə düş
  useEffect(() => {
    if (isInitialized) {
      requestAnimationFrame(() => scrollToBottom(false));
    }
  }, [isInitialized]);

  // Cavabı yarıda saxlamaq üçün
  const abortRef = useRef<AbortController | null>(null);
  // Kopyalama feedback-i
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { lifeStage, getPregnancyData, name, dueDate, babyName, babyBirthDate, lastPeriodDate, cycleLength, periodLength, language } = useUserStore(
    useShallow((s) => ({
      lifeStage: s.lifeStage,
      getPregnancyData: s.getPregnancyData,
      name: s.name,
      dueDate: s.dueDate,
      babyName: s.babyName,
      babyBirthDate: s.babyBirthDate,
      lastPeriodDate: s.lastPeriodDate,
      cycleLength: s.cycleLength,
      periodLength: s.periodLength,
      language: s.language,
    }))
  );
  const { user, profile } = useAuth();
  // Əkiz/üçüz və s. — qarşılama mesajı və AI-a göndərilən kontekst buna görə uyğunlaşır
  const isMultiplePregnancy = !!(profile as any)?.multiples_type && (profile as any).multiples_type !== 'single';
  const { messages: savedMessages, addMessage, clearHistory, loading: historyLoading } = useAIChatHistory('woman');
  const { toast } = useToast();

  const copyMessage = useCallback(async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      toast({ title: tr('aichat_copy_failed', 'Kopyalanmadı'), variant: 'destructive' });
    }
  }, [toast]);
  
  const { todayLogs: babyTodayLogs } = useBabyLogs();
  const { todayLog: motherTodayLog } = useDailyLogs();
  const { selectedChild, getChildAge } = useChildren();
  const { todayLogs: motherMeals } = useMealLogs();
  const { entries: weightEntries } = useWeightEntries();
  const { todaySessions: kickSessions } = useKickSessions();

  const pregnancyData = getPregnancyData();

  // Calculate pregnancy day for dynamic content
  const pregnancyDay = lifeStage === 'bump' ? getPregnancyDay(lastPeriodDate) : 0;

  // Fetch dynamic pregnancy content
  const { data: dayContent } = usePregnancyContentByDay(pregnancyDay > 0 && lifeStage === 'bump' ? pregnancyDay : undefined);
  const { data: fruitImages = [] } = useFruitImages();

  // Get dynamic fruit data from unified source
  const getDynamicFruitName = () => {
    if (!pregnancyData || lifeStage !== 'bump') return null;

    const fruitData = getDynamicFruitData(
      fruitImages,
      pregnancyDay,
      pregnancyData.currentWeek,
      dayContent
    );

    return fruitData.fruit;
  };

  // Create profile object from store data
  const userProfile = {
    name: name || undefined,
    due_date: dueDate ? new Date(dueDate).toISOString().split('T')[0] : undefined,
    baby_name: babyName || undefined,
    baby_birth_date: babyBirthDate ? new Date(babyBirthDate).toISOString().split('T')[0] : undefined,
    last_period_date: lastPeriodDate ? new Date(lastPeriodDate).toISOString().split('T')[0] : undefined,
    cycle_length: cycleLength,
    // Əkiz/üçüz və s. — Dr. Anacan-a göndərilir ki, cavablarında "körpəniz" əvəzinə
    // "körpələriniz" kimi düzgün say-uzlaşmalı danışsın (bax prompts.ts)
    multiples_type: (profile as any)?.multiples_type || undefined,
    baby_count: (profile as any)?.baby_count || undefined
  };

  // Load saved messages on mount
  useEffect(() => {
    if (!historyLoading && !isInitialized && user) {
      if (savedMessages.length > 0) {
        // Restore saved messages
        const restoredMessages: Message[] = savedMessages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.created_at),
          imageUrl: (m as any).image_url || null
        }));
        setMessages(restoredMessages);
      } else {
        // Show welcome message for new users
        const welcomeMessage = getWelcomeMessage();
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: welcomeMessage,
          timestamp: new Date()
        }]);
      }
      setIsInitialized(true);
    }
  }, [historyLoading, savedMessages, user, isInitialized]);

  const getWelcomeMessage = () => {
    const userName = name ? `, ${name}` : '';
    const dynamicFruit = getDynamicFruitName();
    const lang = useUserStore.getState().language || 'az';

    if (lang === 'en') {
      switch (lifeStage) {
        case 'flow':
          return `Hello${userName}. I'm Anacan.AI. I'm ready to professionally answer your questions about menstrual cycles, symptoms, and general health.`;
        case 'bump':
          return `Hello${userName}. I'm Anacan.AI. ${pregnancyData ? `You're currently in week ${pregnancyData.currentWeek} of pregnancy; ${isMultiplePregnancy ? 'your babies are' : 'your baby is'} about the size of a ${dynamicFruit || pregnancyData.babySize.fruit}. ` : ''}You can ask any questions about your pregnancy.`;
        case 'mommy':
          return `Hello${userName}. I'm Anacan.AI. I'm here to support you with questions about baby care, breastfeeding, sleep routines and postpartum recovery.`;
        default:
          return `Hello${userName}. I'm Anacan.AI. How can I help you?`;
      }
    }

    switch (lifeStage) {
      case 'flow':
        return `${tr("aichat_welcome_flow_1", "Salam")}${userName}. ${tr("aichat_welcome_flow_2", "Mən Anacan.AI. Menstrual tsikl, simptomlar və ümumi sağlamlıq üzrə suallarınıza peşəkar cavab verməyə hazıram.")}`;
      case 'bump':
        return `${tr("aichat_welcome_bump_1", "Salam")}${userName}. ${tr("aichat_welcome_bump_2", "Mən Anacan.AI.")} ${pregnancyData ? (isMultiplePregnancy ? tr("aichat_welcome_bump_3_multiple", "Hazırda hamiləliyin {0}-ci həftəsindəsiniz; körpələriniz təxminən {1} böyüklüyündədir. ") : tr("aichat_welcome_bump_3", "Hazırda hamiləliyin {0}-ci həftəsindəsiniz; körpəniz təxminən {1} böyüklüyündədir. ")).replace('{0}', String(pregnancyData.currentWeek)).replace('{1}', dynamicFruit || pregnancyData.babySize.fruit) : ''}${tr("aichat_welcome_bump_4", "Hamiləlik dövrü ilə bağlı suallarınızı verə bilərsiniz.")}`;
      case 'mommy':
        return `${tr("aichat_welcome_mommy_1", "Salam")}${userName}. ${tr("aichat_welcome_mommy_2", "Mən Anacan.AI. Körpə baxımı, əmizdirmə, yuxu rejimi və doğuşdan sonrakı bərpa ilə bağlı suallarınıza dəstək olmağa hazıram.")}`;
      default:
        return `${tr("aichat_welcome_default_1", "Salam")}${userName}. ${tr("aichat_welcome_default_2", "Mən Anacan.AI. Sizə necə kömək edə bilərəm?")}`;
    }
  };


  const sendMessage = async (rawText: string) => {
    const image = attachedImage;
    const text = rawText.trim() || (image ? tr('aichat_photo_placeholder', '📷 Şəkil') : '');
    if ((!text && !image) || isLoading) return;

    // Pulsuz plan: gündəlik sual limiti (paywall "Limitsiz AI" vədinin real tətbiqi)
    const { allowed, remaining } = await checkAndConsume('ai_chat');
    if (!allowed) {
      setShowPremiumModal(true);
      return;
    }
    if (Number.isFinite(remaining) && remaining <= 2) {
      toast({
        title: tr('aichat_limit_warn_title', 'Pulsuz limit azalır'),
        description: tr('aichat_limit_warn_desc', 'Bu gün {n} pulsuz sualınız qalıb. Premium ilə limitsizdir.').replace('{n}', String(remaining))
      });
    }

    // Şəkil varsa: sıx + yüklə (bubble URL üçün) + base64 (Gemini üçün)
    let imageBase64: string | null = null;
    let imageUrl: string | null = null;
    if (image) {
      try {
        const { blob, base64 } = await compressImageForAI(image.file);
        imageBase64 = base64;
        if (user) {
          const path = `${user.id}/ai_${Date.now()}.jpg`;
          const { error: upErr } = await supabase.storage.
          from('chat-media').
          upload(path, blob, { contentType: 'image/jpeg' });
          if (!upErr) {
            const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(path);
            imageUrl = urlData.publicUrl;
          }
        }
      } catch (e) {
        console.error('AI image prep failed:', e);
        toast({ title: tr('aichat_image_failed', 'Şəkil hazırlana bilmədi'), variant: 'destructive' });
        return;
      }
      clearAttachedImage();
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
      imageUrl: imageUrl || image?.preview || null
    };

    const assistantMessageId = `assistant-${Date.now()}`;

    setMessages((prev) => [...prev, userMessage, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    }]);

    // Öz mesajını göndərəndə HƏMİŞƏ dibə düş (peşəkar chat davranışı)
    pinnedRef.current = true;
    setShowJumpDown(false);
    requestAnimationFrame(() => scrollToBottom(false));

    // DB yazısı arxa planda — sorğunu GECİKDİRMİR (əvvəllər await edilirdi)
    void addMessage('user', text, imageUrl).catch((e) => console.error('addMessage error:', e));

    setInput('');
    setIsLoading(true);

    // Stop düyməsi üçün abort controller
    const controller = new AbortController();
    // Stream token-lərini ref-də topla və ~80ms-də bir state-ə yaz:
    // hər token-də setMessages + Markdown parse zəif cihazları dondururdu.
    let pendingStreamContent: string | null = null;
    let streamFlushTimer: ReturnType<typeof setTimeout> | null = null;
    const cancelStreamFlush = () => {
      if (streamFlushTimer) clearTimeout(streamFlushTimer);
      streamFlushTimer = null;
      pendingStreamContent = null;
    };
    const flushStream = () => {
      const content = pendingStreamContent;
      cancelStreamFlush();
      if (content === null) return;
      setMessages((prev) => prev.map((m) =>
      m.id === assistantMessageId ?
      { ...m, content } :
      m
      ));
    };
    const scheduleStreamFlush = (content: string) => {
      pendingStreamContent = content;
      if (!streamFlushTimer) streamFlushTimer = setTimeout(flushStream, 80);
    };
    abortRef.current = controller;

    try {
      const conversationHistory = messages.
      filter((m) => m.id !== 'welcome').
      map((m) => ({
        role: m.role,
        content: m.content
      }));

      conversationHistory.push({
        role: 'user',
        content: text
      });

      // Use fetch for streaming support — must use the user's session JWT, not the anon key
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error(tr("aichatscreen_sessiya_tapilmadi_yeniden_daxi_455503", "Sessiya tap\u0131lmad\u0131. Yenid\u0259n daxil olun."));
      }
      const response = await fetch(`${getBackendConfig().url}/functions/v1/dr-anacan-chat`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': getBackendConfig().publishableKey
        },
        body: JSON.stringify({
          messages: conversationHistory,
          lifeStage: lifeStage || 'bump',
          pregnancyWeek: pregnancyData?.currentWeek,
          isPartner: false,
          stream: true,
          language: useUserStore.getState().language || 'az',
          // Gemini vision: son user mesajına şəkil qoşulur (bax dr-anacan-chat)
          ...(imageBase64 ? { imageBase64, imageMime: 'image/jpeg' } : {}),
          ...(lifeStage === 'flow' && lastPeriodDate ? (() => {
            try {
              const info = getPhaseInfoForDate(new Date(), new Date(lastPeriodDate), cycleLength || 28, periodLength || 5);
              return { cyclePhase: info.phase, cycleDay: info.dayInCycle };
            } catch {return {};}
          })() : {}),
          userProfile: {
            name: userProfile.name,
            dueDate: userProfile.due_date,
            babyName: userProfile.baby_name,
            babyBirthDate: userProfile.baby_birth_date,
            lastPeriodDate: userProfile.last_period_date,
            cycleLength: userProfile.cycle_length,
            multiplesType: userProfile.multiples_type,
            babyCount: userProfile.baby_count,
            selectedChildDetails: selectedChild ? {
              name: selectedChild.name,
              gender: selectedChild.gender,
              birthDate: selectedChild.birth_date,
              exactAge: getChildAge(selectedChild)
            } : null,
            recentMotherLog: motherTodayLog ? {
              mood: motherTodayLog.mood,
              waterIntake: motherTodayLog.water_intake,
              symptoms: motherTodayLog.symptoms
            } : null,
            recentBabyLogs: babyTodayLogs?.map(l => ({
              type: l.log_type,
              amount: (l as any).amount_ml,
              food: (l as any).food_name,
              duration: (l as any).duration_mins,
              quality: (l as any).sleep_quality,
              poop: (l as any).poop_type,
              feedType: l.feed_type,
              diaperType: l.diaper_type,
              notes: l.notes,
              startTime: l.start_time
            })) || [],
            recentMotherMeals: motherMeals?.map(m => ({
              type: m.meal_type,
              food: m.food_name,
              calories: m.calories
            })) || [],
            latestWeight: weightEntries?.length > 0 ? weightEntries[0].weight : null,
            todayKickSessions: kickSessions?.map(k => ({
              kicks: k.kick_count,
              duration: k.duration_seconds
            })) || []
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || tr("aichatscreen_api_xetasi_1b7c03", "API x\u0259tas\u0131"));
      }

      // Handle streaming response
      const reader = response.body?.getReader();

      if (reader) {
        const decoder = new TextDecoder();
        let fullContent = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;
              if (!data) continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || '';
                if (content) {
                  fullContent += content;
                  scheduleStreamFlush(fullContent);
                }
              } catch (parseErr) {
                console.warn('AIChatScreen: skipped unparseable SSE chunk', parseErr);
              }
            }
          }
        }

        // Process any remaining buffer after stream ends
        if (buffer.trim()) {
          for (const line of buffer.split('\n')) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]' || !data) continue;
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || '';
                if (content) fullContent += content;
              } catch (parseErr) {
                console.warn('AIChatScreen: skipped trailing unparseable SSE chunk', parseErr);
              }
            }
          }
        }

        // Mark streaming as complete and save to database
        cancelStreamFlush();
        const finalContent = fullContent || tr("aichatscreen_bagislayin_cavab_ala_bilmedim_4078bf", "Ba\u011F\u0131\u015Flay\u0131n, cavab ala bilm\u0259dim.");
        setMessages((prev) => prev.map((m) =>
        m.id === assistantMessageId ?
        { ...m, isStreaming: false, content: finalContent } :
        m
        ));
        // Save assistant message to database
        if (fullContent) {
          await addMessage('assistant', fullContent);
        }
      } else {
        // Fallback to non-streaming response
        const data = await response.json();
        const content = data.message || tr("aichatscreen_bagislayin_cavab_ala_bilmedim_4078bf", "Ba\u011F\u0131\u015Flay\u0131n, cavab ala bilm\u0259dim.");
        setMessages((prev) => prev.map((m) =>
        m.id === assistantMessageId ?
        { ...m, isStreaming: false, content } :
        m
        ));
        if (data.message) {
          await addMessage('assistant', data.message);
        }
      }
    } catch (error: any) {
      // Stop düyməsi ilə dayandırıldı — qismən cavabı saxla, xəta göstərmə
      if (error?.name === 'AbortError') {
        // Buferdə qalan mətni əvvəlcə state-ə yaz ki, qismən cavab itməsin
        flushStream();
        setMessages((prev) => {
          const target = prev.find((m) => m.id === assistantMessageId);
          const partial = target?.content || '';
          if (partial) {
            void addMessage('assistant', partial).catch(() => {});
            return prev.map((m) => m.id === assistantMessageId ? { ...m, isStreaming: false } : m);
          }
          // Heç nə gəlməmişdisə boş bubble-ı sil
          return prev.filter((m) => m.id !== assistantMessageId);
        });
      } else {
        cancelStreamFlush();
        console.error('Chat error:', error);
        toast({
          title: tr("aichatscreen_xeta_3cdbb6", 'Xəta'),
          description: tr("aichatscreen_mesaj_gonderile_bilmedi_yeniden_cehd_edi_aa6662", 'Mesaj göndərilə bilmədi. Yenidən cəhd edin.'),
          variant: 'destructive'
        });

        setMessages((prev) => prev.map((m) =>
        m.id === assistantMessageId ?
        { ...m, isStreaming: false, content: tr("aichatscreen_bagislayin_texniki_xeta_bas_verdi_zehmet_feb7d7", "Bağışlayın, texniki xəta baş verdi. Zəhmət olmasa yenidən cəhd edin. 🙏") } :
        m
        ));
      }
    } finally {
      cancelStreamFlush();
      abortRef.current = null;
      setIsLoading(false);
    }
  };

  const handleSend = () => sendMessage(input);

  const stopGeneration = () => {
    abortRef.current?.abort();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = async () => {
    await clearHistory();
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: getWelcomeMessage(),
      timestamp: new Date()
    }]);
  };

  // Fetch dynamic suggested questions
  const { data: dynamicQuestions = [] } = useAISuggestedQuestions(lifeStage || 'bump', 'mother');

  const suggestedQuestions = dynamicQuestions.length > 0 ?
  dynamicQuestions.map((q) => q.question) :
  lifeStage === 'bump' ?
  [tr("aichatscreen_bu_hefte_korpem_nece_inkisaf_e_7ffbca", "Bu h\u0259ft\u0259 k\xF6rp\u0259m nec\u0259 inki\u015Faf edir?"), tr("aichatscreen_hamilelikde_hansi_qidalar_fayd_cfee1a", "Hamil\u0259likd\u0259 hans\u0131 qidalar faydal\u0131d\u0131r?"), tr("aichatscreen_urek_bulanmasina_qarsi_ne_ede__39caf3", "\xDCr\u0259k bulanmas\u0131na qar\u015F\u0131 n\u0259 ed\u0259 bil\u0259r\u0259m?")] :




  lifeStage === 'mommy' ?
  [tr("aichatscreen_korpemi_nece_duzgun_emizdirmel_05cf51", "K\xF6rp\u0259mi nec\u0259 d\xFCzg\xFCn \u0259mizdirm\u0259liy\u0259m?"), tr("aichatscreen_yenidoganin_yuxu_qrafiki_nece__9e1277", "Yenido\u011Fan\u0131n yuxu qrafiki nec\u0259 olmal\u0131d\u0131r?"), tr("aichatscreen_korpem_niye_aglayir_b5dc07", "K\xF6rp\u0259m niy\u0259 a\u011Flay\u0131r?")] :




  [tr("aichatscreen_menstrual_tsiklim_haqqinda_mel_0616ab", "Menstrual tsiklim haqq\u0131nda m\u0259lumat ver"), tr("aichatscreen_pms_simptomlari_ile_nece_mubar_4c2325", "PMS simptomlar\u0131 il\u0259 nec\u0259 m\xFCbariz\u0259 apar\u0131m?"), tr("aichatscreen_fertil_pencerem_ne_vaxtdir_7a0f65", "Fertil p\u0259nc\u0259r\u0259m n\u0259 vaxtd\u0131r?")];





  return (
    <div ref={ref} className="a-scope fixed inset-x-0 top-0 flex flex-col overflow-x-hidden" style={{ bottom: 'calc(94px + env(safe-area-inset-bottom, 0px))', background: 'var(--a-bg)' }}>
      {/* Chat header (anacan-demo) */}
      <div className="safe-area-top" style={{ paddingInlineStart: 20, paddingInlineEnd: 20, flexShrink: 0 }}>
        <div className="a-chat-header">
          <span className="a-chat-header-avatar a3-ai-face">
            <Mascot stage={companionStage(lifeStage)} pose="mode" width={40} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="a-chat-header-name a-heading">{tr("bottomnav_anacan_ai", 'Anacan.AI')}</h1>
            <div className="a-chat-header-status">
              <span className="a-chat-status-dot" />
              {tr("untranslated_onlayn_xfaffi", "Onlayn")} · {tr("aichatscreen_hekim_mesleheti_evezi_deyil_a1808c", "⚕️ Həkim məsləhəti əvəzi deyil").replace('⚕️ ', '')}
            </div>
          </div>
          <button type="button" className="a-icon-btn" onClick={clearChat} aria-label="Reset">
            <RefreshCw size={15} strokeWidth={2} />
          </button>
        </div>

        {/* Tibbi xəbərdarlıq — yığılmış default, toxununca açılır, X ilə bağlanır */}
        {warnVisible &&
        <div className="a-chat-warn">
            <div
            className="a-chat-warn-summary"
            style={{ cursor: 'pointer', alignItems: 'flex-start' }}
            onClick={() => setWarnExpanded((v) => !v)}
            role="button"
            aria-expanded={warnExpanded}>

              <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>⚕️</span>
              <span
              className="txt"
              style={warnExpanded ? undefined : {
                display: '-webkit-box',
                WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}>
                {warnExpanded ?
              tr("aichatscreen_medical_disclaimer_banner", "Anacan.AI tibbi məsləhət, diaqnoz və ya müalicə əvəzi DEYİL. Verilən məlumatlar yalnız informasiya xarakterli olub yalnız təhsil məqsədi daşıyır. Hər hansı tibbi qərar verməzdən əvvəl mütləq həkiminizə və ya ixtisaslı tibb işçisinə müraciət edin. Təcili hallarda 103-ə zəng edin.") :
              tr("aichatscreen_warn_short", "Tibbi məsləhət əvəzi deyil — ətraflı üçün toxunun")}
              </span>
              <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                {warnExpanded ?
              <ChevronUp size={13} strokeWidth={2.2} style={{ opacity: 0.6 }} /> :
              <ChevronDown size={13} strokeWidth={2.2} style={{ opacity: 0.6 }} />}
                <button
                type="button"
                onClick={(e) => {e.stopPropagation();dismissWarn();}}
                aria-label={tr("aichatscreen_warn_close", "Xəbərdarlığı bağla")}
                style={{
                  background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer',
                  width: 20, height: 20, borderRadius: 999,
                  display: 'grid', placeItems: 'center', color: 'inherit'
                }}>
                  <X size={11} strokeWidth={2.4} />
                </button>
              </span>
            </div>
          </div>
        }
      </div>

      {/* Messages — idarə olunan viewport (global scroll reset-dən qorunur) */}
      <div
        ref={viewportRef}
        onScroll={handleViewportScroll}
        data-scroll-ignore
        className="flex-1 overflow-y-auto overscroll-contain relative"
        style={{ paddingInlineStart: 20, paddingInlineEnd: 20, WebkitOverflowScrolling: 'touch' }}>

        <div className="pb-4 pt-1">
          <AnimatePresence initial={false}>
            {messages.map((message) =>
            <ChatMessageRow
              key={message.id}
              message={message}
              copied={copiedId === message.id}
              onCopy={copyMessage} />
            )}
          </AnimatePresence>
        </div>

        {/* Suggested Questions — toxunan kimi göndərilir */}
        {messages.length <= 1 && !isLoading &&
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="pb-4">
          
            <div className="a3-ai-intro">
              <Mascot stage={companionStage(lifeStage)} pose="welcome" width={96} bob />
              <p className="a3-ai-intro-title">{rd('ai_intro_title')}</p>
              <p className="a3-meta">{rd('ai_intro_text')}</p>
            </div>
            <p className="a-chat-suggest-label">{tr("aichatscreen_meslehet_ucun_sual_secin_3c0236", "Məsləhət üçün sual seçin:")}</p>
            <div className="a-chat-suggest-row">
              {suggestedQuestions.map((question, index) =>
            <motion.button
              key={index}
              whileTap={{ scale: 0.97 }}
              onClick={() => sendMessage(question)}
              className="a-chat-suggest-btn">
              
                  {question}
                </motion.button>
            )}
            </div>
          </motion.div>
        }
      </div>

      {/* "Aşağı düş" düyməsi — yuxarı sürüşdürəndə görünür */}
      <AnimatePresence>
        {showJumpDown &&
        <motion.button
          initial={{ opacity: 0, y: 8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.9 }}
          onClick={() => {
            pinnedRef.current = true;
            setShowJumpDown(false);
            scrollToBottom(true);
          }}
          aria-label={tr('aichat_jump_down', 'Ən son mesaja keç')}
          className="absolute grid place-items-center"
          style={{
            insetInlineEnd: 18, bottom: 86, zIndex: 5,
            width: 38, height: 38, borderRadius: 999,
            background: 'var(--a-surface)', border: '1px solid var(--a-line)',
            boxShadow: '0 10px 24px -8px rgba(217, 108, 74, 0.45)',
            color: 'var(--a-accent-ink)', cursor: 'pointer'
          }}>
            <ArrowDown size={16} strokeWidth={2.4} />
            {isLoading &&
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ border: '2px solid var(--a-peach-2)' }}
            animate={{ opacity: [0.7, 0], scale: [1, 1.35] }}
            transition={{ duration: 1.4, repeat: 2 }} />
          }
          </motion.button>
        }
      </AnimatePresence>

      {/* Input Area (anacan-demo pill) */}
      <div style={{ padding: '8px 16px 10px', flexShrink: 0 }}>
        {/* Seçilmiş şəkil önizləməsi */}
        {attachedImage &&
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: '6px 10px', borderRadius: 14, background: 'var(--a-surface)', border: '1px solid var(--a-line)' }}>
            <img src={attachedImage.preview} alt="" style={{ width: 42, height: 42, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 11.5, color: 'var(--a-ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tr('aichat_image_attached', 'Şəkil qoşuldu — sualınızı yazın və göndərin')}
            </span>
            <button
            type="button"
            onClick={clearAttachedImage}
            aria-label={tr('aichat_image_remove', 'Şəkli sil')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-ink-faint)', padding: 4, flexShrink: 0 }}>
              <X size={15} strokeWidth={2.2} />
            </button>
          </div>
        }
        <div className="a-chat-input">
          {/* Şəkil qoş (Gemini vision) */}
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={isLoading}
            aria-label={tr('aichat_attach_image', 'Şəkil əlavə et')}
            title={tr('aichat_attach_image', 'Şəkil əlavə et')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 4px 6px 0', color: attachedImage ? 'var(--a-peach-2)' : 'var(--a-ink-faint)', flexShrink: 0, display: 'inline-flex', alignItems: 'center', opacity: isLoading ? 0.5 : 1 }}>
            <ImagePlus size={17} strokeWidth={2.1} />
          </button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            onFocus={() => {
              // Klaviatura açılanda pinned-diksə dibdə qal
              setTimeout(() => {if (pinnedRef.current) scrollToBottom(false);}, 250);
            }}
            placeholder={tr('aichat_input_ph', 'Anacan.AI-yə sualınızı yazın...')}
            className="min-h-[34px] max-h-[100px] border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 py-2"
            disabled={isLoading} />
          
          {isLoading ?
          <button
            type="button"
            className="a-chat-send"
            onClick={stopGeneration}
            aria-label={tr('aichat_stop', 'Dayandır')}
            title={tr('aichat_stop', 'Dayandır')}>
              <Square size={12} strokeWidth={2.6} fill="currentColor" />
            </button> :

          <button
            type="button"
            className="a-chat-send"
            onClick={handleSend}
            disabled={!input.trim() && !attachedImage}
            aria-label="Send">
              <Send size={15} strokeWidth={2.2} />
            </button>
          }
        </div>
      </div>

      <PremiumModal
        isOpen={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        feature="ai_chat" />

    </div>);

});

AIChatScreen.displayName = 'AIChatScreen';

export default AIChatScreen;
