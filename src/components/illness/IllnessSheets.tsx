import { useEffect, useState } from 'react';
import { Phone } from 'lucide-react';
import { Sheet } from '@/components/anacan/Sheet';
import { Switch } from '@/components/ui/switch';
import { fill } from '@/lib/feature-text';
import { hapticFeedback } from '@/lib/native';
import { BAND_COLOR, SYMPTOMS, TEMP_MAX_C, TEMP_METHODS, TEMP_MIN_C, cToF, earlyDose, fToC, fromUnit, localizeTempText, tempBand, toUnit, type IllnessEntry, type NewIllnessEntry, type TempMethod, type TempUnit } from '@/lib/illness';
import { tr } from '@/lib/tr';
import { useTempUnit } from './useTempUnit';
import type { IllnessText } from '@/data/illness';

const SYMPTOM_EMOJI: Record<string, string> = {
  cough: '😮‍💨', runny_nose: '🤧', vomit: '🤮', diarrhea: '🚽', poor_feeding: '🍼', fewer_diapers: '🧷',
  rash: '🔴', sleepy: '😴', irritable: '😣', breathing: '🫁', ear_pull: '👂'
};

/** <input type="datetime-local"> value for a Date, in local time. */
const localInput = (d: Date) => {
  const off = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return off.toISOString().slice(0, 16);
};
const fromLocalInput = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

