import { lazy, Suspense, useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronRight, Crown, Lock } from 'lucide-react';
import { ToolPage, ToolHeader } from './anacan/ToolKit';
import { useChildren } from '@/hooks/useChildren';
import { useSubscription } from '@/hooks/useSubscription';
import { useRecipes } from '@/hooks/useDynamicContent';
import {
  ALLERGENS, ALLERGEN_STEPS, AVOID, CHOKING, DISCLAIMER, DISHES, EMERGENCY, FOODS, FOOD_GROUPS, IRON_BLOCKS, IRON_HELPS,
  MYTHS, NUTRIENTS, NUTRIENT_AGES, PLATE, READINESS, SAMPLE_DAY, STAGES, type FoodGroup, type GuideTag,
} from '@/data/solidFoodGuide';
import '@/styles/solid-food-guide.css';

const Recipes = lazy(() => import('./Recipes'));
/** The app's Recipes tool keeps baby recipes in this category (Duzelis67). */
export const BABY_RECIPE_CATEGORY = 'baby_food';
/** Minimum age in months from titles such as "Armud püresi (6 ay+)" or "Naqets (1 yaş+)". */
export const recipeMinMonths = (title: string): number | null => {
  const match = title.match(/(\d+)\s*(ay|yaş)\s*\+/i);
  return match ? Number(match[1]) * (match[2].toLowerCase() === 'yaş' ? 12 : 1) : null;
};

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
  const [recipesView, setRecipesView] = useState<{ recipeId?: string } | null>(null);
  const { data: allRecipes = [] } = useRecipes();
  // Same order and free tier as the Recipes tool: the first three of the category are free.
  const babyRecipes = useMemo(() => allRecipes.filter((r) => r.category === BABY_RECIPE_CATEGORY)
    .map((r, index) => ({ recipe: r, minMonths: recipeMinMonths(r.title), free: index < 3 })), [allRecipes]);
  const suggested = useMemo(() => babyRecipes
    .filter((r) => months == null || r.minMonths == null || r.minMonths <= Math.max(months, 6))
    .sort((a, b) => (b.minMonths ?? 0) - (a.minMonths ?? 0)).slice(0, 8), [babyRecipes, months]);
  const stage = STAGES.find((s) => s.id === stageId) ?? STAGES[1];
  const foods = useMemo(() => FOODS.filter((food) => group === 'all' || food.group === group), [group]);
  const dishes = DISHES[stage.id] ?? DISHES['6-8'];
  const ageText = months == null ? undefined : months < 24 ? `${selectedChild?.name ?? ''} · ${months} ay` : `${selectedChild?.name ?? ''} · ${Math.floor(months / 12)} yaş`;

  if (recipesView) {
    return <Suspense fallback={null}>
      <Recipes onBack={() => setRecipesView(null)} initialCategory={BABY_RECIPE_CATEGORY} initialRecipeId={recipesView.recipeId} />
    </Suspense>;
  }

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
        <p className="a3-meta">Anacan Reseptlər bölməsindən körpənizin yaşına uyğun seçimlər. İlk reseptlər pulsuzdur, qalanları Premium-dadır.</p>
        <section className="a-list-card">
          {suggested.map(({ recipe, minMonths, free }) => (
            <button key={recipe.id} type="button" className="a-list-row sfg-recipe-head" onClick={() => setRecipesView({ recipeId: recipe.id })}>
              {recipe.image_url ? <img src={recipe.image_url} alt="" className="sfg-recipe-img" loading="lazy" /> : <span className="a-list-icon" style={{ background: 'var(--a-grad-peach)', fontSize: 18 }}>🥣</span>}
              <div style={{ minWidth: 0, flex: 1, textAlign: 'start' }}>
                <p className="a-list-title">{recipe.title.replace(/\s*\(\s*\d+\s*(ay|yaş)\s*\+?\s*\)\s*$/i, '')}</p>
                {minMonths != null && <p className="a-list-sub">{minMonths < 12 ? `${minMonths} ay+` : `${minMonths / 12} yaş+`}</p>}
              </div>
              {!isPremium && !free ? <span className="sfg-lock"><Lock size={12} />Premium</span> : <ChevronRight size={16} className="rtl:rotate-180" style={{ color: 'var(--a-ink-faint)' }} />}
            </button>
          ))}
          {!suggested.length && <p className="a3-meta" style={{ padding: 16 }}>Reseptlər yüklənir…</p>}
        </section>
        <button type="button" className="sfg-premium" onClick={() => setRecipesView({})}>
          <Crown size={18} /><div><b>Bütün körpə reseptləri</b><p>{babyRecipes.length} resept · Reseptlər bölməsində açılır</p></div>
          <ChevronRight size={16} className="rtl:rotate-180" style={{ marginInlineStart: 'auto' }} />
        </button>
      </div>}

      <p className="a3-meta sfg-disclaimer">{DISCLAIMER}</p>
    </ToolPage>
  );
}
