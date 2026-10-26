import { useEffect, useRef, useState } from 'react';
import { copy as c } from '../game/copy';
import { simulationWeek } from '../game/progression';
import { rowArray, rowText, pregnancyForWeek } from '../game/catalogue';
import { text, t } from '../game/i18n';
import { audio } from '../game/audio';
import type { Activity, Catalogue, GameAction, GameState, Language, PublicRow } from '../game/types';
import { Icon } from './Icon';
import { DragPuzzle, type PuzzlePiece } from './DragPuzzle';
import { HouseholdGame } from './HouseholdGames';

export function SimulationGame({ activity, state, catalogue, source, dispatch, onFinish }: {
  activity: Activity; state: GameState; catalogue: Catalogue; source?: PublicRow; dispatch(action: GameAction): void; onFinish(score: number, sourceId?: string): void;
}) {
  const lang = state.language;
  switch (activity.mini) {
    case 'laundry': case 'cleaning': case 'groceries': case 'coffeeRitual': case 'lakeDiscovery': return <HouseholdGame activity={activity} state={state} dispatch={dispatch} onFinish={onFinish} />;
    case 'pregnancyTest': return <PregnancyTest language={lang} onFinish={onFinish} />;
    case 'appointment': return <AppointmentGame state={state} dispatch={dispatch} onFinish={onFinish} />;
    case 'scan': return <UltrasoundGame state={state} catalogue={catalogue} dispatch={dispatch} onFinish={onFinish} />;
    case 'breathing': return <BreathingGame language={lang} activity={activity.id} onFinish={onFinish} />;
    case 'nesting': return <DragPuzzle variant="crib" language={lang} title={c('İlk beşiyini özün qur', 'Build the first crib yourself', 'İlk beşiğini kendin kur')} description={c('Taxta hissələri döndər və doğru yuvaya yerləşdir.', 'Rotate the wooden parts and fit them in the right slots.', 'Ahşap parçaları döndür ve doğru yuvalara yerleştir.')} onFinish={onFinish} pieces={[
      { id: 'head', title: text(c('Baş panel', 'Headboard', 'Baş panel'), lang), icon: 'bed', x: 8, y: 10, w: 20, h: 75, colour: '#d2b894', rotation: 1 },
      { id: 'base', title: text(c('Döşək bazası', 'Mattress base', 'Yatak tabanı'), lang), icon: 'home', x: 32, y: 46, w: 42, h: 39, colour: '#d9c7ac' },
      { id: 'foot', title: text(c('Son panel', 'Footboard', 'Ayak paneli'), lang), icon: 'bed', x: 78, y: 10, w: 16, h: 75, colour: '#d2b894', rotation: 1 },
      { id: 'rail', title: text(c('Yan məhəccər', 'Side rail', 'Yan korkuluk'), lang), icon: 'blocks', x: 32, y: 10, w: 42, h: 31, colour: '#c7ab84' },
    ]} />;
    case 'packing': return <HospitalPacking catalogue={catalogue} language={lang} onFinish={onFinish} />;
    case 'birthPlan': return <BirthPlanGame state={state} dispatch={dispatch} onFinish={onFinish} />;
    case 'contractions': return <ContractionsGame language={lang} onFinish={onFinish} />;
    case 'babyCare': return <BabyCareGame activity={activity} state={state} dispatch={dispatch} onFinish={onFinish} />;
    case 'carseat': return <DragPuzzle variant="seat" language={lang} title={c('İlk ailə yolculuğu', 'The first family ride', 'İlk aile yolculuğu')} description={c('Oyun oturacağının hissələrini uyğunlaşdır.', 'Match the pieces of the game’s car seat.', 'Oyun koltuğunun parçalarını eşleştir.')} onFinish={onFinish} pieces={[
      { id: 'seat', title: text(c('Yumşaq oturacaq', 'Soft seat', 'Yumuşak koltuk'), lang), icon: 'car', x: 30, y: 20, w: 40, h: 62, colour: '#a1b6b1' },
      { id: 'left-strap', title: text(c('Sol kəmər', 'Left strap', 'Sol kemer'), lang), icon: 'check', x: 6, y: 15, w: 20, h: 46, colour: '#879b94' },
      { id: 'right-strap', title: text(c('Sağ kəmər', 'Right strap', 'Sağ kemer'), lang), icon: 'check', x: 74, y: 15, w: 20, h: 46, colour: '#879b94' },
      { id: 'buckle', title: text(c('Tokanı birləşdir', 'Connect buckle', 'Tokayı birleştir'), lang), icon: 'lock', x: 36, y: 84, w: 28, h: 12, colour: '#c3ac89' },
    ]} />;
    case 'routine': return <RoutineGame language={lang} onFinish={onFinish} />;
    case 'names': return <NameScene state={state} catalogue={catalogue} dispatch={dispatch} onFinish={onFinish} />;
    case 'cooking': return <ProCooking source={source ?? catalogue.recipes[0]} language={lang} onFinish={onFinish} />;
    default: return null;
  }
}

function GameHeading({ title, description, language, phase, total }: { title: string; description: string; language: Language; phase?: number; total?: number }) {
  return <header className="scene-game-intro"><div className="game-stage-top"><span className="eyebrow">{t('interactive', language)}</span>{phase !== undefined && <span className="stage-counter">0{phase + 1} / 0{total}</span>}</div><h3>{title}</h3><p>{description}</p>{total && <div className="game-stage-dots">{Array.from({ length: total }, (_, i) => <i key={i} className={i <= (phase ?? 0) ? 'active' : ''} />)}</div>}</header>;
}

