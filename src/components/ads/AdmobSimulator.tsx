import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, FlaskConical, Home, LayoutGrid, Play, RotateCcw, ShieldCheck, Users, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TEST_APP_IDS, type AdMode, type AdPlacementId, type AdPlatform, type AdsConfiguration } from '@/lib/ads/config';
import { emptyAdLedger, evaluateAd, recordAdShown } from '@/lib/ads/policy';
import { localizedAdPlacements, localizedAdPlacement, adReasonLabel } from '@/lib/ads/labels';
import { tr, formatTr } from '@/lib/tr';
import { getLocaleTag } from '@/lib/i18n';
import { reportAdEvent } from '@/lib/ads/api';
import { DemoBanner, DemoFullscreen } from './DemoAd';
import { advanceAdCadence, consumeAdCadence, type AdCadence } from '@/lib/ads/cadence';

export function AdmobSimulator({ configuration, selected, onSelect }: { configuration: AdsConfiguration; selected: AdPlacementId; onSelect: (id: AdPlacementId) => void }) {
  const [platform, setPlatform] = useState<AdPlatform>('ios');
  const [mode, setMode] = useState<AdMode>('demo');
  const [premium, setPremium] = useState(false), [consent, setConsent] = useState(true), [blocked, setBlocked] = useState(false);
  const [online, setOnline] = useState(true), [ready, setReady] = useState(true);
  const [sessionAge, setSessionAge] = useState(120), [screenAge, setScreenAge] = useState(45);
  const [ledger, setLedger] = useState(() => emptyAdLedger(Date.now(), 'simulator'));
  const [full, setFull] = useState(false), [message, setMessage] = useState('');
  const [attempts, setAttempts] = useState<{ label: string; ok: boolean; at: string }[]>([]);
  const [cadence, setCadence] = useState<AdCadence>({ count: 0, seen: [] });
  const [gameLives, setGameLives] = useState(0);
  const definition = localizedAdPlacement(selected), now = Date.now();
  const placement = configuration.placements.find(item => item.id === selected)!;
  const evaluated = useMemo(() => evaluateAd({ ...configuration, settings: { ...configuration.settings, mode } }, selected, {
    now, sessionStartedAt: now - sessionAge * 1000, screenStartedAt: now - screenAge * 1000,
    platform, signedIn: true, entitlementReady: true, premium, foreground: true, online, blocked,
    native: true, sdkAvailable: true, nativeVersion: '31.0',
    compiledAppId: mode === 'live' ? configuration.settings[`${platform}_app_id`] : TEST_APP_IDS[platform],
    consent, demo: mode === 'demo',
  }, ledger), [configuration, selected, mode, now, sessionAge, screenAge, platform, premium, online, blocked, consent, ledger]);
  const decision = evaluated.allowed && !ready && definition.format !== 'banner'
    ? { ...evaluated, allowed: false, reason: 'not_ready' as const } : evaluated;
  const attempt = () => {
    const label = adReasonLabel(decision.reason);
    setAttempts(items => [{ label, ok: decision.allowed, at: new Date().toLocaleTimeString(getLocaleTag()) }, ...items].slice(0, 8));
    if (!decision.allowed) { setMessage(label); void reportAdEvent(selected, 'skipped', 'demo', 'web', decision.reason); return; }
    setLedger(value => recordAdShown(value, selected, Date.now()));
    setCadence(value => consumeAdCadence(value));
    void reportAdEvent(selected, 'shown', 'demo', 'web');
    void reportAdEvent(selected, 'impression', 'demo', 'web');
    if (definition.format === 'banner') setMessage(tr('ads_demo_banner_shown', 'Demo banner göstərildi. Növbəti cəhd üçün limit hesablandı.'));
    else setFull(true);
  };
  const row = (id: string, title: string, value: boolean, change: (value: boolean) => void) =>
    <div className="flex items-center justify-between gap-3"><Label htmlFor={id} className="text-xs">{title}</Label><Switch id={id} checked={value} onCheckedChange={change} /></div>;
  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,1fr)]" data-testid="admob-simulator">
    <div className="space-y-4">
      <Card><CardContent className="space-y-4 pt-5">
        <div className="flex items-center gap-2 font-semibold"><FlaskConical size={18} /> Qayda laboratoriyası</div>
        <p className="text-xs text-muted-foreground">Bu ssenarilər yalnız demodur. Mövcud hesabın Premium statusu və Google reklam trafiki dəyişmir.</p>
        <div className="space-y-1"><Label>Placement</Label><Select value={selected} onValueChange={value => { onSelect(value as AdPlacementId); setMessage(''); setCadence({ count: 0, seen: [] }); }}>
          <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{localizedAdPlacements().map(item => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}</SelectContent>
        </Select></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Platforma</Label><Select value={platform} onValueChange={value => setPlatform(value as AdPlatform)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ios">iOS</SelectItem><SelectItem value="android">Android</SelectItem></SelectContent></Select></div>
          <div className="space-y-1"><Label>Yoxlanan rejim</Label><Select value={mode} onValueChange={value => setMode(value as AdMode)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="demo">Demo qaydaları</SelectItem><SelectItem value="test">Native test qaydaları</SelectItem><SelectItem value="live">Canlı ID qaydaları</SelectItem></SelectContent></Select></div>
        </div>
        {row('sim-premium', tr('ads_sim_premium', 'Premium / ailə Premium-u'), premium, setPremium)}
        {row('sim-online', tr('ads_sim_online', 'Şəbəkə mövcuddur'), online, setOnline)}
        {row('sim-consent', tr('ads_sim_consent', 'UMP reklam sorğusuna icazə verir'), consent, setConsent)}
        {row('sim-blocked', tr('ads_sim_blocked', 'Modal və ya klaviatura açıqdır'), blocked, setBlocked)}
        {row('sim-ready', tr('ads_sim_ready', 'Tam ekran reklamı əvvəlcədən hazırdır'), ready, setReady)}
        {placement.every_n > 0 && <div className="space-y-2 rounded-xl border p-3"><p className="text-xs">Keçid sayğacı: <strong>{cadence.count} / {placement.every_n}</strong></p><Button variant="outline" className="w-full" onClick={() => {
          const value = advanceAdCadence(cadence, crypto.randomUUID(), placement.every_n); setCadence(value.state);
          if (value.due) attempt(); else setMessage(formatTr('ads_sim_remaining', '{count} tamamlandı; reklam üçün {remaining} qalıb.', { count: value.state.count, remaining: placement.every_n - value.state.count }));
        }}>{definition.format === 'native_story' ? 'Bir story tamamlandı' : 'Bir oyun tamamlandı'}</Button></div>}
        {selected === 'game_revive_rewarded' && <div className="rounded-xl border p-3 text-xs">Demo oyun canı: <strong>{gameLives}</strong> · tamamlandıqda +{placement.revive_lives} can / +{placement.revive_moves} gediş.</div>}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label htmlFor="sim-session-age">Sessiya yaşı (san.)</Label><Input id="sim-session-age" type="number" min={0} value={sessionAge} onChange={e => setSessionAge(Math.max(0, Number(e.target.value)))} /></div>
          <div className="space-y-1"><Label htmlFor="sim-screen-age">Ekranda vaxt (san.)</Label><Input id="sim-screen-age" type="number" min={0} value={screenAge} onChange={e => setScreenAge(Math.max(0, Number(e.target.value)))} /></div>
        </div>
        <div className={`rounded-xl border p-3 text-sm ${decision.allowed ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`} data-testid="admob-simulation-decision">
          <div className="flex items-center gap-2 font-semibold">{decision.allowed ? <CheckCircle2 size={17} /> : <ShieldCheck size={17} />}{adReasonLabel(decision.reason)}</div>
          {decision.waitSeconds > 0 && <p className="mt-1 text-xs">Təxminən {decision.waitSeconds} saniyə gözləmə.</p>}
        </div>
        <div className="flex gap-2"><Button onClick={attempt} className="flex-1"><Play size={15} className="me-2" />Göstərilməni sına</Button><Button variant="outline" aria-label="Simulator limitlərini sıfırla" onClick={() => { setLedger(emptyAdLedger(Date.now(), 'simulator')); setCadence({ count: 0, seen: [] }); setGameLives(0); setMessage(tr('ads_sim_reset', 'Limitlər sıfırlandı.')); }}><RotateCcw size={16} /></Button></div>
        {message && <p className="text-xs text-muted-foreground" role="status">{message}</p>}
      </CardContent></Card>
      {attempts.length > 0 && <Card><CardContent className="space-y-2 pt-4"><h4 className="text-xs font-semibold">Son sınaqlar</h4>{attempts.map((item, index) => <div key={index} className="flex items-center gap-2 text-xs">{item.ok ? <CheckCircle2 size={13} className="text-emerald-500" /> : <XCircle size={13} className="text-amber-500" />}<span className="flex-1">{item.label}</span><span className="text-muted-foreground">{item.at}</span></div>)}</CardContent></Card>}
    </div>
    <div className="space-y-4">
      <div className="admob-phone">
        <div className="px-5 pt-12"><div className="mb-5 flex items-center justify-between"><ArrowLeft size={17} /><span className="text-[11px] font-semibold">Anacan · {platform}</span><span className="text-xs">•••</span></div>
          <span className="text-[9px] font-bold uppercase tracking-widest text-orange-500">{definition.surface.replace(/_/g, ' ')}</span>
          <h3 className="mt-2 text-xl font-bold">{definition.format === 'rewarded' ? 'Reklam seçimləri' : definition.title.split(' · ')[0]}</h3>
          <div className="mt-5 rounded-2xl bg-gradient-to-br from-orange-100 to-pink-100 p-5"><div className="mb-3 h-4 w-4/5 rounded bg-white/75" /><div className="h-3 w-full rounded bg-white/60" /><div className="mt-2 h-3 w-2/3 rounded bg-white/60" /></div>
          {[1, 2, 3].map(value => <div key={value} className="mt-3 flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm"><div className="h-10 w-10 rounded-lg bg-violet-50" /><div className="flex-1 space-y-2"><div className="h-2 w-4/5 rounded bg-stone-100" /><div className="h-2 w-1/2 rounded bg-stone-100" /></div></div>)}
        </div>
        <div className={`absolute inset-x-2 ${definition.format === 'banner' && placement.position === 'top' ? 'top-[95px]' : definition.format === 'banner' && placement.position === 'middle' ? 'top-[300px]' : 'bottom-[76px]'}`}>
          {definition.format === 'banner' ? decision.allowed ? <div className="h-[74px]"><DemoBanner placementId={selected} onClick={attempt} /></div> :
            <div className="flex min-h-[74px] items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 bg-white/80 p-3 text-center text-[10px]"><ShieldCheck size={17} />{adReasonLabel(decision.reason)}</div> :
            <button onClick={attempt} className="w-full rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50 p-4 text-xs font-semibold text-violet-800">{definition.format === 'rewarded' ? `Reklama bax → ${configuration.settings.reward_pause_minutes} dəq. fasilə` : 'Geri → təbii keçiddə tam ekran reklam'}</button>}
        </div>
        <div className="absolute inset-x-4 bottom-4 flex h-12 items-center justify-around rounded-full bg-white shadow-md"><Home size={17} /><LayoutGrid size={17} /><Users size={17} /><span className="h-7 w-7 rounded-full bg-orange-100" /></div>
      </div>
      <div className="mx-auto max-w-sm rounded-xl bg-muted/50 p-4 text-xs"><p className="font-semibold">{definition.trigger}</p><p className="mt-2 text-muted-foreground">{definition.description}</p><code className="mt-2 block text-[10px]">{selected}</code></div>
    </div>
    {full && <DemoFullscreen placementId={selected} rewardMinutes={configuration.settings.reward_pause_minutes} storyFormat={placement.story_format} onFinish={earned => {
      setFull(false); void reportAdEvent(selected, 'dismissed', 'demo', 'web');
      if (earned) { if (selected === 'game_revive_rewarded') setGameLives(value => value + placement.revive_lives);
        else setLedger(value => ({ ...value, pause_until: Date.now() + configuration.settings.reward_pause_minutes * 60_000 }));
        void reportAdEvent(selected, 'reward_earned', 'demo', 'web'); setMessage(selected === 'game_revive_rewarded' ? tr('ads_demo_revived', 'Demo can / gediş bərpa edildi.') : tr('ads_demo_pause_active', 'Demo tamamlandı: simulator üçün reklamsız fasilə aktivdir.')); }
      else setMessage(tr('ads_demo_no_reward', 'Demo bağlandı. Mükafat verilmədi.'));
    }} />}
  </div>;
}
