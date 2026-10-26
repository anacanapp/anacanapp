import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Materials } from '../world/materials';
import { Character, makeBaby } from '../world/character';
import { copy as c } from '../game/copy';
import { t, text } from '../game/i18n';
import type { Avatar, GameAction, GameState } from '../game/types';
import { Icon } from './Icon';
import { BreathingGame } from './SimulationGames';
import { audio } from '../game/audio';

export function BirthDiorama({ avatar, stage, cesarean }: { avatar: Avatar; stage: number; cesarean: boolean }) {
  const container = useRef<HTMLDivElement>(null), state = useRef({ stage, cesarean }); state.current = { stage, cesarean };
  useEffect(() => {
    const element = container.current!; let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    element.appendChild(renderer.domElement); const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 1, .1, 50), materials = new Materials();
    scene.add(new THREE.HemisphereLight('#fff4e0', '#a5b9bc', 2.0));
    const light = new THREE.DirectionalLight('#ffeac4', 3.0); light.position.set(-3, 8, 5); light.castShadow = true; light.shadow.mapSize.set(512, 512); scene.add(light);
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, colour: string) => {
      const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(.05, w / 4, h / 4, d / 4)), materials.colour(colour)); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; scene.add(m); return m;
    };
    box(7.5, .12, 6.0, 0, -.1, 0, '#e4e5d9'); box(7.5, 3.5, .12, 0, 1.6, -2.5, '#d8e2d8'); box(.12, 3.5, 6, -3.7, 1.6, 0, '#dce5dc');
    box(1.88, .23, 2.75, 0, .58, 0, '#a4b9ad'); box(1.77, .19, 2.62, 0, .8, 0, '#f2ece0');
    box(1.56, .10, .58, 0, .95, -.81, '#fff1df');
    const blanket = box(1.6, .10, 1.56, 0, 1.01, .53, '#b4c8bb');
    for (const x of [-.94, .94]) { box(.035, .31, 2.35, x, .72, .06, '#adb6a4'); box(.04, .04, 2.35, x, .94, .06, '#c4c8b5'); }
    box(.65, .07, .55, 2.58, 1.05, -.75, '#b6c5b6'); box(.52, .36, .06, 2.58, 1.29, -.87, '#456e69');
    box(.49, .27, .022, 2.58, 1.30, -.825, '#8ac2ad'); box(.065, .75, .065, 2.58, .64, -.75, '#a4b49f');
    box(2.0, 1.22, .035, 1.6, 2.10, -2.4, '#c4dadd'); box(2.14, .12, .075, 1.6, 2.78, -2.39, '#eff0e3');
    box(.045, 1.2, .07, 1.6, 2.1, -2.36, '#eef2e5');
    const mother = new Character(materials, { ...avatar, outfit: '#d6ddd1', outfitStyle: 'knit' }); mother.group.position.set(0, .8, -.35); mother.group.rotation.y = Math.PI / 2; mother.group.scale.setScalar(.78); scene.add(mother.group);
    const partner = new Character(materials, { ...avatar, outfitStyle: 'casual' }, true); partner.group.position.set(-1.5, 0, .7); partner.group.rotation.y = 1.6; partner.setActivity('talk'); scene.add(partner.group);
    const doctor = new Character(materials, { ...avatar, skin: '#bd8059', hair: '#241e25', hairstyle: 'bun', outfitStyle: 'casual' }, false, true); doctor.group.position.set(1.65, 0, .62); doctor.group.rotation.y = -1.5; doctor.setActivity('talk'); scene.add(doctor.group);
    const drape = box(2.13, 1.16, .055, .0, 1.59, .65, '#9bb8b1');
    const baby = makeBaby(materials, avatar.skin, '#e6d1b1'); baby.position.set(.12, 1.35, -.25); baby.rotation.z = -1.15; baby.scale.setScalar(.95); scene.add(baby);
    const resize = () => { const w = element.clientWidth, h = element.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    let frame = 0, last = 0; const animate = (now: number) => {
      frame = requestAnimationFrame(animate); if (document.hidden || now - last < 1000 / 30) return;
      const dt = Math.min(.1, (now - (last || now)) / 1000); last = now;
      const born = state.current.stage >= 3; mother.setPregnant(born ? false : 39); mother.setChildPresent(born); mother.setActivity(born ? 'skin' : 'birth');
      mother.animate(dt, false); partner.animate(dt, false); doctor.animate(dt, false);
      drape.visible = state.current.cesarean && !born && state.current.stage >= 1; blanket.visible = !born; baby.visible = false;
      camera.position.set(5.2, 4.3, 6.6); camera.lookAt(0, 1.1, .05); renderer.render(scene, camera);
    }; frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); scene.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); } }); materials.dispose(); renderer.dispose(); renderer.domElement.remove(); };
  }, [JSON.stringify(avatar)]);
  return <div className="birth-diorama" ref={container} />;
}