function PregnancyTest({ language: l, onFinish }: { language: Language; onFinish(score: number): void }) {
  const [phase, setPhase] = useState(0), [waiting, setWaiting] = useState(4);
  useEffect(() => { if (phase !== 2) return; const timer = setInterval(() => setWaiting(old => Math.max(0, old - 1)), 1000); return () => clearInterval(timer); }, [phase]);
  useEffect(() => { if (phase === 2 && waiting === 0) { setPhase(3); audio.success(); } }, [phase, waiting]);
  const titles = [c('Bir səhərin yeni başlanğıcı', 'A new beginning one morning', 'Bir sabahın yeni başlangıcı'), c('Test dəstini hazırla', 'Prepare the test kit', 'Test setini hazırla'), c('Bir neçə sakit saniyə…', 'A few quiet seconds…', 'Birkaç sakin saniye…'), c('İki xətt. Yeni bir həyat.', 'Two lines. A new life.', 'İki çizgi. Yeni bir hayat.')];
  return <div className="pregnancy-test-game"><GameHeading title={text(titles[phase], l)} description={text(c('Hekayə hamamda balaca bir testlə başlayır.', 'Your story begins with a little test in the bathroom.', 'Hikâye banyoda küçük bir testle başlıyor.'), l)} language={l} phase={phase} total={4} />
    <div className={`test-stage stage-${phase}`}><div className="test-tile-wall" /><div className="test-counter"><div className="test-box"><Icon name="heart" size={18} /><strong>ANACAN</strong><small>Pregnancy test</small></div><div className="test-stick"><span className="test-cap" /><span className="test-window">{phase === 3 && <><i /><i /></>}</span><span className="test-grip" /></div><div className="test-flower"><Icon name="flower" size={46} /></div></div>{phase === 2 && <div className="test-wait"><Icon name="clock" size={18} />{waiting}s</div>}{phase === 3 && <div className="positive-result"><Icon name="sparkles" size={22} /><span>{text(c('Hamiləlik hekayən başlayır', 'Your pregnancy story begins', 'Hamilelik hikâyen başlıyor'), l)}</span></div>}</div>
    {phase < 2 ? <div className="scene-choice-cards"><button className="scene-choice" onClick={() => { setPhase(phase + 1); audio.tap(); }} data-testid="test-next"><Icon name={phase === 0 ? 'test' : 'check'} size={26} /><span>{text(phase === 0 ? c('Testi qutudan çıxar', 'Take the test from the box', 'Testi kutudan çıkar') : c('Test səhnəsini başlat', 'Begin the test scene', 'Test sahnesini başlat'), l)}</span><Icon name="arrow" size={18} /></button></div> : phase === 3 ? <button className="button primary large" onClick={() => onFinish(100)} data-testid="test-finish"><Icon name="heart" />{text(c('Bu anı yadda saxla', 'Remember this moment', 'Bu anı sakla'), l)}</button> : <p className="scene-whisper">{text(c('Kiçik gözləmə, böyük duyğular.', 'A little wait, big feelings.', 'Küçük bir bekleyiş, büyük duygular.'), l)}</p>}
  </div>;
}

function AppointmentGame({ state, dispatch, onFinish }: { state: GameState; dispatch(action: GameAction): void; onFinish(score: number): void }) {
  const l = state.language, [day, setDay] = useState(2), [slot, setSlot] = useState('10:30'), [support, setSupport] = useState(0);
  return <div className="appointment-game"><GameHeading title={text(c('Ailə təqvimində yeni bir görüş', 'A new visit in your family calendar', 'Aile takviminde yeni bir randevu'), l)} description={text(c('Günün planını uyğunlaşdır, dəstəyini seç, müayinəni yaz.', 'Fit the visit into your day, choose support, and book it.', 'Günün planına uydur, desteğini seç ve muayeneyi kaydet.'), l)} language={l} />
    <div className="appointment-doctor"><span><Icon name="doctor" size={30} /></span><div><strong>Anacan Family Clinic</strong><small>{text(c('Prenatal görüş · ultrasəs səhnəsi', 'Prenatal visit · ultrasound scene', 'Gebelik randevusu · ultrason sahnesi'), l)}</small></div><Icon name="check" size={17} /></div>
    <div className="appointment-days">{[1, 2, 3, 4, 5].map((value, i) => <button key={value} className={day === value ? 'selected' : ''} onClick={() => setDay(value)}><span>{['MON', 'TUE', 'WED', 'THU', 'FRI'][i]}</span><strong>{state.day + value}</strong><i /></button>)}</div>
    <h4>{text(c('Uyğun saatı seç', 'Choose a time', 'Uygun saati seç'), l)}</h4><div className="appointment-times">{['09:00', '10:30', '13:00', '15:30'].map(time => <button className={slot === time ? 'selected' : ''} onClick={() => setSlot(time)} key={time}>{time}</button>)}</div>
    <h4>{text(c('Yanında kim olsun?', 'Who will join you?', 'Yanında kim olsun?'), l)}</h4><div className="appointment-support">{[c('Həyat yoldaşım', 'My partner', 'Eşim'), c('Ailəmdən biri', 'A family member', 'Ailemden biri')].map((title, i) => <button key={i} className={support === i ? 'selected' : ''} onClick={() => setSupport(i)}><Icon name={i === 0 ? 'heart' : 'users'} size={20} />{text(title, l)}{support === i && <Icon name="check" size={15} />}</button>)}</div>
    <button className="button primary large" onClick={() => { dispatch({ type: 'BOOK_APPOINTMENT', appointment: { day: state.day + day, time: slot, supportPerson: support === 0 ? 'partner' : 'family' } }); onFinish(100); }} data-testid="appointment-confirm"><Icon name="calendar" />{text(c('Görüşü təsdiqlə', 'Confirm appointment', 'Randevuyu onayla'), l)} · {slot}</button>
  </div>;
}

