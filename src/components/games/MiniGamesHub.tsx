import { lazy, Suspense, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ShoppingBasket, ChevronRight, Trophy, Gamepad2, Sparkles, Puzzle, RotateCcw, FlaskConical, Flower2, Infinity as InfinityIcon, Leaf, CarFront } from 'lucide-react';
import { tr } from '@/lib/tr';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics, trackEvent } from '@/hooks/useScreenAnalytics';
import { useLocalGameProgress } from '@/hooks/useLocalGameProgress';
import { useSubmitGameScore } from '@/hooks/useGameScores';
import ErrorBoundary from '@/components/ErrorBoundary';
import SaglamSebetLevels from './saglam-sebet/SaglamSebetLevels';
import SaglamSebetGame from './saglam-sebet/SaglamSebetGame';
import { TOTAL_LEVELS as SAGLAM_SEBET_TOTAL_LEVELS } from './saglam-sebet/levelConfig';
import BirlesdirLevels from './birlesdir/BirlesdirLevels';
import BirlesdirGame from './birlesdir/BirlesdirGame';
import { TOTAL_LEVELS as BIRLESDIR_TOTAL_LEVELS } from './birlesdir/levelConfig';
import Leaderboard from './Leaderboard';
import ColorSortGame from './color-sort/ColorSortGame';
import ColorSortLevels from './color-sort/ColorSortLevels';
import { COLOR_SORT_ID, INITIAL_LEVEL_COUNT, MAX_LEVEL_COUNT } from './color-sort/difficulty';
import { useColorSortLibrary } from './color-sort/useColorSortLibrary';
import { useColorSortText } from './color-sort/useColorSortText';
import { useUserStore } from '@/store/userStore';
import { hasWordGardenLibrary, wordGardenLanguage } from './word-garden/library';
import { WORD_GARDEN_ID } from './word-garden/model';
import { gardenText } from './word-garden/messages';
import { TWO_FRIENDS_ID, TWO_FRIENDS_LEVELS } from './iki-dost/model';
import { friendsText } from './iki-dost/messages';
import { FRIENDS_ART } from './iki-dost/art';
import { casualText } from './casual/messages';
import { CASUAL_ART } from './casual/art';
import { LEAF_FLIGHT_ID, LEAF_FLIGHT_LEVELS } from './leaf-flight/model';
import { PARKING_ID, PARKING_LEVELS } from './parking/model';

const WordGarden = lazy(() => import('./word-garden/WordGarden'));
const TwoFriends = lazy(() => import('./iki-dost/TwoFriends'));
const LeafFlight = lazy(() => import('./leaf-flight/LeafFlight'));
const ClearTheWay = lazy(() => import('./parking/ClearTheWay'));

interface MiniGamesHubProps {
  onBack: () => void;
}

type View = 'hub' | 'levels' | 'game' | 'word-garden' | 'iki-dost' | 'leaf-flight' | 'clear-the-way';
type Tab = 'games' | 'leaderboard';

const SAGLAM_SEBET_ID = 'saglam-sebet';
const BIRLESDIR_ID = 'birlesdir';

const GAMES = [
  {
    id: SAGLAM_SEBET_ID,
    titleKey: 'saglamsebet_title',
    title: 'Sağlam Səbət',
    descKey: 'saglamsebet_card_desc',
    desc: 'Sağlam qidaları tut, zərərlilərdən qaç',
    icon: ShoppingBasket,
    gradient: 'from-emerald-500 to-teal-600',
    totalLevels: SAGLAM_SEBET_TOTAL_LEVELS,
  },
  {
    id: BIRLESDIR_ID,
    titleKey: 'birlesdir_title',
    title: 'Birləşdir',
    descKey: 'birlesdir_card_desc',
    desc: '3 və ya daha çoxunu birləşdir, bonusları aç',
    icon: Puzzle,
    gradient: 'from-violet-500 to-fuchsia-500',
    totalLevels: BIRLESDIR_TOTAL_LEVELS,
  },
  {
    id: COLOR_SORT_ID,
    titleKey: 'colorsort_title',
    title: 'Rəng çeşidləmə',
    descKey: 'colorsort_card_desc',
    desc: 'Rəngli vitaminləri çeşidlə, hər qabda bir rəng topla',
    icon: FlaskConical,
    gradient: 'from-cyan-500 to-teal-600',
    totalLevels: INITIAL_LEVEL_COUNT,
  },
];

