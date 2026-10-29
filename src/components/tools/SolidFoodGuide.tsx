import { useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Crown, Lock } from 'lucide-react';
import { ToolPage, ToolHeader } from './anacan/ToolKit';
import { useChildren } from '@/hooks/useChildren';
import { useSubscription } from '@/hooks/useSubscription';
import { PremiumModal } from '@/components/PremiumModal';
import {
  ALLERGENS, ALLERGEN_STEPS, AVOID, CHOKING, DISCLAIMER, DISHES, EMERGENCY, FOODS, FOOD_GROUPS, IRON_BLOCKS, IRON_HELPS,
  MYTHS, NUTRIENTS, NUTRIENT_AGES, PLATE, READINESS, RECIPES, RECIPE_NOTE, SAMPLE_DAY, STAGES, type FoodGroup, type GuideTag,
} from '@/data/solidFoodGuide';
import '@/styles/solid-food-guide.css';

const TAG_LABEL: Record<GuideTag, string> = { iron: '★ Dəmir', ca: 'Ca', omega: 'Ω-3', c: 'C', allergen: 'Allergen' };
const Tags = ({ tags }: { tags: GuideTag[] }) => tags.length ? (
  <span className="sfg-tags">{tags.map((t) => <span key={t} className={`sfg-tag sfg-tag-${t}`}>{TAG_LABEL[t]}</span>)}</span>
) : null;

type Tab = 'stage' | 'balance' | 'rules' | 'foods' | 'recipes';
const TABS: [Tab, string][] = [['stage', 'Mərhələ'], ['balance', 'Balans'], ['rules', 'Qaydalar'], ['foods', 'Ərzaqlar'], ['recipes', 'Reseptlər']];

const stageFor = (months: number | null) =>
  STAGES.find((s) => months != null && months >= s.fromMonths && months < s.toMonths) ?? STAGES[1];