export function UltrasoundPicture({ week, focus = 1, scanIndex = 0 }: { week: number; focus?: number; scanIndex?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current; if (!element) return; const context = element.getContext('2d')!; element.width = 640; element.height = 440;
    context.fillStyle = '#11191b'; context.fillRect(0, 0, 640, 440);
    context.save(); context.translate(320, 25); context.beginPath(); context.moveTo(0, 0); context.arc(0, 0, 455, .27 * Math.PI, .73 * Math.PI); context.closePath(); context.clip();
    const gradient = context.createRadialGradient(0, 160, 20, 0, 230, 350); gradient.addColorStop(0, '#49545a'); gradient.addColorStop(1, '#111a1d'); context.fillStyle = gradient; context.fillRect(-320, 0, 640, 440);
    let seed = 801; for (let i = 0; i < 8200; i++) { seed = seed * 16807 % 2147483647; const x = seed / 2147483647 * 620 - 310; seed = seed * 16807 % 2147483647; const y = seed / 2147483647 * 425; context.globalAlpha = .045 + seed % 14 / 100; context.fillStyle = '#dbe2df'; context.fillRect(x, y, 1.3, 1); }
    context.globalAlpha = .6 + focus * .3; context.filter = `blur(${(1 - focus) * 9}px)`; context.translate(scanIndex === 1 ? 15 : -9, 193); context.rotate(-.45 + scanIndex * .12);
    context.strokeStyle = '#d8dfd8'; context.lineWidth = 4; context.fillStyle = '#9da79e'; context.shadowColor = '#e5eadf'; context.shadowBlur = 10;
    const small = week < 12; context.beginPath(); context.ellipse(-30, -56, small ? 31 : 54, small ? 35 : 62, -.1, 0, Math.PI * 2); context.fill(); context.stroke();
    context.fillStyle = '#79877f'; context.beginPath(); context.ellipse(4, 40, small ? 28 : 52, small ? 45 : 77, -.30, 0, Math.PI * 2); context.fill(); context.stroke();
    context.strokeStyle = '#d9e3d6'; context.lineWidth = small ? 6 : 11; context.lineCap = 'round';
    context.beginPath(); context.moveTo(12, 25); context.quadraticCurveTo(45, 22, 29, -10); context.stroke();
    context.beginPath(); context.moveTo(-5, 90); context.quadraticCurveTo(-70, 137, -80, 68); context.stroke();
    if (!small) { context.beginPath(); context.moveTo(24, 93); context.quadraticCurveTo(49, 137, 6, 146); context.stroke(); context.beginPath(); context.moveTo(-28, 0); context.lineTo(-69, 39); context.stroke(); }
    context.restore(); context.filter = 'none'; context.fillStyle = '#bad3c7'; context.font = '600 16px monospace'; context.fillText('ANACAN · STORY SCAN', 20, 30); context.fillStyle = '#91a79e'; context.font = '13px monospace'; context.fillText(`WEEK ${week}   |   SIMULATION`, 20, 418); context.fillText('2D / FAMILY MEMORIES', 409, 418);
    context.strokeStyle = '#506b63'; context.lineWidth = 1; for (let y = 60; y < 390; y += 30) { context.beginPath(); context.moveTo(600, y); context.lineTo(611, y); context.stroke(); }
  }, [week, focus, scanIndex]);
  return <canvas ref={canvas} className="ultrasound-picture" aria-label="Illustrated pregnancy ultrasound scene" />;
}

