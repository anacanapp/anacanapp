import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { App as NativeApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { ACTIVITIES, CHAPTERS, FURNITURE, copy } from './game/content';
import { activeStory, activityById, availableActivities, isBaby, reducer } from './game/engine';
import { t, text } from './game/i18n';
import { worldObjects, canPlace, type Point } from './game/navigation';
import { activityLocation, birthReady, currentStep, missionProgress, targetForActivity } from './game/progression';
import { loadCatalogue, refreshCatalogue } from './game/catalogue';
import { resetSave, saveGame } from './game/persistence';
import { audio } from './game/audio';
import { haptic } from './game/native';
import type { Activity, Catalogue, GameState, Panel, PublicRow, Room } from './game/types';
import { ActivitySheet } from './components/ActivitySheet';
import { GamePanel } from './components/GamePanels';
import { Icon } from './components/Icon';
import { MiniGame } from './components/MiniGame';
import { Onboarding } from './components/Onboarding';
import { Sheet } from './components/Sheet';
import { WorldView, type WorldHandle } from './components/WorldView';
import { LuzernHUD } from './components/LuzernHUD';
import { captureCinematic, LuzernScene, type SceneMode } from './components/LuzernScene';
import { LIFE_ROOMS, LIFE_LOCATIONS, householdActivityIssue } from './game/luzern';
import { roomForActivity } from './game/interior';
import { InteriorView, type InteriorHandle } from './components/InteriorView';
import { BirthExperience } from './components/BirthExperience';

const PANEL_ICONS: Record<Panel, string> = { tasks: 'clipboard', journey: 'bookheart', decorate: 'home', family: 'users', album: 'camera', library: 'book', settings: 'settings', help: 'help', map: 'map', day: 'sun' };

export default function App({ initialState }: { initialState: GameState }) {
  const [state, dispatch] = useReducer(reducer, initialState), [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null), [activity, setActivity] = useState<Activity | null>(null), [mini, setMini] = useState<Activity | null>(null);
  const [source, setSource] = useState<PublicRow>(), [moving, setMoving] = useState<Activity | null>(null), [placement, setPlacement] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0), [photoMode, setPhotoMode] = useState(false), [toast, setToast] = useState(''), [refreshing, setRefreshing] = useState(false);
  const [chapterIntro, setChapterIntro] = useState<number | null>(null), [storyOpen, setStoryOpen] = useState(false);
  const [birthOpen, setBirthOpen] = useState(false), [travelling, setTravelling] = useState(false);
  const [room, setRoom] = useState<Room>(initialState.location === 'home' ? initialState.pregnancy.born ? 'nursery' : 'living' : initialState.location), [sceneMode, setSceneMode] = useState<SceneMode>('cinematic');
  const world = useRef<WorldHandle>(null), current = useRef(state); current.current = state;
  const interior = useRef<InteriorHandle>(null);
  const previousChapter = useRef(initialState.chapter), previousActions = useRef(initialState.totalActions), toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const travelTimer = useRef<ReturnType<typeof setTimeout>>();
  const blockTick = useRef(false); blockTick.current = Boolean(panel || activity || mini || chapterIntro !== null || storyOpen || photoMode || placement || moving || birthOpen || travelling);
  const language = state.language, chapter = CHAPTERS[state.chapter], story = activeStory(state);

  const notify = useCallback((message: string) => { clearTimeout(toastTimer.current); setToast(message); toastTimer.current = setTimeout(() => setToast(''), 3800); }, []);
  const close = useCallback(() => { setPanel(null); setActivity(null); setMini(null); setStoryOpen(false); setChapterIntro(null); }, []);
  const press = useCallback(() => { audio.unlock(); audio.tap(); if (current.current.settings.haptics) haptic(); }, []);

  useEffect(() => { void loadCatalogue().then(setCatalogue).catch(() => notify(t('refreshFailed', current.current.language))); }, [notify]);
  useEffect(() => { audio.enable(state.settings.sound); document.documentElement.lang = state.language; document.documentElement.classList.toggle('reduce-motion', state.settings.reducedMotion); }, [state.language, state.settings.sound, state.settings.reducedMotion]);
  useEffect(() => {
    let last = performance.now(); const timer = setInterval(() => {
      const now = performance.now(), dt = (now - last) / 1000; last = now;
      if (!document.hidden && !blockTick.current && current.current.started) dispatch({ type: 'TICK', dt });
    }, 250); return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => { if (current.current.started) void saveGame(current.current).catch(() => notify(t('storageFailed', current.current.language))); }, 6000);
    const hide = () => { if (document.hidden) void saveGame(current.current).catch(() => {}); };
    document.addEventListener('visibilitychange', hide);
    let listener: { remove(): Promise<void> } | undefined;
    if (Capacitor.isNativePlatform()) void NativeApp.addListener('appStateChange', ({ isActive }) => { if (!isActive) void saveGame(current.current).catch(() => {}); }).then(l => { listener = l; });
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', hide); void listener?.remove(); };
  }, [notify]);
  useEffect(() => {
    if (state.chapter !== previousChapter.current) { previousChapter.current = state.chapter; setChapterIntro(state.chapter); audio.success(); }
    if (state.totalActions > previousActions.current) {
      previousActions.current = state.totalActions; audio.success(); if (state.settings.haptics) haptic(true);
      notify(text(copy('Balaca bir an daha sevgi ilə tamamlandı', 'Another little moment, completed with love', 'Bir küçük an daha sevgiyle tamamlandı'), state.language));
      void saveGame(state).catch(() => {});
    }
  }, [state, notify]);
  useEffect(() => { if (state.dailyRewardClaimed) { audio.success(); void saveGame(state).catch(() => {}); } }, [state.dailyRewardClaimed]);
  useEffect(() => { if (current.current.started) void saveGame(current.current).catch(() => {}); },
    [state.avatar, state.inventory, state.placements, state.missions, state.pregnancy, state.language, state.theme, state.favourites, state.household.purchases, state.household.dailyRewardDay]);
  useEffect(() => {
    if (state.location !== 'home') setRoom(state.location);
    else setRoom(previous => LIFE_ROOMS.some(r => r.id === previous) ? previous : state.pregnancy.born ? 'nursery' : 'living');
    if (!['home', 'clinic'].includes(state.location)) setSceneMode(previous => previous === 'overview' ? 'cinematic' : previous);
  }, [state.location, state.pregnancy.born]);
  useEffect(() => () => { clearTimeout(toastTimer.current); clearTimeout(travelTimer.current); }, []);

  const openPanel = (next: Panel) => { if (moving || travelling) return; press(); setPanel(next); };
  const openActivity = (id: Activity['id']) => {
    if (state.activity || moving || placement) return;
    const selected = activityById(id);
    if (id === 'travel' || activityLocation(selected, state) !== state.location) { setPanel('map'); return; }
    if (id === 'birth') { if (birthReady(state)) { setPanel(null); setBirthOpen(true); } else notify(t('chapterMissionLocked', language)); return; }
    if (!availableActivities(state).some(a => a.id === id)) { setPanel('tasks'); return; }
    press(); setPanel(null); setSource(undefined); setActivity(selected); world.current?.select(targetForActivity(selected, state));
  };
  const suppliesReady = (a: Activity) => {
    const issue = householdActivityIssue(current.current, a.id);
    if (!issue) return true;
    notify(t(issue, current.current.language)); setActivity(null); setMini(null); setPanel(issue === 'stockLow' ? 'map' : 'day'); return false;
  };
  const beginActivity = (a: Activity, quality = 0, sourceId?: string) => {
    if (!suppliesReady(a)) return;
    setActivity(null); setMini(null); setPanel(null); setMoving(a);
    if (current.current.settings.speed === 0) dispatch({ type: 'SETTINGS', settings: { speed: 1 } });
    const target = targetForActivity(a, state); setRoom(roomForActivity(a, state, room));
    const arrived = () => { setMoving(null); dispatch({ type: 'BEGIN', id: a.id, quality, sourceId }); };
    if (sceneMode !== 'overview' || state.location !== 'home' && state.location !== 'clinic') travelTimer.current = setTimeout(arrived, 600);
    else { world.current?.focusActivity(target); world.current?.walkTo(target, arrived); }
  };
  const playMini = (a: Activity) => {
    if (!suppliesReady(a)) return;
    setActivity(null); setPanel(null); setMoving(a);
    if (state.settings.speed === 0) dispatch({ type: 'SETTINGS', settings: { speed: 1 } });
    const target = targetForActivity(a, state); setRoom(roomForActivity(a, state, room));
    const arrived = () => { setMoving(null); setMini(a); };
    if (sceneMode !== 'overview' || !['home', 'clinic'].includes(state.location)) travelTimer.current = setTimeout(arrived, 700);
    else if (world.current) { world.current.focusActivity(target); world.current.walkTo(target, arrived); } else arrived();
  };
  const onObject = (id: string) => {
    if (placement) return;
    if (id.startsWith('decor:')) { dispatch({ type: 'REMOVE', id: id.slice(6) }); notify(t('collection', language)); return; }
    const target = worldObjects(state.location).find(o => o.id === id); if (!target) return;
    let a = ACTIVITIES.find(a => a.id === target.label);
    if (id === 'crib' && !isBaby(state)) a = activityById(state.chapter >= 6 ? 'assemble' : 'read');
    if (id === 'dresser' && isBaby(state)) a = activityById('diaper');
    if (id === 'chair' && !isBaby(state)) a = activityById('read');
    if (id === 'playmat' && !isBaby(state)) a = activityById('tidy');
    if (id === 'bath' && !isBaby(state) && state.chapter === 0) a = activityById('test');
    if (id === 'birthbed' && state.pregnancy.born) a = activityById('skin');
    if (id === 'reception' && !state.pregnancy.born) { setPanel('map'); return; }
    if (a) openActivity(a.id);
  };
  const onFloor = (p: Point) => {
    if (!placement) return;
    const x = Math.round(p.x * 4) / 4, z = Math.round(p.z * 4) / 4;
    if (!canPlace(x, z, placement, state.placements)) { notify(t('invalidPlace', language)); return; }
    dispatch({ type: 'PLACE', placement: { id: `decor-${Date.now()}`, itemId: placement, x, z, rotation } });
    setPlacement(null); audio.success(); notify(t('bought', language));
  };
  const refresh = () => { setRefreshing(true); void refreshCatalogue().then(data => { setCatalogue(data); notify(t('refreshed', language)); }).catch(() => notify(t('refreshFailed', language))).finally(() => setRefreshing(false)); };
  const capture = async () => {
    let photo: string | undefined;
    try {
      const image = state.location === 'home' ? room === 'nursery' && state.pregnancy.born ? 'feeding' : room === 'living' ? state.pregnancy.born ? 'family' : state.chapter >= 2 ? 'pregnancy' : 'living' : LIFE_ROOMS.find(r => r.id === room)?.image ?? 'living' : LIFE_LOCATIONS.find(l => l.id === state.location)?.image ?? 'clinic';
      photo = sceneMode === 'cinematic' ? await captureCinematic(image, state.avatar.name) : sceneMode === 'room' ? interior.current?.capture() : world.current?.capture();
    } catch { notify(t('storageFailed', language)); return; }
    if (!photo) return;
    dispatch({ type: 'MEMORY', memory: { id: `photo-${Date.now()}`, kind: 'photo', chapter: state.chapter, day: state.day, title: copy('Yuvamdan bir an', 'A moment from my home', 'Yuvamdan bir an'), description: chapter.subtitle, icon: 'camera', photo } });
    audio.success(); notify(t('photoSaved', language));
  };
  const travel = (location?: GameState['location']) => {
    if (!location) { setPanel('map'); return; }
    if (state.location === location || moving || state.activity) return;
    setPanel(null); setTravelling(true); world.current?.cancelWalk();
    clearTimeout(travelTimer.current);
    travelTimer.current = setTimeout(() => { dispatch({ type: 'TRAVEL', location }); setRoom(location === 'home' ? 'living' : location); setSceneMode('cinematic'); setTravelling(false); audio.sparkle(); }, 1100);
  };
  const nextMission = () => { const next = currentStep(state); if (!next) { setPanel('tasks'); return; } if (next.action === 'travel' || next.location !== state.location) setPanel('map'); else openActivity(next.action); };

  if (!state.started) return <Onboarding language={language} onLanguage={language => dispatch({ type: 'LANGUAGE', language })} onStart={(avatar, chapter) => { press(); dispatch({ type: 'START', avatar, chapter, language }); setChapterIntro(chapter); }} />;

  return <main className={`game-shell simulator-v2 luzern-life ${photoMode ? 'photo-mode' : ''} ${placement ? 'placement-mode' : ''} scene-${sceneMode}`} data-testid="game" data-day={state.day} data-chapter={state.chapter} data-actions={state.totalActions} data-location={state.location}>
    <div className="game-background"><span /><span /><span /></div>
    <div className="luzern-realtime-world" style={{ visibility: sceneMode === 'overview' ? 'visible' : 'hidden' }}><WorldView ref={world} state={state} onObject={onObject} onFloor={onFloor} photoMode={photoMode} placing={placement} visible={sceneMode === 'overview'} paused={sceneMode !== 'overview' || Boolean(panel || activity || mini || storyOpen || chapterIntro !== null || birthOpen || travelling) || state.settings.speed === 0 && !moving} /></div>
    <div className="luzern-interior-layer" style={{ visibility: sceneMode === 'room' ? 'visible' : 'hidden' }}><InteriorView ref={interior} state={state} room={room} onActivity={openActivity} visible={sceneMode === 'room'} photoMode={photoMode} paused={Boolean(panel || mini || activity || storyOpen || chapterIntro !== null || birthOpen || travelling) || state.settings.speed === 0} /></div>
    <LuzernScene state={state} room={room} mode={sceneMode} moving={moving} onActivity={openActivity} onMode={mode => { setSceneMode(mode); if (mode === 'overview') world.current?.focusRoom('home'); else if (mode === 'room') world.current?.focusRoom(room); }} onRoom={room => { setRoom(room); if (sceneMode === 'room') world.current?.focusRoom(room); }} photoMode={photoMode} paused={Boolean(panel || mini || birthOpen)} />
    {!photoMode && <LuzernHUD state={state} moving={moving} onPanel={openPanel} onMission={nextMission} onPhoto={() => setPhotoMode(true)} onSpeed={() => dispatch({ type: 'SETTINGS', settings: { speed: state.settings.speed === 2 ? 1 : 2 } })} onPause={() => dispatch({ type: 'SETTINGS', settings: { speed: state.settings.speed === 0 ? 1 : 0 } })} onCancel={() => { clearTimeout(travelTimer.current); world.current?.cancelWalk(); setMoving(null); dispatch({ type: 'CANCEL_ACTIVITY' }); }} />}
    {photoMode && <><header className="photo-header"><span><Icon name="camera" size={18} />{t('camera', language)}</span><button className="icon-button" onClick={() => setPhotoMode(false)} aria-label={t('close', language)}><Icon name="close" /></button></header><div className="photo-frame"><i /><i /><i /><i /></div><div className="photo-bottom"><p>{text(chapter.subtitle, language)}</p><button className="capture-button" onClick={capture} aria-label={t('capture', language)} data-testid="capture-photo"><span /></button><small>{t('capture', language)}</small></div></>}
    {placement && <div className="placement-toolbar"><div><Icon name="plus" size={20} /><span><strong>{text(FURNITURE.find(i => i.id === placement)!.title, language)}</strong><small>{t('placeHint', language)}</small></span></div><button className="icon-button" onClick={() => setRotation((rotation + Math.PI / 2) % (Math.PI * 2))} aria-label={t('rotate', language)}><Icon name="rotate" /></button><button className="icon-button" onClick={() => setPlacement(null)} aria-label={t('cancel', language)}><Icon name="close" /></button></div>}
    {panel && catalogue && <Sheet title={t(panel === 'tasks' ? 'missions' : panel, language)} subtitle={panel === 'tasks' ? `${t('chapter', language)} ${state.chapter + 1} · ${missionProgress(state).completed}/${missionProgress(state).total}` : panel === 'library' ? 'Google · Anacan' : undefined} icon={PANEL_ICONS[panel]} onClose={close} language={language} wide={['decorate', 'library', 'family', 'tasks', 'journey'].includes(panel)}>
      <GamePanel panel={panel} state={state} catalogue={catalogue} dispatch={dispatch} onActivity={openActivity} onClose={close} onPlace={id => { if (state.location !== 'home') { setPanel('map'); return; } setPanel(null); setPlacement(id); setSceneMode('overview'); setRotation(0); world.current?.focusRoom('home'); }} onRefresh={refresh} refreshing={refreshing}
        onCook={row => { if (state.location !== 'home') { setPanel('map'); return; } setSource(row); playMini(activityById('cook')); }} onReset={() => { void resetSave().then(() => { close(); dispatch({ type: 'RESET' }); }); }} onToast={notify} onTravel={travel} onHelp={() => setPanel('help')} />
    </Sheet>}
    {panel && !catalogue && <Sheet title={t(panel, language)} icon={PANEL_ICONS[panel]} onClose={close} language={language}><div className="empty-state"><Icon name="loading" className="spin" size={28} /><p>{t('offline', language)}</p><button className="button secondary" onClick={() => void loadCatalogue().then(setCatalogue)}>{t('refresh', language)}</button></div></Sheet>}
    {activity && <ActivitySheet activity={activity} state={state} onSimple={() => beginActivity(activity)} onMini={() => playMini(activity)} onSelect={setActivity} onRestock={() => { setActivity(null); setPanel('map'); }} onClose={close} />}
    {mini && catalogue && <MiniGame activity={mini} catalogue={catalogue} language={language} state={state} dispatch={dispatch} source={source} onComplete={(quality, sourceId) => beginActivity(mini, quality, sourceId)} onClose={close} />}
    {chapterIntro !== null && <Sheet title={`${t('chapter', language)} ${chapterIntro + 1}`} icon={CHAPTERS[chapterIntro].icon} language={language} onClose={close} className="chapter-intro-sheet"><div className="chapter-intro"><img src={`/assets/anacan-${CHAPTERS[chapterIntro].baby ? 'mom' : 'bump'}.webp`} alt="" /><span className="eyebrow">{text(CHAPTERS[chapterIntro].period, language)}</span><h2>{text(CHAPTERS[chapterIntro].title, language)}</h2><p>{text(CHAPTERS[chapterIntro].intro, language)}</p><div className="intro-goals">{CHAPTERS[chapterIntro].goals.map(id => <span key={id}><Icon name={activityById(id).icon} size={17} />{text(activityById(id).title, language)}</span>)}</div><button className="button primary large" onClick={close} data-testid="chapter-ready">{t('ready', language)}<Icon name="heart" size={18} /></button></div></Sheet>}
    {storyOpen && story && <Sheet title={text(story.title, language)} icon={story.icon} onClose={close} language={language} className="story-sheet"><div className="story-content"><span className="story-art"><Icon name={story.icon} size={56} /><i /><i /></span><p>{text(story.body, language)}</p><div>{story.choices.map((choice, index) => <button className={`button ${index === 0 ? 'primary' : 'secondary'} large`} key={index} onClick={() => { dispatch({ type: 'STORY', id: story.id, choice: index }); setStoryOpen(false); audio.success(); }}>{text(choice, language)}<Icon name={index === 0 ? 'sparkles' : 'heart'} size={18} /></button>)}</div></div></Sheet>}
    {toast && <div className="toast" role="status"><Icon name="sparkles" size={19} /><span>{toast}</span></div>}
    {birthOpen && <BirthExperience state={state} dispatch={dispatch} onClose={() => { setBirthOpen(false); if (current.current.pregnancy.born) setPanel('tasks'); }} />}
    {travelling && <div className="travel-transition"><span><Icon name="car" size={38} /></span><h2>{t('travel', language)}</h2><p>{text(copy('Hekayənin yeni səhnəsinə…', 'To the next scene in your story…', 'Hikâyenin yeni sahnesine…'), language)}</p><i /></div>}
  </main>;
}