const MiniGamesHub = ({ onBack }: MiniGamesHubProps) => {
  useScreenAnalytics('MiniGamesHub', 'MiniGames');
  const { t } = useColorSortText();
  const colorSortLibrary = useColorSortLibrary();
  const language = wordGardenLanguage(useUserStore(state => state.language) || 'az');
  const wordGardenAvailable = hasWordGardenLibrary(language);

  const [activeTab, setActiveTab] = useState<Tab>('games');
  const [view, setView] = useState<View>('hub');
  const [selectedGameId, setSelectedGameId] = useState<string>(SAGLAM_SEBET_ID);
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [leaderboardGameId, setLeaderboardGameId] = useState<string>(SAGLAM_SEBET_ID);

  // Hub ↔ səviyyələr ↔ oyun keçidlərində həmişə yuxarıdan başla
  useScrollToTop([view, activeTab]);

  // Hooks must be called unconditionally — one instance per game.
  const saglamSebetProgress = useLocalGameProgress(SAGLAM_SEBET_ID);
  const birlesdirProgress = useLocalGameProgress(BIRLESDIR_ID);
  const colorSortProgress = useLocalGameProgress(COLOR_SORT_ID);
  const submitSaglamSebetScore = useSubmitGameScore(SAGLAM_SEBET_ID);
  const submitBirlesdirScore = useSubmitGameScore(BIRLESDIR_ID);
  const submitColorSortScore = useSubmitGameScore(COLOR_SORT_ID);

  const isSaglamSebet = selectedGameId === SAGLAM_SEBET_ID;
  const isColorSort = selectedGameId === COLOR_SORT_ID;
  const progress = isSaglamSebet ? saglamSebetProgress : isColorSort ? colorSortProgress : birlesdirProgress;
  const submitScore = isSaglamSebet ? submitSaglamSebetScore : isColorSort ? submitColorSortScore : submitBirlesdirScore;

  // Memoized so child games' win/lose-watcher effects (which list these as
  // dependencies) don't re-fire on every parent re-render — e.g. the score
  // mutation's pending→success transition used to recreate this on every
  // render right at the moment a level ends.
  const openGame = useCallback((gameId: string) => {
    setSelectedGameId(gameId);
    setView('levels');
  }, []);

  const handleSelectLevel = useCallback(
    (level: number) => {
      setSelectedLevel(level);
      setView('game');
      trackEvent('minigame_level_started', { game_id: selectedGameId, level });
    },
    [selectedGameId]
  );

  const handleLevelComplete = useCallback(
    (result: { level: number; score: number; stars: 0 | 1 | 2 | 3; passed: boolean }) => {
      progress.recordLevelResult(result.level, result.score, result.stars, result.passed);
      submitScore.mutate({ score: result.score, level: result.level });
      trackEvent(result.passed ? 'minigame_level_won' : 'minigame_level_lost', {
        game_id: selectedGameId,
        level: result.level,
        score: result.score,
      });
    },
    // progress/submitScore are re-derived every render from the per-game stable
    // hook instances (see comment above) — their .recordLevelResult/.mutate
    // values stay referentially stable for as long as selectedGameId doesn't
    // change, which is always true for the duration of a single game session.
    [progress.recordLevelResult, submitScore.mutate, selectedGameId]
  );

  const handleExitToLevels = useCallback(() => setView('levels'), []);
  const handleNextSaglamSebetLevel = useCallback(
    () => setSelectedLevel((prev) => Math.min(prev + 1, SAGLAM_SEBET_TOTAL_LEVELS)),
    []
  );
  const handleNextBirlesdirLevel = useCallback(
    () => setSelectedLevel((prev) => Math.min(prev + 1, BIRLESDIR_TOTAL_LEVELS)),
    []
  );
  const handleNextColorSortLevel = useCallback(() => {
    if (selectedLevel >= colorSortLibrary.levelCount) colorSortLibrary.addLevels();
    setSelectedLevel(Math.min(selectedLevel + 1, MAX_LEVEL_COUNT));
  }, [selectedLevel, colorSortLibrary.levelCount, colorSortLibrary.addLevels]);

  if (view === 'word-garden' && wordGardenAvailable) return <ErrorBoundary fallback={<div className="a-scope p-6">
    <p>{tr('minigames_crash_title', 'Oyunda gözlənilməz xəta baş verdi')}</p>
    <button type="button" className="a-btn mt-4" onClick={() => setView('hub')}>{tr('minigames_crash_back_button', 'Səviyyələrə qayıt')}</button>
  </div>}><Suspense fallback={<div className="a-scope p-6" role="status">{gardenText(language, 'loading')}</div>}>
    <WordGarden onBack={() => setView('hub')} />
  </Suspense></ErrorBoundary>;

  if (view === 'iki-dost') return <ErrorBoundary fallback={<div className="a-scope p-6">
    <button type="button" className="a-btn" onClick={() => setView('hub')}>{friendsText(language, 'back')}</button>
  </div>}><Suspense fallback={<div className="a-scope p-6" role="status">{friendsText(language, 'hintBusy')}</div>}>
    <TwoFriends onBack={() => setView('hub')} />
  </Suspense></ErrorBoundary>;

  if (view === 'leaf-flight' || view === 'clear-the-way') return <ErrorBoundary fallback={<div className="a-scope p-6">
    <button type="button" className="a-btn" onClick={() => setView('hub')}>{casualText(language, 'back')}</button>
  </div>}><Suspense fallback={<div className="a-scope p-6" role="status">{casualText(language, 'hintBusy')}</div>}>
    {view === 'leaf-flight' ? <LeafFlight onBack={() => setView('hub')} /> : <ClearTheWay onBack={() => setView('hub')} />}
  </Suspense></ErrorBoundary>;

  if (view === 'game') {
    // Local failure domain: if the (animation/timer-heavy, portal-rendered)
    // game screen ever throws, contain it to this screen instead of taking
    // down the entire app via the root ErrorBoundary in App.tsx.
    const gameCrashFallback = (
      <div className="a-scope min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center" style={{ background: 'var(--a-bg)' }}>
        <p className="text-lg font-semibold text-foreground">
          {tr('minigames_crash_title', 'Oyunda gözlənilməz xəta baş verdi')}
        </p>
        <p className="text-sm text-muted-foreground max-w-[280px]">
          {tr('minigames_crash_desc', 'Narahat olmayın, irəliləyişiniz saxlanılıb. Səviyyələrə qayıdıb yenidən cəhd edə bilərsiniz.')}
        </p>
        <button
          onClick={handleExitToLevels}
          className="mt-2 px-5 py-2.5 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" /> {tr('minigames_crash_back_button', 'Səviyyələrə qayıt')}
        </button>
      </div>
    );

    if (isColorSort) {
      return <ErrorBoundary fallback={gameCrashFallback}>
        <ColorSortGame key={selectedLevel} level={selectedLevel} levelCount={colorSortLibrary.levelCount}
          onExit={handleExitToLevels} onLevelComplete={handleLevelComplete} onNextLevel={handleNextColorSortLevel} />
      </ErrorBoundary>;
    }
    if (isSaglamSebet) {
      return (
        <ErrorBoundary fallback={gameCrashFallback}>
          <SaglamSebetGame
            key={selectedLevel}
            level={selectedLevel}
            onExit={handleExitToLevels}
            onLevelComplete={handleLevelComplete}
            onNextLevel={handleNextSaglamSebetLevel}
          />
        </ErrorBoundary>
      );
    }
    return (
      <ErrorBoundary fallback={gameCrashFallback}>
        <BirlesdirGame
          key={selectedLevel}
          level={selectedLevel}
          onExit={handleExitToLevels}
          onLevelComplete={handleLevelComplete}
          onNextLevel={handleNextBirlesdirLevel}
        />
      </ErrorBoundary>
    );
  }

  if (view === 'levels') {
    if (isColorSort) {
      return <ColorSortLevels progress={progress.progress} isLevelUnlocked={progress.isLevelUnlocked}
        onSelectLevel={handleSelectLevel} onBack={() => setView('hub')}
        levelCount={colorSortLibrary.levelCount} onAddLevels={colorSortLibrary.addLevels} />;
    }
    if (isSaglamSebet) {
      return (
        <SaglamSebetLevels
          progress={progress.progress}
          isLevelUnlocked={progress.isLevelUnlocked}
          onSelectLevel={handleSelectLevel}
          onBack={() => setView('hub')}
        />
      );
    }
    return (
      <BirlesdirLevels
        progress={progress.progress}
        isLevelUnlocked={progress.isLevelUnlocked}
        onSelectLevel={handleSelectLevel}
        onBack={() => setView('hub')}
      />
    );
  }

  return (
    <div className="a-scope min-h-screen pb-24" style={{ background: 'var(--a-bg)' }}>
      <div className="a-shell">
        {/* Header */}
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <motion.button onClick={onBack} className="a3-icon-btn" whileTap={{ scale: 0.9 }} aria-label={t('back')}>
              <ArrowLeft className="rtl:rotate-180" size={20} strokeWidth={2} />
            </motion.button>
            <div style={{ minWidth: 0 }}>
              <p className="a-eyebrow">{tr('minigames_hub_subtitle', 'Stresi at, oyna, rahatla')}</p>
              <p className="a3-tool-title">{tr('minigames_hub_title', 'Mini Oyunlar')}</p>
            </div>
          </div>
          <div className="a-topbar-actions">
            <span className="a-icon-btn" style={{ cursor: 'default' }}>
              <Gamepad2 size={16} strokeWidth={2} />
            </span>
          </div>
        </header>

        {/* Tabs */}
        <div className="a-tabs w-full mb-4" style={{ display: 'flex' }}>
          <button
            onClick={() => setActiveTab('games')}
            className={`a-tab flex-1 ${activeTab === 'games' ? 'active' : ''}`}
          >
            {tr('minigames_tab_games', 'Oyunlar')}
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`a-tab flex-1 ${activeTab === 'leaderboard' ? 'active' : ''}`}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Trophy className="w-3.5 h-3.5" /> {tr('minigames_tab_leaderboard', 'Reytinq')}
          </button>
        </div>
        <AnimatePresence mode="wait">
          {activeTab === 'games' ? (
            <motion.div key="games" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {(['leaf-flight', 'clear-the-way'] as const).map(game => {
                const flight = game === 'leaf-flight', Icon = flight ? Leaf : CarFront;
                return <motion.button type="button" key={game} data-game-id={flight ? LEAF_FLIGHT_ID : PARKING_ID} whileTap={{ scale: 0.98 }}
                  onClick={() => setView(game)} className="w-full relative overflow-hidden rounded-3xl p-4 text-start mb-4"
                  style={{ background: flight ? 'linear-gradient(125deg,#eee5f8,#f8edda)' : 'linear-gradient(125deg,#e3eee1,#f8ecd5)', border: '1px solid #e6dece', color: flight ? '#78618b' : '#537b69', boxShadow: '0 10px 25px -15px #81966e44' }}>
                  <div className="relative flex items-center gap-3"><span className="relative flex-shrink-0"><img src={flight ? CASUAL_ART.flight : CASUAL_ART.parking} width="65" height="74" alt="" style={{ width: 65, height: 74, objectFit: 'contain' }} />
                    <Icon size={19} className="absolute -end-1 bottom-0" /></span><div className="flex-1 min-w-0"><h3 className="font-extrabold text-lg">{casualText(language, flight ? 'flightTitle' : 'parkingTitle')}</h3><p className="text-xs mt-1 leading-relaxed opacity-75">{casualText(language, flight ? 'flightCard' : 'parkingCard')}</p></div><ChevronRight size={18} className="rtl:rotate-180" /></div>
                  <div className="relative flex items-center justify-between gap-3 mt-3 text-[10px] font-semibold"><span>{casualText(language, flight ? 'wind' : 'par', { count: flight ? 30 : 15 })}</span><span className="px-2 py-1 rounded-full" style={{ background: '#ffffff96' }}>{flight ? LEAF_FLIGHT_LEVELS : PARKING_LEVELS}</span></div>
                </motion.button>;
              })}
              <motion.button type="button" data-game-id={TWO_FRIENDS_ID} whileTap={{ scale: 0.98 }}
                onClick={() => setView('iki-dost')} className="w-full relative overflow-hidden rounded-3xl p-4 text-start mb-4"
                style={{ background: 'linear-gradient(125deg,#fff0de,#f0e7fa)', border: '1px solid #ecdaca', color: '#5e5463', boxShadow: '0 10px 25px -15px #927c9c44' }}>
                <div className="relative flex items-center gap-3">
                  <div className="flex flex-shrink-0 items-center -space-x-4" dir="ltr">
                    {FRIENDS_ART.map((image, index) => <img key={index} src={image} width="58" height="68" alt="" style={{ width: 58, height: 68, objectFit: 'contain' }} />)}
                  </div>
                  <div className="flex-1 min-w-0"><h3 className="font-extrabold text-lg">{friendsText(language, 'title')}</h3>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: '#827587' }}>{friendsText(language, 'card')}</p></div>
                  <ChevronRight size={18} className="rtl:rotate-180" />
                </div>
                <div className="relative flex items-center justify-between gap-3 mt-3 text-[10px] font-semibold"><span>{friendsText(language, 'tagline')}</span>
                  <span className="px-2 py-1 rounded-full" style={{ background: '#ffffff96' }}>{TWO_FRIENDS_LEVELS}</span></div>
              </motion.button>
              {wordGardenAvailable && <motion.button type="button" data-game-id={WORD_GARDEN_ID} whileTap={{ scale: 0.98 }}
                onClick={() => setView('word-garden')} className="w-full relative overflow-hidden rounded-3xl p-5 text-start mb-4"
                style={{ background: 'linear-gradient(130deg,#fcf0de,#e3edda)', border: '1px solid #e2d9c6', boxShadow: '0 10px 25px -15px #70826444', color: '#445b49' }}>
                <div className="absolute -end-3 -bottom-4 opacity-15"><Flower2 size={130} /></div>
                <div className="relative flex items-center gap-3">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: '#ffffffb8', color: '#db8471' }}><Flower2 size={31} /></span>
                  <div className="flex-1 min-w-0"><span className="text-[9px] font-bold tracking-wider" style={{ color: '#7e907a' }}>{gardenText(language, 'newGame')}</span>
                    <h3 className="font-extrabold text-lg">{gardenText(language, 'title')}</h3>
                    <p className="text-xs" style={{ color: '#7a8874' }}>{gardenText(language, 'cardDescription')}</p></div>
                  <ChevronRight className="rtl:rotate-180" size={19} />
                </div>
                <div className="relative flex items-center gap-3 mt-3 text-[10px] font-semibold"><span className="flex items-center gap-1"><InfinityIcon size={12} />{gardenText(language, 'infinite')}</span>
                  <span className="px-2 py-1 rounded-full" style={{ background: '#ffffff7a' }}>{gardenText(language, 'language')}</span></div>
              </motion.button>}
              {GAMES.map((game) => {
                const gameProgress = game.id === SAGLAM_SEBET_ID ? saglamSebetProgress.progress : game.id === COLOR_SORT_ID ? colorSortProgress.progress : birlesdirProgress.progress;
                const totalLevels = game.id === COLOR_SORT_ID ? colorSortLibrary.levelCount : game.totalLevels;
                const Icon = game.icon;
                return (
                  <motion.button
                    key={game.id}
                    data-game-id={game.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => openGame(game.id)}
                    className={`w-full relative overflow-hidden rounded-3xl bg-gradient-to-br ${game.gradient} p-4 text-start shadow-xl mb-4`}
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.18),transparent_60%)]" />
                    <div className="absolute -end-3 -bottom-3 opacity-15">
                      <Icon className="w-28 h-28 text-white" />
                    </div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                          <Icon className="w-7 h-7 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] text-white font-semibold flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5" /> {tr('minigames_badge_new', 'Yeni')}
                            </span>
                          </div>
                          <h3 className="text-white font-bold text-base">{game.id === COLOR_SORT_ID ? t('title') : tr(game.titleKey, game.title)}</h3>
                          <p className="text-white/80 text-xs">{game.id === COLOR_SORT_ID ? t('card_desc') : tr(game.descKey, game.desc)}</p>
                        </div>
                        <ChevronRight className="rtl:rotate-180 w-5 h-5 text-white/70 flex-shrink-0" />
                      </div>

                      <div className="flex items-center gap-3 text-white/90 text-[11px]">
                        <span className="px-2 py-1 rounded-full bg-white/15 font-medium">
                          {totalLevels} {tr('minigames_levels_short', 'səviyyə')}
                        </span>
                        <span className="px-2 py-1 rounded-full bg-white/15 font-medium">
                          {Math.min(gameProgress.unlockedLevel, totalLevels)}/{totalLevels}{' '}
                          {tr('minigames_unlocked_short', 'açıq')}
                        </span>
                        {gameProgress.bestScoreOverall > 0 && (
                          <span className="px-2 py-1 rounded-full bg-white/15 font-medium flex items-center gap-1">
                            <Trophy className="w-3 h-3" /> {gameProgress.bestScoreOverall}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.button>
                );
              })}

              {/* More games coming soon */}
              <div className="rounded-[26px] p-5 text-center" style={{ background: 'var(--a-surface)', border: '2px dashed var(--a-line-strong)' }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-2" style={{ background: 'var(--a-surface-soft)' }}>
                  <Gamepad2 className="w-6 h-6" style={{ color: 'var(--a-ink-faint)' }} />
                </div>
                <p className="a-list-title mb-0.5" style={{ margin: '0 0 2px' }}>
                  {tr('minigames_more_soon_title', 'Yeni oyunlar tezliklə')}
                </p>
                <p className="a-list-sub" style={{ margin: 0, whiteSpace: 'normal' }}>
                  {tr('minigames_more_soon_desc', 'Mini Oyunlar bölməsinə tezliklə yeni oyunlar əlavə olunacaq')}
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div key="leaderboard" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="flex items-stretch gap-2 mb-3">
                {GAMES.map((game) => (
                  <button
                    key={game.id}
                    onClick={() => setLeaderboardGameId(game.id)}
                    className={`flex-1 min-w-0 px-2 py-2 rounded-2xl text-xs font-bold transition-all break-words ${
                      leaderboardGameId === game.id
                        ? `bg-gradient-to-r ${game.gradient} text-white shadow-button`
                        : ''
                    }`}
                    style={leaderboardGameId === game.id ?
                    { border: 'none', cursor: 'pointer' } :
                    { background: 'var(--a-surface)', color: 'var(--a-ink-soft)', border: '1px solid var(--a-line)', cursor: 'pointer' }}
                  >
                    {game.id === COLOR_SORT_ID ? t('title') : tr(game.titleKey, game.title)}
                  </button>
                ))}
              </div>
              <Leaderboard gameId={leaderboardGameId} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MiniGamesHub;