function UltrasoundGame({ state, catalogue, dispatch, onFinish }: { state: GameState; catalogue: Catalogue; dispatch(action: GameAction): void; onFinish(score: number, sourceId?: string): void }) {
  const [probe, setProbe] = useState({ x: 15, y: 70 }), [frames, setFrames] = useState(0), [focus, setFocus] = useState(0), [detail, setDetail] = useState(45);
  const pad = useRef<HTMLDivElement>(null), l = state.language, week = simulationWeek(state), row = pregnancyForWeek(catalogue, week), target = [{ x: 60, y: 40 }, { x: 37, y: 64 }, { x: 68, y: 63 }][frames];
  const clarity = Math.max(0, 1 - Math.hypot(probe.x - target.x, probe.y - target.y) / 36) * (1 - Math.abs(detail - [58, 42, 68][frames]) / 100);
  useEffect(() => { const timer = setInterval(() => setFocus(old => clarity > .82 ? Math.min(100, old + 12) : Math.max(0, old - 9)), 180); return () => clearInterval(timer); }, [clarity]);
  const move = (e: React.PointerEvent<HTMLDivElement>) => { const rect = pad.current!.getBoundingClientRect(); setProbe({ x: Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100)), y: Math.max(0, Math.min(100, (e.clientY - rect.top) / rect.height * 100)) }); };
  const capture = () => {
    audio.sparkle();
    if (frames === 2) {
      const canvas = document.querySelector<HTMLCanvasElement>('.ultrasound-picture');
      if (canvas) dispatch({ type: 'MEMORY', memory: { id: `scan-${state.chapter}`, kind: 'milestone', chapter: state.chapter, day: state.day,
        title: c('Ultrasəs müayinəsi', 'Ultrasound visit', 'Ultrason muayenesi'),
        description: c(`${week}-ci həftə · balacanın oyun görüntüsü.`, `Week ${week} · your little one's game scan.`, `${week}. hafta · bebeğinin oyun görüntüsü.`),
        icon: 'scan', photo: canvas.toDataURL('image/jpeg', .78), ...(row ? { sourceId: row.id } : {}) } });
      onFinish(100, row?.id);
    } else { setFrames(frames + 1); setFocus(0); }
  };
  return <div className="ultrasound-game"><GameHeading title={text(c('Ekranda balacanı kəşf et', 'Discover your baby on the screen', 'Ekranda bebeğini keşfet'), l)} description={text(c('Probu işarəyə apar, görüntü fokusunu sabitləşdir və üç kadr saxla.', 'Move the probe to the marker, hold the focus, and save three frames.', 'Probu işarete götür, görüntü odağını sabitle ve üç kare kaydet.'), l)} language={l} phase={frames} total={3} />
    <div className="ultrasound-monitor"><UltrasoundPicture week={week} focus={clarity} scanIndex={frames} /><div className="scan-readout"><span>{t('week', l)} <strong>{week}</strong></span><span>{row ? rowText(row, 'baby_size_fruit', l) : 'Anacan'}<Icon name="heart" size={15} /></span></div></div>
    <div className="probe-pad" ref={pad} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); move(e); }} onPointerMove={e => { if (e.buttons) move(e); }} data-testid="scan-pad"><span className="probe-body" /><span className="probe-target" style={{ left: `${target.x}%`, top: `${target.y}%` }} /><span className="probe-device" style={{ left: `${probe.x}%`, top: `${probe.y}%` }}><Icon name="scan" size={28} /></span><small>{text(c('Probu burada hərəkət etdir', 'Move the probe here', 'Probu burada hareket ettir'), l)}</small></div>
    <label className="scan-focus-label">{text(c('Görüntü dərinliyi', 'Picture depth', 'Görüntü derinliği'), l)}<input type="range" min="0" max="100" value={detail} onChange={e => setDetail(Number(e.target.value))} data-testid="scan-depth" /></label>
    <div className="scan-focus-meter"><span>{text(c('Sabit fokus', 'Steady focus', 'Sabit odak'), l)}</span><div><i style={{ width: `${focus}%` }} /></div><strong>{focus}%</strong></div>
    <button className="button primary large" disabled={focus < 90} onClick={capture} data-testid="scan-capture"><Icon name="camera" />{text(c('Ultrasəs kadrını saxla', 'Save scan frame', 'Ultrason karesini kaydet'), l)} {frames + 1}/3</button>
  </div>;
}

export function BreathingGame({ language: l, onFinish, activity = 'breathe' }: { language: Language; onFinish(score: number): void; activity?: string }) {
  const [cycles, setCycles] = useState(0), [holding, setHolding] = useState(false), [progress, setProgress] = useState(0), [elapsed, setElapsed] = useState(0);
  const start = useRef(0), held = useRef(false), total = useRef(0), good = useRef(0), finished = useRef(false);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      const seconds = (performance.now() - start.current) / 1000, phase = seconds % 5, inhale = phase < 2.4;
      setElapsed(seconds); total.current++; if (held.current === inhale) good.current++;
      setProgress(Math.min(100, seconds / 15 * 100)); setCycles(Math.min(3, Math.floor(seconds / 5)));
      if (seconds >= 15 && !finished.current) { finished.current = true; clearInterval(timer); onFinish(Math.max(30, good.current / total.current * 100)); }
    }, 90); return () => clearInterval(timer);
  }, [onFinish, running]);
  const inhale = elapsed % 5 < 2.4, scale = .72 + Math.sin(Math.PI * (elapsed % 5) / 5) * .34;
  return <div className="breathing-game"><GameHeading title={text(activity === 'kick' ? c('Balacandan bir salam', 'A little hello from within', 'Bebeğinden minik bir selam') : c('Dalğalarla eyni ritmdə', 'In rhythm with the waves', 'Dalgalarla aynı ritimde'), l)} description={text(c('Dairə böyüyəndə basıb saxla. Kiçiləndə barmağını burax.', 'Hold while the circle expands. Release as it settles.', 'Daire büyürken basılı tut. Küçülürken parmağını bırak.'), l)} language={l} />
    <div className="breath-orbit"><i /><i /><button className={`breath-core ${holding ? 'holding' : ''}`} style={{ transform: `scale(${scale})` }} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); if (!running) { start.current = performance.now(); setRunning(true); } held.current = true; setHolding(true); }} onPointerUp={() => { held.current = false; setHolding(false); }} onPointerCancel={() => { held.current = false; setHolding(false); }} data-testid="breath-hold" data-inhale={inhale}><Icon name={activity === 'kick' ? 'heart' : 'wind'} size={46} /></button><span>{text(!running ? c('Başlamaq üçün basıb saxla', 'Hold to begin', 'Başlamak için basılı tut') : inhale ? c('Nəfəs al', 'Breathe in', 'Nefes al') : c('Nəfəsi burax', 'Breathe out', 'Nefes ver'), l)}</span></div>
    <div className="breath-cycles">{[0, 1, 2].map(i => <span className={cycles > i ? 'done' : ''} key={i}><Icon name={cycles > i ? 'check' : 'waves'} size={19} /></span>)}</div><div className="scene-progress"><i style={{ width: `${progress}%` }} /></div><p className="scene-whisper">{t('narrativeNote', l)}</p>
  </div>;
}