export function BirthExperience({ state, dispatch, onClose }: { state: GameState; dispatch(action: GameAction): void; onClose(): void }) {
  const l = state.language, stage = state.pregnancy.birthStage, cesarean = state.pregnancy.birthPlan === 'cesarean';
  const [ready, setReady] = useState(false), [quality, setQuality] = useState(100), [checks, setChecks] = useState<number[]>([]), [taps, setTaps] = useState(0), [breathing, setBreathing] = useState(false), [pulse, setPulse] = useState(0);
  const pulseStart = useRef(performance.now()), lastPulse = useRef(-1);
  useEffect(() => { setReady(false); setChecks([]); setTaps(0); setBreathing(false); pulseStart.current = performance.now(); lastPulse.current = -1; if (stage === 3) { const timer = setTimeout(() => setReady(true), 2800); return () => clearTimeout(timer); } }, [stage]);
  useEffect(() => { if (stage !== 2) return; const timer = setInterval(() => setPulse((performance.now() - pulseStart.current) / 1000), 65); return () => clearInterval(timer); }, [stage]);
  const pulsePhase = pulse % 1.8, pulseOpen = pulsePhase >= .40 && pulsePhase <= 1.20;
  const titles = cesarean ? [c('Komandanla tanış ol', 'Meet your team', 'Ekibinle tanış'), c('Əməliyyat səhnəsinə hazırlaş', 'Prepare for the theatre scene', 'Ameliyathane sahnesine hazırlan'), c('İlk səsə doğru', 'Towards the first sound', 'İlk sese doğru'), c('Balacan artıq qucağındadır', 'Your baby is in your arms', 'Bebeğin artık kucağında'), c('Yeni ailənizin ilk xatirəsi', 'Your new family’s first memory', 'Yeni ailenizin ilk anısı')]
    : [c('Doğuş otağına xoş gəldin', 'Welcome to your birth suite', 'Doğum odana hoş geldin'), c('Dalğalarla bir ritmdə', 'In rhythm with the waves', 'Dalgalarla bir ritimde'), c('Son dalğa, ilk görüş', 'The last wave, the first meeting', 'Son dalga, ilk buluşma'), c('Balacan artıq qucağındadır', 'Your baby is in your arms', 'Bebeğin artık kucağında'), c('Yeni ailənizin ilk xatirəsi', 'Your new family’s first memory', 'Yeni ailenizin ilk anısı')];
  const descriptions = [c('Planını komandayla paylaş. Yanında həyat yoldaşın və həkimin var.', 'Share your plan with the team. Your partner and doctor are beside you.', 'Planını ekiple paylaş. Eşin ve doktorun yanında.'),
    cesarean ? c('Üç hazırlıq kartını tamamla: komanda, dəstək və rahatlıq. Sonra səhnə davam edir.', 'Complete three preparation cards: team, support, and comfort. Then the scene continues.', 'Üç hazırlık kartını tamamla: ekip, destek ve rahatlık. Sonra sahne devam eder.') : c('Nəfəs dairəsi ilə basıb-saxlama ritmini tamamla. Hər dalğada dəstəyin yanındadır.', 'Complete the hold-and-release breathing rhythm. Support is beside you through each wave.', 'Nefes dairesiyle basılı tutma ritmini tamamla. Her dalgada desteğin yanında.'),
    c('Oyunun emosional görüş səhnəsi. İşıq dalğasının hər gəlişində ürəyə toxun.', 'The game’s emotional meeting scene. Tap the heart with each arriving wave of light.', 'Oyunun duygusal buluşma sahnesi. Işık dalgası geldikçe kalbe dokun.'),
    c('Bir balaca nəfəs, bir yeni ad, bir isti qucaq. Hekayənizin ən yeni üzvünə xoş gəldin deyin.', 'A little breath, a new name, a warm embrace. Welcome the newest member of your story.', 'Minik bir nefes, yeni bir isim, sıcak bir kucak. Hikâyenizin en yeni üyesine hoş geldin deyin.'),
    c('Doğuş hekayən alboma yazılır. İndi klinikadakı ilk qayğı anları və evə qayıdış başlayacaq.', 'Your birth story joins the album. Next come the first care moments at the clinic and homecoming.', 'Doğum hikâyen albüme yazılıyor. Şimdi klinikteki ilk bakım anları ve eve dönüş başlayacak.')];
  const next = () => {
    if (stage < 4) { dispatch({ type: 'BIRTH_STAGE', stage: stage + 1 }); audio.success(); }
    else { dispatch({ type: 'BIRTH_COMPLETE', quality }); onClose(); }
  };
  return <div className="birth-experience" role="dialog" aria-modal="true" aria-label={t('birthPlan', l)} data-testid="birth-experience" data-stage={stage}>
    <header className="birth-header"><div className="birth-mark"><img src="/assets/mark.svg" alt="" /><div><strong>Mommy Simulator</strong><small>{text(c('DOĞUŞ HEKAYƏSİ', 'BIRTH STORY', 'DOĞUM HİKÂYESİ'), l)}</small></div></div><button className="icon-button" onClick={onClose} aria-label={t('close', l)}><Icon name="close" /></button></header>
    <div className="birth-stage-path">{[0, 1, 2, 3, 4].map(i => <span className={stage >= i ? 'active' : ''} key={i}><i>{i < stage ? <Icon name="check" size={12} /> : i + 1}</i><small>{text([c('Gəliş', 'Arrival', 'Geliş'), c('Hazırlıq', 'Preparation', 'Hazırlık'), c('Görüş', 'Meeting', 'Buluşma'), c('Qucaq', 'Embrace', 'Kucak'), c('Xatirə', 'Memory', 'Anı')][i], l)}</small></span>)}</div>
    <div className="birth-scene-area"><BirthDiorama avatar={state.avatar} stage={stage} cesarean={cesarean} /><div className="birth-scene-badge"><span /><Icon name="doctor" size={15} />Anacan Family Clinic</div>{stage >= 3 && <div className="birth-new-name"><span>{text(c('XOŞ GƏLDİN', 'WELCOME', 'HOŞ GELDİN'), l)}</span><strong>{state.avatar.babyName}</strong><Icon name="heart" size={20} /></div>}</div>
    <section className="birth-story-panel"><span className="eyebrow">{t(cesarean ? 'cesarean' : 'vaginal', l)} · 0{stage + 1}/05</span><h1>{text(titles[stage], l)}</h1><p>{text(descriptions[stage], l)}</p><div className="birth-plan-summary"><span><Icon name="users" size={13} />{text(state.pregnancy.supportPerson === 'family' ? c('Ailə dəstəyi', 'Family support', 'Aile desteği') : c('Həyat yoldaşım', 'My partner', 'Eşim'), l)}</span><span><Icon name={state.pregnancy.comfort === 'music' ? 'music' : 'sun'} size={13} />{text(state.pregnancy.comfort === 'music' ? c('Sakit musiqi', 'Quiet music', 'Sakin müzik') : c('Yumşaq işıq', 'Soft light', 'Yumuşak ışık'), l)}</span></div>
      {stage === 0 && <div className="birth-team-checks">{[c('Planım komanda ilə paylaşıldı', 'My plan is shared with the team', 'Planım ekiple paylaşıldı'), c('Dəstəyim yanımdadır', 'My support is beside me', 'Desteğim yanımda'), c('Rahatlıq seçimim hazırdır', 'My comfort choice is ready', 'Rahatlık seçimim hazır')].map((title, i) => <button className={checks.includes(i) ? 'checked' : ''} key={i} onClick={() => { const next = checks.includes(i) ? checks : [...checks, i]; setChecks(next); if (next.length === 3) setReady(true); }} data-testid={`birth-check-${i}`}><Icon name={checks.includes(i) ? 'check' : ['clipboard', 'users', 'music'][i]} size={18} />{text(title, l)}</button>)}</div>}
      {stage === 1 && cesarean && <div className="birth-team-checks">{[c('Komanda ilə hazırlıq', 'Preparation with the team', 'Ekiple hazırlık'), c('Dəstəyimlə göz təması', 'Eye contact with my support', 'Desteğimle göz teması'), c('Sakit musiqi anı', 'A quiet music moment', 'Sakin müzik anı')].map((title, i) => <button className={checks.includes(i) ? 'checked' : ''} key={i} onClick={() => { const next = checks.includes(i) ? checks : [...checks, i]; setChecks(next); if (next.length === 3) setReady(true); }} data-testid={`birth-prep-${i}`}><Icon name={checks.includes(i) ? 'check' : ['doctor', 'heart', 'music'][i]} size={18} />{text(title, l)}</button>)}</div>}
      {stage === 1 && !cesarean && (breathing ? <BreathingGame language={l} onFinish={score => { setQuality(score); setReady(true); setBreathing(false); }} /> : !ready && <button className="button secondary large" onClick={() => setBreathing(true)} data-testid="birth-breathing"><Icon name="wind" />{text(c('Nəfəs səhnəsini başlat', 'Begin the breathing scene', 'Nefes sahnesini başlat'), l)}</button>)}
      {stage === 2 && <div className="birth-pulse-scene"><button className={`birth-heart-button ${pulseOpen ? 'pulse-open' : ''}`} aria-label={text(c('Doğuş ritmi', 'Birth rhythm', 'Doğum ritmi'), l)} onClick={() => { const cycle = Math.floor(pulse / 1.8); if (!pulseOpen || cycle === lastPulse.current || taps >= 5) return; lastPulse.current = cycle; const next = taps + 1; setTaps(next); audio.sparkle(); if (next >= 5) setReady(true); }} data-testid="birth-heart" data-open={pulseOpen}><Icon name="heart" size={33} /></button><div className="birth-pulse-dots">{[0, 1, 2, 3, 4].map(i => <i key={i} className={i < taps ? 'active' : ''} />)}</div><small className="scene-whisper">{text(pulseOpen ? c('İşıq gəldi — ürəyə toxun', 'The light is here — tap the heart', 'Işık geldi — kalbe dokun') : c('Növbəti işıq dalğasını gözlə', 'Wait for the next wave of light', 'Sonraki ışık dalgasını bekle'), l)}</small></div>}
      {stage === 3 && <div className="first-embrace-note"><Icon name="baby" size={25} /><span>{text(c('İlk qucaq · ailə bağınız başlayır', 'First embrace · your family bond begins', 'İlk kucak · aile bağınız başlıyor'), l)}</span></div>}
      {stage === 4 && <div className="birth-certificate"><span><Icon name="footprints" size={31} /></span><div><small>{text(c('AILƏ ALBOMU', 'FAMILY ALBUM', 'AİLE ALBÜMÜ'), l)}</small><strong>{state.avatar.babyName}</strong><p>{state.avatar.name} · {t('day', l)} {state.day}</p></div><Icon name="heart" size={19} /></div>}
      <button className="button primary large birth-next" onClick={next} disabled={stage < 4 && !ready} data-testid="birth-next">{stage === 4 ? text(c('İlk qayğı günlərinə keç', 'Begin the first care days', 'İlk bakım günlerine geç'), l) : t('continue', l)}<Icon name="arrow" /></button><small className="birth-narrative-note">{t('narrativeNote', l)}</small>
    </section>
  </div>;
}