export default function SolidFoodGuide({ onBack }: { onBack: () => void }) {
  const { selectedChild, getChildAge } = useChildren();
  const months = selectedChild ? getChildAge(selectedChild).months : null;
  const { isPremium } = useSubscription();
  const [tab, setTab] = useState<Tab>('stage');
  const [stageId, setStageId] = useState(() => stageFor(months).id);
  const [ready, setReady] = useState<string[]>([]);
  const [group, setGroup] = useState<FoodGroup | 'all'>('all');
  const [openRecipe, setOpenRecipe] = useState<string | null>(null);
  const [paywall, setPaywall] = useState(false);
  const stage = STAGES.find((s) => s.id === stageId) ?? STAGES[1];
  const foods = useMemo(() => FOODS.filter((food) => group === 'all' || food.group === group), [group]);
  const dishes = DISHES[stage.id] ?? DISHES['6-8'];
  const ageText = months == null ? undefined : months < 24 ? `${selectedChild?.name ?? ''} · ${months} ay` : `${selectedChild?.name ?? ''} · ${Math.floor(months / 12)} yaş`;

  return (
    <ToolPage>
      <ToolHeader title="Əlavə Qida Bələdçisi" eyebrow={ageText} onBack={onBack} />

      <div className="a3-chips hide-scrollbar sfg-tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`a3-chip-btn${tab === id ? ' on' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'stage' && <div className="sfg-stack">
        <div className="a3-chips hide-scrollbar" role="radiogroup" aria-label="Yaş">
          {STAGES.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={s.id === stageId} className={`a3-chip-btn sfg-small${s.id === stageId ? ' on' : ''}`} onClick={() => setStageId(s.id)}>{s.label}</button>
          ))}
        </div>
        <section className="a-card sfg-stage">
          <p className="a3-eyebrow">{stage.label}</p>
          <p className="sfg-goal">{stage.goal}</p>
          <dl className="sfg-facts">
            {[['Süd', stage.milk], ['Öğün', stage.meals], ['Porsiya', stage.portion], ['Tekstura', stage.texture]].map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
          <p className="a3-meta">Porsiyalar orientirdir — nə qədər yeyəcəyinə körpə özü qərar verir.</p>
        </section>

        {stage.id === '0-6' && <section className="a-card">
          <h3 className="sfg-h">Hazırlıq əlamətləri</h3>
          {READINESS.map((r) => {
            const on = ready.includes(r);
            return <button key={r} type="button" className="sfg-check" aria-pressed={on} onClick={() => setReady((v) => on ? v.filter((x) => x !== r) : [...v, r])}>
              <span className={`sfg-box${on ? ' on' : ''}`}>{on && <Check size={13} />}</span>{r}
            </button>;
          })}
          <p className="a3-meta sfg-gap">{ready.length === READINESS.length ? 'Hamısı var — 6 ayda başlamağa hazırdır.' : 'ÜST əlavə qidaya 6 ayda (180 gün) başlamağı tövsiyə edir. Tərəddüd varsa, pediatrla danışın.'}</p>
        </section>}

        {stage.id === '6-8' && <section className="a-card">
          <h3 className="sfg-h">Nümunə gün (8 ay)</h3>
          <ul className="sfg-timeline">{SAMPLE_DAY.map(([time, what]) => <li key={time}><b>{time}</b><span>{what}</span></li>)}</ul>
        </section>}

        {stage.id !== '0-6' && <section className="a-card">
          <h3 className="sfg-h">Bu yaş üçün yemək ideyaları</h3>
          <ul className="sfg-list">{dishes.map((dish) => <li key={dish.name}><span>{dish.name}</span><Tags tags={dish.tags} /></li>)}</ul>
          <button type="button" className="a3-link sfg-gap" onClick={() => setTab('recipes')}>Reseptlərə bax</button>
        </section>}
      </div>}

      {tab === 'balance' && <div className="sfg-stack">
        <section className="a-card">
          <h3 className="sfg-h">Balanslı boşqab (1 yaşdan)</h3>
          <div className="sfg-plate" aria-hidden="true">{PLATE.map((p) => <span key={p.label} style={{ flex: p.share, background: p.color }} />)}</div>
          <ul className="sfg-legend">{PLATE.map((p) => <li key={p.label}><i style={{ background: p.color }} /><b>{p.label}</b> {p.hint}</li>)}</ul>
          <p className="a3-meta sfg-gap">Yanında süd məhsulu və bir az sağlam yağ (zeytun yağı, kərə yağı, avokado).</p>
        </section>
        <section className="a-card">
          <h3 className="sfg-h">Gündəlik ehtiyac</h3>
          <div className="sfg-table" role="table">
            <div role="row" className="sfg-tr sfg-th"><span role="columnheader" />{NUTRIENT_AGES.map((a) => <span role="columnheader" key={a}>{a}</span>)}</div>
            {NUTRIENTS.filter((n) => n.need[0] !== '—').map((n) => (
              <div role="row" key={n.name} className="sfg-tr"><span role="rowheader"><b>{n.name}</b></span>{n.need.map((v, i) => <span role="cell" key={i}>{v}</span>)}</div>
            ))}
          </div>
          <p className="a3-meta sfg-gap">6–11 ayda dəmir ehtiyacı bədən çəkisinə görə ömür boyu ən yüksəkdir — hər öğündə bir dəmir mənbəyi olsun.</p>
        </section>
        <section className="a-card">
          <h3 className="sfg-h">Harada tapılır</h3>
          {NUTRIENTS.map((n) => <div key={n.name} className="sfg-row"><p><b>{n.name}</b> <span className="a3-meta">{n.rule}</span></p><p className="a3-meta">{n.sources}</p></div>)}
        </section>
        <section className="a-card sfg-two">
          <div><h3 className="sfg-h sfg-good">Dəmiri artırır</h3><ul className="sfg-dots">{IRON_HELPS.map((x) => <li key={x}>{x}</li>)}</ul></div>
          <div><h3 className="sfg-h sfg-bad">Dəmiri azaldır</h3><ul className="sfg-dots">{IRON_BLOCKS.map((x) => <li key={x}>{x}</li>)}</ul></div>
        </section>
      </div>}

      {tab === 'rules' && <div className="sfg-stack">
        <section className="sfg-alert"><AlertTriangle size={18} /><p>{EMERGENCY}</p></section>
        <section className="a-card">
          <h3 className="sfg-h">Allergenlər: gecikdirməyin</h3>
          <p className="a3-meta">Yumurta və yer fındığı 6 aydan, bir-bir verilir. Ağır ekzema və ya yumurta allergiyası varsa, əvvəl həkimlə danışın.</p>
          <ol className="sfg-steps">{ALLERGEN_STEPS.map((s) => <li key={s}>{s}</li>)}</ol>
          <div className="sfg-chips">{ALLERGENS.map((a) => <span key={a} className="sfg-tag sfg-tag-allergen">{a}</span>)}</div>
        </section>
        <section className="a-card">
          <h3 className="sfg-h">Verməyin</h3>
          {AVOID.map((a) => <div key={a.food} className="sfg-row sfg-row-split"><div><b>{a.food}</b><p className="a3-meta">{a.why}</p></div><span className="sfg-until">{a.until}</span></div>)}
        </section>
        <section className="a-card">
          <h3 className="sfg-h">Boğulmanın qarşısını alın (4 yaşa qədər)</h3>
          <ul className="sfg-dots">{CHOKING.map((c) => <li key={c}>{c}</li>)}</ul>
          <p className="a3-meta sfg-gap">Öğürmə normaldır; boğulma səssizdir və öskürə bilmir — bu təcili haldır.</p>
        </section>
        <section className="a-card">
          <h3 className="sfg-h">Köhnəlmiş miflər</h3>
          {MYTHS.map((m) => <div key={m.myth} className="sfg-myth"><p className="sfg-myth-q">“{m.myth}”</p><p className="a3-meta">{m.fact}</p></div>)}
        </section>
      </div>}

      {tab === 'foods' && <div className="sfg-stack">
        <div className="a3-chips hide-scrollbar">
          {(['all', ...FOOD_GROUPS] as const).map((g) => (
            <button key={g} type="button" className={`a3-chip-btn sfg-small${group === g ? ' on' : ''}`} onClick={() => setGroup(g)}>{g === 'all' ? 'Hamısı' : g}</button>
          ))}
        </div>
        <section className="a-list-card">
          {foods.map((food) => {
            const later = months != null && months < food.from;
            return <div key={food.name} className="a-list-row sfg-food" style={{ opacity: later ? 0.55 : 1 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p className="a-list-title">{food.name} <Tags tags={food.tags} /></p>
                <p className="a-list-sub">{food.form} · {food.value}</p>
              </div>
              <span className="sfg-until">{food.from} ay+</span>
            </div>;
          })}
        </section>
      </div>}

      {tab === 'recipes' && <div className="sfg-stack">
        {!isPremium && <section className="sfg-premium" onClick={() => setPaywall(true)}>
          <Crown size={18} /><div><b>Reseptlər Premium-dadır</b><p>{RECIPES.length} yaşa uyğun resept — tərkib və addım-addım hazırlanma.</p></div>
        </section>}
        <p className="a3-meta">{RECIPE_NOTE}</p>
        <section className="a-list-card">
          {RECIPES.map((r) => {
            const open = openRecipe === r.id && isPremium;
            return <div key={r.id} className="sfg-recipe">
              <button type="button" className="a-list-row sfg-recipe-head" aria-expanded={open}
                onClick={() => isPremium ? setOpenRecipe(open ? null : r.id) : setPaywall(true)}>
                <div style={{ minWidth: 0, flex: 1, textAlign: 'start' }}>
                  <p className="a-list-title">{r.title}</p>
                  <p className="a-list-sub">{r.from} ay+ <Tags tags={r.tags} /></p>
                </div>
                {isPremium ? <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : undefined }} /> : <span className="sfg-lock"><Lock size={12} />Premium</span>}
              </button>
              {open && <div className="sfg-recipe-body">
                <p><b>Tərkib:</b> {r.ingredients}</p>
                <ol className="sfg-steps">{r.steps.map((s) => <li key={s}>{s}</li>)}</ol>
              </div>}
            </div>;
          })}
        </section>
      </div>}

      <p className="a3-meta sfg-disclaimer">{DISCLAIMER}</p>
      <PremiumModal isOpen={paywall} onClose={() => setPaywall(false)} feature="Əlavə qida reseptləri" />
    </ToolPage>
  );
}