function HospitalPacking({ catalogue, language: l, onFinish }: { catalogue: Catalogue; language: Language; onFinish(score: number): void }) {
  const items = catalogue.bag.filter(row => row.is_essential).slice(0, 6);
  const positions = [[6, 8, 40, 22], [53, 8, 40, 22], [6, 36, 40, 24], [53, 36, 40, 24], [6, 66, 40, 25], [53, 66, 40, 25]];
  return <DragPuzzle language={l} variant="bag" onFinish={score => onFinish(score)} title={c('Doğum çantanı hazırla', 'Prepare your hospital bag', 'Doğum çantanı hazırla')} description={c('Anacan siyahısındakı əsas əşyaları yerinə sürüşdür. Ana, körpə və sənədlər üçün hər şey hazır olsun.', 'Fit the Anacan essentials in their places. Prepare the mother, baby, and document sections.', 'Anacan listesindeki temel eşyaları yerine sürükle. Anne, bebek ve belge bölümleri hazır olsun.')} pieces={items.map((row, i): PuzzlePiece => ({ id: row.id, title: rowText(row, 'item_name', l), icon: row.category === 'documents' ? 'notebook' : row.category === 'baby' ? 'baby' : 'shirt', x: positions[i][0], y: positions[i][1], w: positions[i][2], h: positions[i][3], colour: ['#a9b6ab', '#c7ad8d', '#b4a3be'][i % 3] }))} />;
}

function BirthPlanGame({ state, dispatch, onFinish }: { state: GameState; dispatch(action: GameAction): void; onFinish(score: number): void }) {
  const [plan, setPlan] = useState<'vaginal' | 'cesarean'>(state.pregnancy.birthPlan === 'cesarean' ? 'cesarean' : 'vaginal'), [support, setSupport] = useState(state.pregnancy.supportPerson === 'family' ? 1 : 0), [comfort, setComfort] = useState(state.pregnancy.comfort === 'light' ? 1 : 0), l = state.language;
  return <div className="birth-plan-game"><GameHeading title={t('birthPlan', l)} description={text(c('Bu oyundakı doğuş hekayən üçün yol, dəstək və rahatlıq seç.', 'Choose a path, support, and comfort for your game’s birth story.', 'Oyundaki doğum hikâyen için yol, destek ve rahatlık seç.'), l)} language={l} />
    <div className="birth-paths">{(['vaginal', 'cesarean'] as const).map(p => <button key={p} className={plan === p ? 'selected' : ''} onClick={() => setPlan(p)} data-testid={`birth-plan-${p}`}><span><Icon name={p === 'vaginal' ? 'waves' : 'doctor'} size={30} /></span><strong>{t(p, l)}</strong><p>{text(p === 'vaginal' ? c('Nəfəs, dəstək və doğuş dalğaları ilə mərhələli səhnə.', 'A step-by-step scene with breathing, support, and birth waves.', 'Nefes, destek ve doğum dalgalarıyla aşamalı sahne.') : c('Komanda ilə hazırlıq, əməliyyat səhnəsi və ilk görüş.', 'Preparation with the team, a theatre scene, and the first meeting.', 'Ekiple hazırlık, ameliyathane sahnesi ve ilk buluşma.'), l)}</p><i><Icon name={plan === p ? 'check' : 'circle'} size={18} /></i></button>)}</div>
    <h4>{text(c('Yanındakı dəstək', 'Support beside you', 'Yanındaki destek'), l)}</h4><div className="plan-options">{[c('Həyat yoldaşım', 'My partner', 'Eşim'), c('Ailə üzvüm', 'Family member', 'Aile üyem')].map((value, i) => <button key={i} onClick={() => setSupport(i)} className={support === i ? 'selected' : ''}><Icon name="users" size={17} />{text(value, l)}</button>)}</div>
    <h4>{text(c('Sakitləşdirici detal', 'A calming detail', 'Sakinleştirici ayrıntı'), l)}</h4><div className="plan-options">{[c('Sakit musiqi', 'Quiet music', 'Sakin müzik'), c('Yumşaq işıq', 'Soft light', 'Yumuşak ışık')].map((value, i) => <button key={i} onClick={() => setComfort(i)} className={comfort === i ? 'selected' : ''}><Icon name={i === 0 ? 'music' : 'sun'} size={17} />{text(value, l)}</button>)}</div>
    <button className="button primary large" onClick={() => { dispatch({ type: 'BIRTH_PLAN', plan, supportPerson: support === 0 ? 'partner' : 'family', comfort: comfort === 0 ? 'music' : 'light' }); onFinish(100); }} data-testid="birth-plan-confirm"><Icon name="clipboard" />{t('save', l)}</button><small className="scene-whisper">{t('narrativeNote', l)}</small>
  </div>;
}