function WhenField({ t, value, onChange }: { t: IllnessText; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <span className="cx-field">{t.time}</span>
      <div className="cx-row" style={{ gap: 8 }}>
        <input className="cx-input" type="datetime-local" value={value} max={localInput(new Date(Date.now() + 5 * 60000))} onChange={(e) => onChange(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
        <button type="button" className="cx-chip" onClick={() => onChange(localInput(new Date()))}>{t.now}</button>
      </div>
    </div>);
}

function SaveBar({ label, busy, onClick, disabled }: { label: string; busy: boolean; onClick: () => void; disabled?: boolean }) {
  return <button type="button" className="a3-btn accent cx-wide" disabled={busy || disabled} onClick={onClick}>{label}</button>;
}

/** °C / °F switch; the choice is remembered on this device. */
export function TempUnitToggle({ unit, onChange }: { unit: TempUnit; onChange: (u: TempUnit) => void }) {
  return (
    <div className="cx-seg" role="group" aria-label={tr('p3b_temp_unit', 'Temperatur vahidi')} style={{ display: 'inline-flex', minWidth: 120, alignSelf: 'center', marginBottom: 6 }}>
      {(['C', 'F'] as TempUnit[]).map((u) => <button key={u} type="button" aria-pressed={unit === u} onClick={() => onChange(u)}>°{u}</button>)}
    </div>);
}

const SCALE_C = [35, 37, 38, 39, 40, 42];

export function TempSheet({ t, open, onClose, onSave, locale }: { t: IllnessText; open: boolean; onClose: () => void; onSave: (e: NewIllnessEntry & { kind: 'temp' }) => Promise<void>; locale: string }) {
  const [unit, setUnit] = useTempUnit();
  // The dial works in the chosen unit; the reading is saved in °C (rounded to 0.1 like the database column).
  const [value, setValue] = useState(() => toUnit(37.5, unit));
  const [method, setMethod] = useState<TempMethod>('armpit');
  const [when, setWhen] = useState(localInput(new Date()));
  const [busy, setBusy] = useState(false);
  useEffect(() => {if (open) setWhen(localInput(new Date()));}, [open]);
  const min = toUnit(TEMP_MIN_C, unit), max = toUnit(TEMP_MAX_C, unit);
  const clamp = (v: number) => Math.round(Math.min(max, Math.max(min, v)) * 10) / 10;
  const set = (v: number) => {setValue(clamp(v));void hapticFeedback.light();};
  // Switching the unit (here or on another screen) converts the value on the dial.
  const [valueUnit, setValueUnit] = useState(unit);
  useEffect(() => {
    if (valueUnit === unit) return;
    setValue((v) => Math.round((unit === 'F' ? cToF(v) : fToC(v)) * 10) / 10);
    setValueUnit(unit);
  }, [unit, valueUnit]);
  const celsius = unit === 'F' ? fToC(value) : value;
  const band = tempBand(celsius);
  const save = async () => {
    setBusy(true);
    try {await onSave({ kind: 'temp', at: fromLocalInput(when).toISOString(), temp_c: fromUnit(value, unit), temp_method: method });onClose();} catch {/* toast upstream */} finally {setBusy(false);}
  };
  return (
    <Sheet open={open} onClose={onClose} full={false} title={t.temp_title} footer={<SaveBar label={t.save} busy={busy} onClick={() => void save()} />}>
      <div className="cx-stack">
        <div className="cx-dial">
          <TempUnitToggle unit={unit} onChange={setUnit} />
          <div className="cx-dial-value">
            <button type="button" className="cx-step" aria-label="-0.1" onClick={() => set(value - 0.1)}>−</button>
            <strong style={{ color: BAND_COLOR[band] }}>{value.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}°</strong>
            <button type="button" className="cx-step" aria-label="+0.1" onClick={() => set(value + 0.1)}>+</button>
          </div>
          <span className="cx-pill" style={{ marginTop: 6, background: `${BAND_COLOR[band]}1f`, color: BAND_COLOR[band] }}>{t.bands[band]}</span>
          <input className="cx-range" type="range" min={min} max={max} step={0.1} value={value} aria-label={t.temp_title} onChange={(e) => setValue(clamp(Number(e.target.value)))} />
          <div className="cx-scale">{SCALE_C.map((c) => <span key={c}>{unit === 'F' ? Math.round(cToF(c)) : c}°</span>)}</div>
          <p className="cx-sub" style={{ marginTop: 4 }}>{t.temp_hint}</p>
        </div>
        <div className="cx-chips">
          {TEMP_METHODS.map((m) => <button key={m} type="button" className="cx-chip" aria-pressed={m === method} onClick={() => setMethod(m)}>{t.methods[m]}</button>)}
        </div>
        <WhenField t={t} value={when} onChange={setWhen} />
      </div>
    </Sheet>);
}

export function MedSheet({ t, open, onClose, onSave, entries, time }: {
  t: IllnessText; open: boolean; onClose: () => void; entries: IllnessEntry[]; time: (d: Date) => string;
  onSave: (e: NewIllnessEntry & { kind: 'med' }) => Promise<void>;
}) {
  const recent = [...new Set(entries.filter((e) => e.kind === 'med' && e.med_name).map((e) => e.med_name!))];
  const presets = [...new Set([...recent, ...t.med_presets])].slice(0, 7);
  const lastOf = (name: string) => entries.find((e) => e.kind === 'med' && e.med_name?.toLowerCase() === name.toLowerCase());
  const [name, setName] = useState('');
  const [custom, setCustom] = useState(false);
  const [dose, setDose] = useState('');
  const [interval, setIntervalHours] = useState(6);
  const [customInterval, setCustomInterval] = useState(false);
  const [remind, setRemind] = useState(true);
  const [when, setWhen] = useState(localInput(new Date()));
  const [busy, setBusy] = useState(false);
  const [confirmEarly, setConfirmEarly] = useState(false);
  useEffect(() => {if (open) {setWhen(localInput(new Date()));setConfirmEarly(false);}}, [open]);

  const pick = (preset: string) => {
    setName(preset);setCustom(false);setConfirmEarly(false);
    const last = lastOf(preset);
    if (last) {setDose(last.dose ?? '');if (last.interval_hours) setIntervalHours(last.interval_hours);}
  };
  const at = fromLocalInput(when);
  const early = name ? earlyDose(entries, name, at) : null;
  const ago = early ? early.minutesAgo < 60 ? fill(t.ago_min, { n: early.minutesAgo }) : fill(t.ago_h, { h: Math.floor(early.minutesAgo / 60), m: early.minutesAgo % 60 }) : '';
  const valid = name.trim().length > 0 && dose.trim().length > 0 && interval >= 1 && interval <= 48;

  const save = async () => {
    if (!valid) return;
    if (early && !confirmEarly) {setConfirmEarly(true);void hapticFeedback.heavy();return;}
    setBusy(true);
    try {
      await onSave({ kind: 'med', at: at.toISOString(), med_name: name.trim(), dose: dose.trim(), interval_hours: interval, remind });
      if (remind) {
        try {
          const { LocalNotifications } = await import('@capacitor/local-notifications');
          const p = await LocalNotifications.checkPermissions();
          if (p.display === 'prompt' || p.display === 'prompt-with-rationale') await LocalNotifications.requestPermissions();
        } catch {/* web / no plugin */}
      }
      setName('');setDose('');onClose();
    } catch {/* toast upstream */} finally {setBusy(false);}
  };

  return (
    <Sheet open={open} onClose={onClose} full={false} title={t.med_title}
    footer={<SaveBar label={early && confirmEarly ? t.save_anyway : t.save} busy={busy} disabled={!valid} onClick={() => void save()} />}>
      <div className="cx-stack">
        <div className="cx-chips">
          {presets.map((p) => <button key={p} type="button" className="cx-chip" aria-pressed={!custom && name === p} onClick={() => pick(p)}>{p}</button>)}
          <button type="button" className="cx-chip" aria-pressed={custom} onClick={() => {setCustom(true);setName('');}}>+ {t.med_other}</button>
        </div>
        {custom && <input className="cx-input" value={name} maxLength={60} placeholder={t.med_name_ph} onChange={(e) => setName(e.target.value)} autoFocus />}
        <label>
          <span className="cx-field">{t.dose_label}</span>
          <input className="cx-input" value={dose} maxLength={40} placeholder={t.dose_ph} onChange={(e) => setDose(e.target.value)} />
        </label>
        <WhenField t={t} value={when} onChange={(v) => {setWhen(v);setConfirmEarly(false);}} />
        <div>
          <span className="cx-field">{t.interval_label}</span>
          <div className="cx-seg">
            {[4, 6, 8, 12].map((h) => <button key={h} type="button" aria-pressed={!customInterval && interval === h} onClick={() => {setCustomInterval(false);setIntervalHours(h);}}>{fill(t.hours, { h })}</button>)}
            <button type="button" aria-pressed={customInterval} onClick={() => setCustomInterval(true)}>{t.med_other}</button>
          </div>
          {customInterval && <input className="cx-input" style={{ marginTop: 8 }} type="number" inputMode="decimal" min={1} max={48} value={interval} onChange={(e) => setIntervalHours(Number(e.target.value) || 0)} />}
        </div>
        <div className="cx-row" style={{ justifyContent: 'space-between' }}>
          <div style={{ minWidth: 0 }}>
            <b style={{ fontSize: 14, color: 'var(--a-ink)' }}>{t.remind_title}</b>
            <p className="cx-sub">{remind ? `${time(new Date(at.getTime() + interval * 3600000))} · ` : ''}{t.remind_desc}</p>
          </div>
          <Switch checked={remind} onCheckedChange={setRemind} aria-label={t.remind_title} className="data-[state=checked]:bg-[var(--a-peach-2)]" />
        </div>
        {early ?
        <div className="cx-alert"><b>⏱️ {t.too_early_title}</b>{fill(t.too_early, { med: early.last.name, ago, h: early.last.intervalHours })}</div> :
        <div className="cx-warn">⚠️ {t.no_dose_calc}</div>}
      </div>
    </Sheet>);
}

export function SymptomSheet({ t, open, onClose, onSave }: { t: IllnessText; open: boolean; onClose: () => void; onSave: (e: NewIllnessEntry & { kind: 'symptom' }) => Promise<void> }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {if (open) {setPicked([]);setNote('');}}, [open]);
  const toggle = (s: string) => {setPicked((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]);void hapticFeedback.light();};
  const save = async () => {
    setBusy(true);
    try {await onSave({ kind: 'symptom', at: new Date().toISOString(), symptoms: picked, note: note.trim() || undefined });onClose();} catch {/* upstream */} finally {setBusy(false);}
  };
  return (
    <Sheet open={open} onClose={onClose} full={false} title={t.symptom_title}
    footer={<SaveBar label={t.save} busy={busy} disabled={!picked.length && !note.trim()} onClick={() => void save()} />}>
      <div className="cx-stack">
        <div className="cx-grid3">
          {SYMPTOMS.map((s) =>
          <button key={s} type="button" className="cx-tile" aria-pressed={picked.includes(s)}
          style={{ background: picked.includes(s) ? s === 'breathing' ? 'var(--a-pink-1)' : 'var(--a-blue-1)' : 'var(--a-surface-soft)', minHeight: 76 }} onClick={() => toggle(s)}>
              <span className="cx-tile-emoji">{SYMPTOM_EMOJI[s]}</span>{(t.symptoms as Record<string, string>)[s]}
            </button>
          )}
        </div>
        <textarea className="cx-input" style={{ minHeight: 70, padding: 12 }} maxLength={280} value={note} placeholder={t.note_ph} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Sheet>);
}

export function FlagsSheet({ t, open, onClose, emergency, locale }: { t: IllnessText; open: boolean; onClose: () => void; emergency: string; locale?: string }) {
  const [unit] = useTempUnit();
  const temp = (line: string) => localizeTempText(line, unit, locale);
  return (
    <Sheet open={open} onClose={onClose} title={t.flags_title}>
      <div className="cx-stack">
        <div className="cx-alert">
          <b>🚨 {fill(t.emergency_title, { number: emergency })}</b>
          <ul style={{ margin: '6px 0 0', paddingInlineStart: 18 }}>{t.emergency.map((line) => <li key={line} style={{ marginTop: 4 }}>{temp(line)}</li>)}</ul>
          <a className="cx-call" href={`tel:${emergency}`}><Phone size={17} />{fill(t.call, { number: emergency })}</a>
        </div>
        <div className="cx-card">
          <b style={{ fontSize: 14.5, color: 'var(--a-ink)' }}>🩺 {t.doctor_title}</b>
          <ul className="cx-sub" style={{ margin: '8px 0 0', paddingInlineStart: 18, fontSize: 13.5 }}>{t.doctor.map((line) => <li key={line} style={{ marginTop: 4 }}>{temp(line)}</li>)}</ul>
        </div>
        <p className="cx-disc">{t.disclaimer}</p>
      </div>
    </Sheet>);
}
