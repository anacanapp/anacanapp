import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { tr } from '@/lib/tr';
import { pushBackHandler } from '@/lib/backButton';
import { countedSteps, type TourNav, type TourStage, type TourStep, type TourSub, type TourTool } from '@/lib/onboardingTour';
import './glass-tour.css';

/**
 * Glass guided tour over the real app (docs/prototypes/inapp-onboarding-v3.html).
 * Every sub-step first moves the app to its screen (onNavigate), then highlights a data-tour target
 * (spot), explains the open screen (coach), asks for push (push) or shows a full card (card).
 * Tapping the highlighted element advances the tour; the rest of the screen is blocked only while
 * something is highlighted, so on tool pages the user can use the tool itself.
 */
export interface GlassTourProps {
  plan: TourStep[];
  name: string;
  stage: TourStage;
  isPremium: boolean;
  aiFreePerDay: number;
  tools: TourTool[];
  onNavigate: (nav: TourNav) => void;
  onPush: () => Promise<void>;
  onPremium: () => void;
  onFinish: (status: 'done' | 'skipped', step: string) => void;
}

interface Rect { left: number; top: number; width: number; height: number }
const fill = (text: string, vars: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

export default function GlassTour(props: GlassTourProps) {
  const { plan, name, stage, isPremium, aiFreePerDay, tools, onNavigate, onPush, onPremium, onFinish } = props;
  const [pos, setPos] = useState({ si: 0, ui: 0 });
  const [rect, setRect] = useState<Rect | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const lastNav = useRef('');
  const step = plan[pos.si];
  const sub: TourSub = step.subs[pos.ui];
  const counted = countedSteps(plan);
  const stepNo = plan.slice(0, pos.si + 1).filter((s) => s.id !== 'welcome' && s.id !== 'final').length;
  const hasMood = plan.some((s) => s.id === 'mood');
  const toolName = (id?: string) => tools.find((t) => t.id === id)?.name || '';
  const toolText = (id?: string) => tools.find((t) => t.id === id)?.description || '';

  const finish = useCallback((status: 'done' | 'skipped') => onFinish(status, `${step.id}:${pos.ui}`), [onFinish, step.id, pos.ui]);
  const next = useCallback(() => {
    setPos((p) => {
      const s = plan[p.si];
      if (p.ui < s.subs.length - 1) return { si: p.si, ui: p.ui + 1 };
      if (p.si < plan.length - 1) return { si: p.si + 1, ui: 0 };
      return p;
    });
  }, [plan]);
  const isLast = pos.si === plan.length - 1 && pos.ui === step.subs.length - 1;
  const prev = useCallback(() => setPos((p) => (p.ui > 0 ? { si: p.si, ui: p.ui - 1 } : p.si > 0 ? { si: p.si - 1, ui: plan[p.si - 1].subs.length - 1 } : p)), [plan]);

  // 1) move the app to the sub-step's screen (only when it changes, so tools are not remounted needlessly)
  useEffect(() => {
    const key = JSON.stringify(sub.nav);
    if (key !== lastNav.current) { lastNav.current = key; onNavigate(sub.nav); }
  }, [sub, onNavigate]);

  // 2) find and track the highlighted element
  useLayoutEffect(() => {
    setRect(null); setMissing(false);
    if (sub.kind !== 'spot' || !sub.target) return;
    let alive = true, tries = 0, raf = 0, scrolled = false;
    const selector = `[data-tour="${sub.target}"]`;
    const measure = () => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) return false;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      if (!scrolled && (r.top < 60 || r.bottom > window.innerHeight - 90)) { scrolled = true; el.scrollIntoView({ block: 'center' }); return false; }
      setRect({ left: r.left, top: r.top, width: r.width, height: r.height });
      return true;
    };
    const poll = () => {
      if (!alive) return;
      if (measure()) return;
      if (++tries > 30) { setMissing(true); return; }
      window.setTimeout(poll, 100);
    };
    poll();
    const onMove = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (alive) measure(); }); };
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    // tapping the highlighted element is the same as "next" (the app performs its own navigation)
    const onClick = (e: MouseEvent) => { if ((e.target as Element | null)?.closest?.(selector)) window.setTimeout(next, 0); };
    document.addEventListener('click', onClick, true);
    return () => { alive = false; cancelAnimationFrame(raf); window.removeEventListener('resize', onMove); window.removeEventListener('scroll', onMove, true); document.removeEventListener('click', onClick, true); };
  }, [sub, next]);

  // Android back: one sub-step back; on the first card it closes the tour.
  useEffect(() => pushBackHandler(() => { if (pos.si === 0 && pos.ui === 0) finish('skipped'); else prev(); return true; }), [pos, prev, finish]);

  const copy = useMemo(() => {
    const where = (area: string) => `${tr('obtour_here', 'Siz buradasınız')}: ${area}`;
    const toolsArea = tr('obtour_where_tools', 'Alətlər');
    switch (sub.copy) {
      case 'mood_tab': return { title: tr('obtour_mood_tab_title', 'Əvvəlcə Alətlər'), text: tr('obtour_mood_tab_text', 'Aşağıdakı menyuda bu düyməyə basın.') };
      case 'mood_tile': return { title: tr('obtour_mood_tile_title', 'Əhval Gündəliyi burada'), text: tr('obtour_mood_tile_text', 'Ödənişsiz alətlər arasındadır. Basın, açaq.'), where: where(toolsArea) };
      case 'mood_log': return { title: tr('obtour_mood_log_title', 'Bu gün necəsiniz?'), text: tr('obtour_mood_log_text', 'Əhvalınızı seçib yadda saxlayın. Gündə 5 saniyə kifayətdir.'), where: where(`${toolsArea} › ${toolName(sub.toolId)}`) };
      case 'push': return { title: hasMood ? tr('obtour_push_title', 'Axşamlar əhval yoxlamasını xatırladaq?') : tr('obtour_push_title_general', 'Vacib xatırlatmaları göndərək?'), text: tr('obtour_push_text', 'Yalnız faydalı xatırlatmalar. İstənilən an Ayarlardan söndürə bilərsiniz.') };
      case 'tools_tab': return { title: tr('obtour_tools_tab_title', 'Bütün alətlər burada'), text: tr('obtour_tools_tab_text', 'Aşağıdakı menyuda Alətlər düyməsinə basın.') };
      case 'tools_list_free': return { title: tr('obtour_tools_free_title', 'Bunlar sizdə ödənişsizdir'), text: tr('obtour_tools_free_text', 'Hər zaman açıqdır. İkisinə birlikdə baxaq.'), where: where(toolsArea) };
      case 'tools_list_premium': return { title: tr('obtour_tools_premium_title', 'Premium alətləriniz açıqdır'), text: tr('obtour_tools_premium_text', 'Mərhələnizə görə ən faydalıları yuxarıdadır. İkisinə baxaq.'), where: where(toolsArea) };
      case 'tool_page': return { title: toolName(sub.toolId), text: toolText(sub.toolId), where: where(`${toolsArea} › ${toolName(sub.toolId)}`) };
      case 'ai_tab': return { title: tr('obtour_ai_tab_title', 'Anacan AI'), text: tr('obtour_ai_tab_text', 'Gecə 3-də də cavab verir. Basın, açaq.') };
      case 'ai_screen_free': return { title: tr('obtour_ai_title', 'İstədiyinizi soruşun'), text: fill(tr('obtour_ai_free_text', 'Gündə {n} sual ödənişsizdir. Sualınızı yazın və ya hazır suallardan birini seçin.'), { n: aiFreePerDay }), where: where(tr('obtour_where_ai', 'Anacan AI')) };
      case 'ai_screen_premium': return { title: tr('obtour_ai_title', 'İstədiyinizi soruşun'), text: tr('obtour_ai_premium_text', 'Limitsizdir. Sualınızı yazın və ya hazır suallardan birini seçin.'), where: where(tr('obtour_where_ai', 'Anacan AI')) };
      case 'community_tab': return { title: tr('obtour_community_tab_title', 'İcma'), text: stage === 'flow' ? tr('obtour_community_tab_text_flow', 'Sizin kimi qadınlar: sual verin, təcrübə paylaşın.') : tr('obtour_community_tab_text_mom', 'Sizin kimi analar: sual verin, təcrübə paylaşın.') };
      case 'community_screen': return { title: tr('obtour_community_title', 'Burada tək deyilsiniz'), text: tr('obtour_community_text', 'Maraqlı mövzuları izləyin, cavablar bildiriş kimi gəlsin.'), where: where(tr('obtour_where_community', 'İcma')) };
      default: return { title: '', text: '' };
    }
  }, [sub, hasMood, stage, aiFreePerDay, tools]); // eslint-disable-line react-hooks/exhaustive-deps

  const head = <div className="gt-head"><span>{fill(tr('obtour_step', '{n} / {total}'), { n: stepNo, total: counted })}</span>
    {step.subs.length > 1 && <span className="gt-dots" aria-hidden="true">{step.subs.map((_, k) => <i key={k} className={k === pos.ui ? 'on' : ''} />)}</span>}</div>;
  const skip = <button type="button" className="gt-skip" onClick={() => finish('skipped')}>{tr('obtour_skip', 'Turu bağla')}</button>;

  let body: JSX.Element;
  if (sub.kind === 'card') {
    if (sub.copy === 'welcome') {
      body = <div className="gt-card-wrap" role="dialog" aria-modal="true" aria-label={tr('obtour_welcome_kick', 'Planın hazırdır')}>
        <div className="gt-art" aria-hidden="true" />
        <div className="gt-card gt-glass">
          <div className="gt-kick">{tr('obtour_welcome_kick', 'Planın hazırdır')}</div>
          <h2>{fill(tr('obtour_welcome_title', 'Xoş gəldin, {name}!'), { name })}</h2>
          <p className="gt-text">{tr('obtour_welcome_text', 'Sənə əsas yerləri göstərək: alətlər, Anacan AI və İcma. Təxminən 40 saniyə.')}</p>
          <button type="button" className="gt-btn full" onClick={next} autoFocus>{tr('obtour_start', 'Başlayaq')}</button>
          <button type="button" className="gt-link" onClick={() => finish('skipped')}>{tr('obtour_later', 'Sonra, özüm baxaram')}</button>
        </div></div>;
    } else if (sub.copy === 'premium') {
      const items: Array<[string, string]> = [
        ['📊', stage === 'flow' ? tr('obtour_prem_b1_flow', 'Ovulyasiya və simptom analizi') : stage === 'bump' ? tr('obtour_prem_b1_bump', 'Hamiləlik alətləri: təpik, sancı, çəki') : tr('obtour_prem_b1_mommy', 'Bütün izləmə alətləri: yuxu, qidalanma, boy-çəki')],
        ['✨', tr('obtour_prem_b2', 'Limitsiz Anacan AI')],
        ['📄', tr('obtour_prem_b3', 'Həkim üçün PDF hesabat')],
        stage === 'flow' ? ['💊', tr('obtour_prem_b4_flow', 'Vitamin və qidalanma izləmə')] : ['👨‍👩‍👧', tr('obtour_prem_b4', 'Partnyor hesabı')],
        ['🚫', tr('obtour_prem_b5', 'Reklamsız təcrübə')]];
      body = <div className="gt-card-wrap" role="dialog" aria-modal="true" aria-label={tr('obtour_premium_badge', 'Anacan Premium')}>
        <div className="gt-art" aria-hidden="true">👑</div>
        <div className="gt-card gt-glass">
          <span className="gt-badge">👑 {tr('obtour_premium_badge', 'Anacan Premium')}</span>
          <h2>{tr('obtour_premium_title', 'Daha çoxunu açın')}</h2>
          <p className="gt-text">{tr('obtour_premium_text', 'Ödənişsiz plan sizində qalır. Premium ilə əlavə olaraq:')}</p>
          <ul className="gt-items">{items.map(([icon, text]) => <li key={text}><i aria-hidden="true">{icon}</i><span>{text}</span></li>)}</ul>
          <button type="button" className="gt-btn gold full" onClick={() => { finish('done'); onPremium(); }}>{tr('obtour_premium_cta', 'Premium-a bax')}</button>
          <button type="button" className="gt-link" onClick={next}>{tr('obtour_premium_free', 'Ödənişsiz davam et')}</button>
        </div></div>;
    } else {
      body = <div className="gt-card-wrap" role="dialog" aria-modal="true" aria-label={tr('obtour_final_title', 'Hazırsınız!')}>
        <div className="gt-art" aria-hidden="true">✨</div>
        <div className="gt-card gt-glass">
          <h2>{tr('obtour_final_title', 'Hazırsınız!')}</h2>
          <p className="gt-text">{tr('obtour_final_text', 'Hər şey yerindədir. Sualınız olsa, Anacan AI həmişə buradadır.')}</p>
          <button type="button" className="gt-btn full" onClick={() => finish('done')} autoFocus>{tr('obtour_final_cta', 'Başla')}</button>
        </div></div>;
    }
  } else {
    const spot = sub.kind === 'spot' && rect && !missing;
    const pad = sub.target?.startsWith('tab-') ? 4 : 6;
    const hole = spot ? { left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;
    const vh = typeof window === 'undefined' ? 800 : window.innerHeight;
    const coachStyle: React.CSSProperties = hole
      ? (hole.top + hole.height / 2 > vh / 2 ? { bottom: Math.max(vh - hole.top + 14, 16) } : { top: Math.min(hole.top + hole.height + 14, vh - 260) })
      : { bottom: 'calc(96px + env(safe-area-inset-bottom))' };
    const pushButtons = sub.kind === 'push' && <div className="gt-push"><div className="gt-two">
      <button type="button" className="gt-btn ghost" disabled={busy} onClick={next}>{tr('obtour_push_no', 'İndi yox')}</button>
      <button type="button" className="gt-btn" disabled={busy} onClick={async () => { setBusy(true); try { await onPush(); } finally { setBusy(false); next(); } }}>{tr('obtour_push_yes', 'Bəli, xatırlat')}</button></div></div>;
    body = <>
      {hole && <>
        <div className="gt-hole" style={hole} />
        {sub.target?.startsWith('tab-') && <div className="gt-tap" style={{ left: hole.left + hole.width / 2, top: hole.top + hole.height / 2 }} />}
        <div className="gt-block" style={{ left: 0, top: 0, right: 0, height: Math.max(hole.top, 0) }} />
        <div className="gt-block" style={{ left: 0, top: hole.top + hole.height, right: 0, bottom: 0 }} />
        <div className="gt-block" style={{ left: 0, top: hole.top, width: Math.max(hole.left, 0), height: hole.height }} />
        <div className="gt-block" style={{ left: hole.left + hole.width, top: hole.top, right: 0, height: hole.height }} />
      </>}
      <div className="gt-coach gt-glass" style={coachStyle} role="dialog" aria-live="polite" aria-label={copy.title}>
        {head}
        {copy.where && <div className="gt-where">📍 {copy.where}</div>}
        <p className="gt-title">{copy.title}</p>
        {copy.text && <p className="gt-text">{copy.text}</p>}
        {pushButtons}
        <div className="gt-row">{skip}
          {sub.kind !== 'push' && <button type="button" className="gt-btn" onClick={isLast ? () => finish('done') : next}>{isLast ? tr('obtour_finish', 'Bitir') : tr('obtour_next', 'Davam')}</button>}
        </div>
      </div>
    </>;
  }
  return createPortal(<div className="gt-root a-scope">{body}</div>, document.body);
}