function ContractionsGame({ language: l, onFinish }: { language: Language; onFinish(score: number): void }) {
  const [time, setTime] = useState(0), [timing, setTiming] = useState(false), [records, setRecords] = useState<number[]>([]), start = useRef(performance.now()), began = useRef(0), ended = useRef(false);
  useEffect(() => { const timer = setInterval(() => setTime((performance.now() - start.current) / 1000), 60); return () => clearInterval(timer); }, []);
  const phase = time % 6, active = phase >= 1 && phase < 4, strength = active ? Math.sin((phase - 1) / 3 * Math.PI) : 0;
  const toggle = () => {
    if (ended.current) return;
    if (!timing) { began.current = time; setTiming(true); }
    else { const score = Math.max(35, 100 - Math.abs(time - began.current - 3) * 15); const next = [...records, score]; setRecords(next); setTiming(false); audio.sparkle(); if (next.length === 3) { ended.current = true; onFinish(next.reduce((a, b) => a + b) / 3); } }
  };
  return <div className="contractions-game"><GameHeading title={text(c('Dalğanın başlanğıcını və sonunu tut', 'Catch the beginning and end of a wave', 'Dalganın başlangıcını ve sonunu yakala'), l)} description={text(c('Bu səhnənin üç oyun dalğasını qeyd et. İşıq yüksələndə başlat, sönəndə bitir.', 'Record three game waves. Start as the light rises, stop as it settles.', 'Üç oyun dalgasını kaydet. Işık yükselirken başlat, sönerken bitir.'), l)} language={l} />
    <div className="wave-chart"><svg viewBox="0 0 400 140"><defs><linearGradient id="waveFill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#91b9ad" stopOpacity=".6" /><stop offset="1" stopColor="#91b9ad" stopOpacity="0" /></linearGradient></defs>{[1, 2, 3].map(i => <line key={i} x1="0" y1={i * 35} x2="400" y2={i * 35} stroke="#d5dfd6" strokeDasharray="3 5" />)}<path d={`M 0 125 Q 50 125 80 115 Q 115 ${120 - strength * 155} 170 112 Q 220 124 400 125 L400 140 L0 140Z`} fill="url(#waveFill)" stroke="#8bab9d" strokeWidth="3" /></svg><div className="wave-state"><i className={active ? 'on' : ''} />{text(active ? c('Oyun dalğası', 'Game wave', 'Oyun dalgası') : c('Sakit aralıq', 'Quiet interval', 'Sakin aralık'), l)}</div></div>
    <div className="wave-records">{[0, 1, 2].map(i => <span key={i} className={records[i] ? 'done' : ''}><Icon name={records[i] ? 'check' : 'waves'} size={21} /><small>{text(c('Dalğa', 'Wave', 'Dalga'), l)} {i + 1}</small></span>)}</div>
    <button className={`contraction-timer ${timing ? 'recording' : ''}`} onClick={toggle} data-testid="wave-timer"><Icon name={timing ? 'pause' : 'timer'} size={36} /><strong>{text(timing ? c('Dalğa bitdi', 'Wave ended', 'Dalga bitti') : c('Dalğa başladı', 'Wave started', 'Dalga başladı'), l)}</strong><span>{timing ? (time - began.current).toFixed(1) + 's' : '00:00'}</span></button><small className="scene-whisper">{t('narrativeNote', l)}</small>
  </div>;
}

function BabyCareGame({ activity, state, dispatch, onFinish }: { activity: Activity; state: GameState; dispatch(action: GameAction): void; onFinish(score: number): void }) {
  const [phase, setPhase] = useState(0), [method, setMethod] = useState(state.pregnancy.feeding), [errors, setErrors] = useState(0), l = state.language;
  const steps = activity.id === 'diaper' ? [c('Əşyaları hazırla', 'Prepare the items', 'Eşyaları hazırla'), c('Təmiz bezə keç', 'Change to a fresh nappy', 'Temiz beze geç'), c('Tokaları bağla', 'Fasten the tabs', 'Bantları bağla'), c('Geyimi düzəlt', 'Tidy the clothes', 'Giysiyi düzelt')] : [c('Rahat guşəni seç', 'Choose a comfortable corner', 'Rahat köşeyi seç'), c('Qucağı hazırla', 'Prepare your cuddle', 'Kucağını hazırla'), c('Qayğı anını tamamla', 'Complete the care moment', 'Bakım anını tamamla'), c('Sakit bir fasilə', 'A quiet pause', 'Sakin bir mola')];
  const icons = activity.id === 'diaper' ? ['bag', 'sparkles', 'check', 'shirt'] : ['sofa', 'heart', 'bottle', 'moon'];
  const next = (index: number) => { if (index !== phase) { setErrors(errors + 1); return; } if (phase === 3) { if (activity.id === 'feed') dispatch({ type: 'FEEDING', method }); onFinish(Math.max(50, 100 - errors * 10)); } else { setPhase(phase + 1); audio.sparkle(); } };
  return <div className="baby-care-game"><GameHeading title={text(activity.title, l)} description={text(steps[phase], l)} language={l} phase={phase} total={4} />
    {activity.id === 'feed' && <div className="feeding-choices">{(['breast', 'bottle', 'combination'] as const).map(m => <button className={method === m ? 'selected' : ''} key={m} onClick={() => setMethod(m)}>{t(m, l)}</button>)}</div>}
    <div className={`care-baby-stage care-phase-${phase}`}><div className="care-mat" /><svg viewBox="0 0 240 230"><ellipse cx="120" cy="204" rx="65" ry="12" fill="#5e685018" /><rect x="81" y="94" width="78" height="92" rx="35" fill={activity.id === 'diaper' && phase > 0 ? '#f4efe1' : '#b9c4b2'} /><path d="M87 164h66v28H87Z" fill="#e6d8bd" /><ellipse cx="120" cy="77" rx="37" ry="40" fill={state.avatar.skin} /><path d="M90 54q30-37 57-2" stroke="#8d6e56" strokeWidth="10" fill="none" strokeLinecap="round" /><path d="M105 79h7m17 0h7" stroke="#594234" strokeWidth="3" strokeLinecap="round" /><path d="M113 94q7 8 14 0" stroke="#ad8170" strokeWidth="3" fill="none" strokeLinecap="round" /><path d="M81 112l-14 39m92-39 14 39" stroke={state.avatar.skin} strokeWidth="17" strokeLinecap="round" /><path d="m105 190-5 19m35-19 5 19" stroke={state.avatar.skin} strokeWidth="19" strokeLinecap="round" /></svg><span className="baby-stage-name">{state.avatar.babyName}</span></div>
    <div className="care-tool-grid">{[2, 0, 3, 1].map(index => <button className={`${index < phase ? 'used' : ''} ${index === phase ? 'current' : ''}`} key={index} disabled={index < phase} onClick={() => next(index)} data-testid={`care-step-${index}`}><Icon name={index < phase ? 'check' : icons[index]} size={25} /><span>{text(steps[index], l)}</span><small>0{index + 1}</small></button>)}</div>
  </div>;
}

function RoutineGame({ language: l, onFinish }: { language: Language; onFinish(score: number): void }) {
  const titles = [c('Qidalandırma', 'Feeding', 'Beslenme'), c('Oyun', 'Play', 'Oyun'), c('Yuxu', 'Sleep', 'Uyku'), c('Anaya fasilə', 'A break for mum', 'Anneye mola')];
  return <DragPuzzle language={l} variant="routine" onFinish={onFinish} title={c('Ailə gününün planını qur', 'Plan your family’s day', 'Aile gününü planla')} description={c('Vaxt kartlarını uyğun guşəyə sürüşdür. Qayğı və istirahət balansda olsun.', 'Drag the time cards into their places. Balance care and rest.', 'Zaman kartlarını uygun yerlerine sürükle. Bakım ve dinlenme dengelensin.')} pieces={titles.map((title, i) => ({ id: `routine-${i}`, title: text(title, l), icon: ['bottle', 'blocks', 'moon', 'leaf'][i], x: 8, y: 5 + i * 23, w: 84, h: 19, colour: ['#b8a17c', '#92a692', '#9d91b6', '#b4aaa0'][i] }))} />;
}

function NameScene({ state, catalogue, dispatch, onFinish }: { state: GameState; catalogue: Catalogue; dispatch(action: GameAction): void; onFinish(score: number): void }) {
  const [query, setQuery] = useState(''), [name, setName] = useState(state.avatar.babyName), l = state.language;
  const rows = catalogue.names.filter(row => String(row.name).toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(0, 8);
  return <div className="name-scene"><GameHeading title={text(c('Balacana ilk hədiyyən', 'Your first gift to your baby', 'Bebeğine ilk hediyen'), l)} description={text(c('Bir ad seç, mənasını kəşf et, ailənizin hekayəsinə yaz.', 'Choose a name, discover its meaning, and make it part of your story.', 'Bir isim seç, anlamını keşfet, ailenizin hikâyesine yaz.'), l)} language={l} /><div className="name-gift"><Icon name="baby" size={40} /><h3>{name}</h3><Icon name="heart" size={17} /></div><label className="name-search"><Icon name="search" size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('search', l)} /></label><div className="name-options">{rows.map(row => <button key={row.id} className={name === row.name ? 'selected' : ''} onClick={() => setName(String(row.name))}><strong>{String(row.name)}</strong><small>{rowText(row, 'meaning', l)}</small>{name === row.name && <Icon name="check" size={16} />}</button>)}</div><button className="button primary large" onClick={() => { dispatch({ type: 'AVATAR', avatar: { ...state.avatar, babyName: name } }); onFinish(100); }} data-testid="name-confirm">{t('selectName', l)}<Icon name="heart" /></button></div>;
}

function ProCooking({ source, language: l, onFinish }: { source: PublicRow; language: Language; onFinish(score: number, sourceId?: string): void }) {
  const [phase, setPhase] = useState(0), [picked, setPicked] = useState<number[]>([]), [chops, setChops] = useState(0), [heat, setHeat] = useState(50), [cooked, setCooked] = useState(0), [errors, setErrors] = useState(0), [running, setRunning] = useState(false);
  const board = useRef<HTMLDivElement>(null), started = useRef<{ x: number; y: number } | null>(null), ingredients = rowArray(source, 'ingredients', l).slice(0, 4);
  useEffect(() => { if (phase !== 2 || !running) return; const timer = setInterval(() => { if (heat >= 38 && heat <= 67) setCooked(old => Math.min(100, old + 6)); else setErrors(old => old + 1); }, 350); return () => clearInterval(timer); }, [phase, running, heat]);
  useEffect(() => { if (cooked >= 100 && phase === 2) { setPhase(3); audio.success(); } }, [cooked, phase]);
  const headings = [c('Ərzaqları hazırla', 'Prepare ingredients', 'Malzemeleri hazırla'), c('Doğrama ritmini tap', 'Find your chopping rhythm', 'Doğrama ritmini bul'), c('İstiliyi idarə et', 'Control the heat', 'Isıyı kontrol et'), c('Sevgi ilə süfrəyə ver', 'Serve with love', 'Sevgiyle servis et')];
  const pick = (i: number) => { if (picked.includes(i)) return; const next = [...picked, i]; setPicked(next); audio.tap(); if (next.length === ingredients.length) setPhase(1); };
  const chop = (x: number, y: number) => { if (!started.current || !board.current) return; const d = Math.hypot(x - started.current.x, y - started.current.y); if (d > 24) { setChops(old => { const next = Math.min(8, old + 1); if (next >= 8) setPhase(2); return next; }); started.current = { x, y }; audio.tap(); } };
  return <div className="pro-cooking-game"><GameHeading title={text(headings[phase], l)} description={rowText(source, 'title', l)} language={l} phase={phase} total={4} />
    {phase === 0 && <><div className="kitchen-prep-stage"><div className="prep-basket"><Icon name="cooking" size={70} /><span>{picked.length} / {ingredients.length}</span></div></div><div className="pro-ingredients">{[2, 0, 3, 1].filter(i => i < ingredients.length).map(i => <button key={i} onClick={() => pick(i)} className={picked.includes(i) ? 'done' : ''} data-testid={`ingredient-${i}`}><span className={`produce produce-${i}`}><Icon name={picked.includes(i) ? 'check' : ['leaf', 'flower', 'leaf', 'utensils'][i]} size={28} /></span><strong>{ingredients[i].split(/[-–]/)[0]}</strong><Icon name={picked.includes(i) ? 'check' : 'plus'} size={16} /></button>)}</div></>}
    {phase === 1 && <><p className="scene-whisper">{text(c('Lövhədə barmağını sürüşdürərək doğra. 8 bərabər hərəkət.', 'Swipe across the board to chop. Eight even movements.', 'Tahtada parmağını sürükleyerek doğra. Sekiz eşit hareket.'), l)}</p><div className="chopping-board" ref={board} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); started.current = { x: e.clientX, y: e.clientY }; }} onPointerMove={e => { if (e.buttons) chop(e.clientX, e.clientY); }} onPointerUp={() => { started.current = null; }} data-testid="chopping-board"><div className="board-grain" /><div className="chop-produce">{Array.from({ length: Math.max(1, chops + 1) }, (_, i) => <i key={i} style={{ left: `${18 + i * 7.5}%`, transform: `rotate(${i * 14 - 20}deg)` }} />)}</div><span className="board-knife"><Icon name="scissors" size={38} /></span><span className="chop-count">{chops} / 8</span></div><button className="button secondary large" onClick={() => { setChops(old => old + 1); if (chops + 1 >= 8) setPhase(2); }} data-testid="chop-tap"><Icon name="scissors" size={17} />{text(c('Bir hissə doğra', 'Chop a piece', 'Bir parça doğra'), l)}</button></>}
    {phase === 2 && <><div className={`stove-stage ${running ? 'cooking' : ''}`}><div className="stove-burner" style={{ opacity: .2 + heat / 100 * .7 }} /><div className="game-pot"><div className="pot-soup"><i /><i /><i /></div><div className="pot-body"><Icon name="heart" size={27} /></div><span className="steam steam-1" /><span className="steam steam-2" /></div></div><div className="temperature-label"><span>{text(c('Ocaq gücü', 'Heat level', 'Ocak gücü'), l)}</span><strong>{heat}%</strong><input type="range" min="0" max="100" value={heat} onChange={e => setHeat(Number(e.target.value))} data-testid="stove-heat" /></div><div className="heat-guide"><span>{text(c('Az', 'Low', 'Düşük'), l)}</span><strong>{text(c('Orta istilik', 'Medium heat', 'Orta ısı'), l)}</strong><span>{text(c('Çox', 'High', 'Yüksek'), l)}</span></div><div className="scene-progress"><i style={{ width: `${cooked}%` }} /></div>{!running && <button className="button primary large" onClick={() => setRunning(true)} data-testid="stove-start"><Icon name="cooking" />{text(c('Bişirməyə başla', 'Start cooking', 'Pişirmeye başla'), l)}</button>}<p className="scene-whisper">{text(c('Göstəricini orta istilikdə saxla və yeməyi tamamla.', 'Keep the setting at medium heat to finish your meal.', 'Göstergeyi orta ısıda tut ve yemeği tamamla.'), l)}</p></>}
    {phase === 3 && <><div className="served-meal"><div className="served-plate"><Icon name="leaf" size={62} /><i /><i /></div><span className="served-cutlery"><Icon name="utensils" size={45} /></span></div><h4 className="served-title">{rowText(source, 'title', l)}</h4><p className="scene-whisper">{text(c('Mətbəxindən gələn qoxu evi isidir.', 'The smell from your kitchen makes a home.', 'Mutfağından gelen koku evi ısıtıyor.'), l)}</p><button className="button primary large" onClick={() => onFinish(Math.max(60, 100 - errors * 2), source.id)} data-testid="cooking-serve">{text(c('Süfrəyə ver', 'Serve', 'Servis et'), l)}<Icon name="utensils" /></button></>}
  </div>;
}
