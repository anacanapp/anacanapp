import { lazy, Suspense, useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronRight, Crown, Lock } from 'lucide-react';
import { useChildren } from '@/hooks/useChildren';
import { useUserStore } from '@/store/userStore';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ToolPage, ToolHeader, ToolLoading } from './anacan/ToolKit';
import { useSubscription } from '@/hooks/useSubscription';
import { useRecipes } from '@/hooks/useDynamicContent';
import { DISH_TAGS, FOODS, FOOD_GROUPS, NUTRIENT_TAGS, PLATE, STAGES, type FoodGroupId, type GuideTag } from '@/data/solidFoodGuide';
import { fill, useSolidFoodGuideText, type SolidFoodGuideText } from '@/data/solid-food-guide';
import '@/styles/solid-food-guide.css';

const Recipes = lazy(() => import('./Recipes'));
/** The app's Recipes tool keeps baby recipes in this category (Duzelis67). */
export const BABY_RECIPE_CATEGORY = 'baby_food';
/** Minimum age in months from the Azerbaijani source title, e.g. "Armud püresi (6 ay+)" or "Naqets (1 yaş+)". */
export const recipeMinMonths = (title: string): number | null => {
  const match = title.match(/(\d+)\s*(ay|yaş)\s*\+/i);
  return match ? Number(match[1]) * (match[2].toLowerCase() === 'yaş' ? 12 : 1) : null;
};

/** Recipe titles end with the age in the user's language, e.g. "(6 ay+)" / "(6 months+)"; the guide shows it separately. */
const stripAge = (title: string) => title.replace(/\s*\([^()]*\d[^()]*\)\s*$/, '');

const Tags = ({ tags, t }: { tags: GuideTag[]; t: SolidFoodGuideText }) => tags.length ? (
  <span className="sfg-tags">{tags.map((tag) => <span key={tag} className={`sfg-tag sfg-tag-${tag}`}>{t.ui[`tag_${tag}`]}</span>)}</span>
) : null;

type Tab = 'stage' | 'balance' | 'rules' | 'foods' | 'recipes';
const TABS: Tab[] = ['stage', 'balance', 'rules', 'foods', 'recipes'];

const stageFor = (months: number | null) =>
  STAGES.find((s) => months != null && months >= s.fromMonths && months < s.toMonths) ?? STAGES[1];

export default function SolidFoodGuide({ onBack }: { onBack: () => void }) {
  const { selectedChild, getChildAge } = useChildren();
  const months = selectedChild ? getChildAge(selectedChild).months : null;
  const { isPremium } = useSubscription();
  const language = useUserStore((s) => s.language);
  const t = useSolidFoodGuideText(language);
  // Ages come from the Azerbaijani source titles (localized titles use other words for months).
  const { data: sourceTitles = {} } = useQuery({
    queryKey: ['baby-recipe-source-titles'], staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('admin_recipes').select('id, title').eq('category', BABY_RECIPE_CATEGORY).eq('is_active', true);
      return Object.fromEntries((data ?? []).map((row) => [row.id, row.title as string])) as Record<string, string>;
    },
  });
  const [tab, setTab] = useState<Tab>('stage');
  const [stageId, setStageId] = useState(() => stageFor(months).id);
  const [ready, setReady] = useState<number[]>([]);
  const [group, setGroup] = useState<FoodGroupId | 'all'>('all');
  const [recipesView, setRecipesView] = useState<{ recipeId?: string } | null>(null);
  const { data: allRecipes = [] } = useRecipes();
  // Same order and free tier as the Recipes tool: the first three of the category are free.
  const babyRecipes = useMemo(() => allRecipes.filter((r) => r.category === BABY_RECIPE_CATEGORY)
    .map((r, index) => ({ recipe: r, minMonths: recipeMinMonths(sourceTitles[r.id] ?? r.title), free: index < 3 })), [allRecipes, sourceTitles]);
  const suggested = useMemo(() => babyRecipes
    .filter((r) => months == null || r.minMonths == null || r.minMonths <= Math.max(months, 6))
    .sort((a, b) => (b.minMonths ?? 0) - (a.minMonths ?? 0)).slice(0, 8), [babyRecipes, months]);
  const stage = STAGES.find((s) => s.id === stageId) ?? STAGES[1];

  if (!t) return <ToolPage><ToolHeader title="" onBack={onBack} /><ToolLoading /></ToolPage>;
  const stageText = t.stages.find((s) => s.id === stage.id) ?? t.stages[1];
  const foods = FOODS.map((meta, i) => ({ ...meta, ...t.foods[i] })).filter((food) => group === 'all' || food.group === group);
  const dishKey = (stage.id in t.dishes ? stage.id : '6-8') as keyof typeof t.dishes;
  const dishes = t.dishes[dishKey].map((name, i) => ({ name, tags: DISH_TAGS[dishKey]?.[i] ?? [] }));
  const ageLabel = (m: number) => m < 24 ? fill(t.ui.months_short, m) : fill(t.ui.years_short, Math.floor(m / 12));
  const agePlus = (m: number) => m < 12 ? fill(t.ui.months_plus, m) : fill(t.ui.years_plus, m / 12);
  const ageText = months == null ? undefined : `${selectedChild?.name ?? ''} · ${ageLabel(months)}`;
  const nutrients = t.nutrients.map((n, i) => ({ ...n, tag: NUTRIENT_TAGS[i] }));

  if (recipesView) {
    return <Suspense fallback={null}>
      <Recipes onBack={() => setRecipesView(null)} initialCategory={BABY_RECIPE_CATEGORY} initialRecipeId={recipesView.recipeId} />
    </Suspense>;
  }

  const u = t.ui;
  return (
    <ToolPage>
      <ToolHeader title={u.title} eyebrow={ageText} onBack={onBack} />

      <div className="a3-chips hide-scrollbar sfg-chips sfg-tabs" role="tablist">
        {TABS.map((id) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`a3-chip-btn${tab === id ? ' on' : ''}`} onClick={() => setTab(id)}>{u[`tab_${id}`]}</button>
        ))}
      </div>

      {tab === 'stage' && <div className="sfg-stack">
        <div className="a3-chips hide-scrollbar sfg-chips" role="radiogroup" aria-label={u.age_aria}>
          {t.stages.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={s.id === stageId} className={`a3-chip-btn sfg-small${s.id === stageId ? ' on' : ''}`} onClick={() => setStageId(s.id)}>{s.label}</button>
          ))}
        </div>
        <section className="a-card sfg-stage">
          <p className="a3-eyebrow">{stageText.label}</p>
          <p className="sfg-goal">{stageText.goal}</p>
          <dl className="sfg-facts">
            {[[u.fact_milk, stageText.milk], [u.fact_meals, stageText.meals], [u.fact_portion, stageText.portion], [u.fact_texture, stageText.texture]].map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
          <p className="a3-meta">{u.portion_note}</p>
        </section>

        {stage.id === '0-6' && <section className="a-card">
          <h3 className="sfg-h">{u.readiness_title}</h3>
          {t.readiness.map((r, i) => {
            const on = ready.includes(i);
            return <button key={i} type="button" className="sfg-check" aria-pressed={on} onClick={() => setReady((v) => on ? v.filter((x) => x !== i) : [...v, i])}>
              <span className={`sfg-box${on ? ' on' : ''}`}>{on && <Check size={13} />}</span>{r}
            </button>;
          })}
          <p className="a3-meta sfg-gap">{ready.length === t.readiness.length ? u.readiness_all : u.readiness_hint}</p>
        </section>}

        {stage.id === '6-8' && <section className="a-card">
          <h3 className="sfg-h">{u.sample_day_title}</h3>
          <ul className="sfg-timeline">{t.sampleDay.map(({ time, what }) => <li key={time}><b>{time}</b><span>{what}</span></li>)}</ul>
        </section>}

        {stage.id !== '0-6' && <section className="a-card">
          <h3 className="sfg-h">{u.dishes_title}</h3>
          <ul className="sfg-list">{dishes.map((dish) => <li key={dish.name}><span>{dish.name}</span><Tags tags={dish.tags} t={t} /></li>)}</ul>
          <button type="button" className="a3-link sfg-gap" onClick={() => setTab('recipes')}>{u.see_recipes}</button>
        </section>}
      </div>}

      {tab === 'balance' && <div className="sfg-stack">
        <section className="a-card">
          <h3 className="sfg-h">{u.plate_title}</h3>
          <div className="sfg-plate" aria-hidden="true">{PLATE.map((p, i) => <span key={i} style={{ flex: p.share, background: p.color }} />)}</div>
          <ul className="sfg-legend">{PLATE.map((p, i) => <li key={i}><i style={{ background: p.color }} /><b>{t.plate[i].label}</b> {t.plate[i].hint}</li>)}</ul>
          <p className="a3-meta sfg-gap">{u.plate_note}</p>
        </section>
        <section className="a-card">
          <h3 className="sfg-h">{u.needs_title}</h3>
          <div className="sfg-table" role="table">
            <div role="row" className="sfg-tr sfg-th"><span role="columnheader" />{t.nutrientAges.map((a) => <span role="columnheader" key={a}>{a}</span>)}</div>
            {nutrients.filter((n) => n.need[0] !== '—').map((n) => (
              <div role="row" key={n.name} className="sfg-tr"><span role="rowheader"><b>{n.name}</b></span>{n.need.map((v, i) => <span role="cell" key={i}>{v}</span>)}</div>
            ))}
          </div>
          <p className="a3-meta sfg-gap">{u.needs_note}</p>
        </section>
        <section className="a-card">
          <h3 className="sfg-h">{u.sources_title}</h3>
          {nutrients.map((n) => <div key={n.name} className="sfg-row"><p><b>{n.name}</b> <span className="a3-meta">{n.rule}</span></p><p className="a3-meta">{n.sources}</p></div>)}
        </section>
        <section className="a-card sfg-two">
          <div><h3 className="sfg-h sfg-good">{u.iron_helps_title}</h3><ul className="sfg-dots">{t.ironHelps.map((x) => <li key={x}>{x}</li>)}</ul></div>
          <div><h3 className="sfg-h sfg-bad">{u.iron_blocks_title}</h3><ul className="sfg-dots">{t.ironBlocks.map((x) => <li key={x}>{x}</li>)}</ul></div>
        </section>
      </div>}

      {tab === 'rules' && <div className="sfg-stack">
        <section className="sfg-alert"><AlertTriangle size={18} /><p>{t.emergency}</p></section>
        <section className="a-card">
          <h3 className="sfg-h">{u.allergens_title}</h3>
          <p className="a3-meta">{u.allergens_intro}</p>
          <ol className="sfg-steps">{t.allergenSteps.map((x) => <li key={x}>{x}</li>)}</ol>
          <div className="sfg-chips">{t.allergens.map((a) => <span key={a} className="sfg-tag sfg-tag-allergen">{a}</span>)}</div>
        </section>
        <section className="a-card">
          <h3 className="sfg-h">{u.avoid_title}</h3>
          {t.avoid.map((a) => <div key={a.food} className="sfg-row sfg-row-split"><div><b>{a.food}</b><p className="a3-meta">{a.why}</p></div><span className="sfg-until">{a.until}</span></div>)}
        </section>
        <section className="a-card">
          <h3 className="sfg-h">{u.choking_title}</h3>
          <ul className="sfg-dots">{t.choking.map((c) => <li key={c}>{c}</li>)}</ul>
          <p className="a3-meta sfg-gap">{u.choking_note}</p>
        </section>
        <section className="a-card">
          <h3 className="sfg-h">{u.myths_title}</h3>
          {t.myths.map((m) => <div key={m.myth} className="sfg-myth"><p className="sfg-myth-q">“{m.myth}”</p><p className="a3-meta">{m.fact}</p></div>)}
        </section>
      </div>}

      {tab === 'foods' && <div className="sfg-stack">
        <div className="a3-chips hide-scrollbar sfg-chips">
          {(['all', ...FOOD_GROUPS] as const).map((g) => (
            <button key={g} type="button" className={`a3-chip-btn sfg-small${group === g ? ' on' : ''}`} onClick={() => setGroup(g)}>{g === 'all' ? u.all : t.foodGroups[g]}</button>
          ))}
        </div>
        <section className="a-list-card">
          {foods.map((food) => {
            const later = months != null && months < food.from;
            return <div key={food.name} className="a-list-row sfg-food" style={{ opacity: later ? 0.55 : 1 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p className="a-list-title">{food.name} <Tags tags={food.tags} t={t} /></p>
                <p className="a-list-sub">{food.form} · {food.value}</p>
              </div>
              <span className="sfg-until">{agePlus(food.from)}</span>
            </div>;
          })}
        </section>
      </div>}

      {tab === 'recipes' && <div className="sfg-stack">
        <p className="a3-meta">{u.recipes_intro}</p>
        <section className="a-list-card">
          {suggested.map(({ recipe, minMonths, free }) => (
            <button key={recipe.id} type="button" className="a-list-row sfg-recipe-head" onClick={() => setRecipesView({ recipeId: recipe.id })}>
              {recipe.image_url ? <img src={recipe.image_url} alt="" className="sfg-recipe-img" loading="lazy" /> : <span className="a-list-icon" style={{ background: 'var(--a-grad-peach)', fontSize: 18 }}>🥣</span>}
              <div style={{ minWidth: 0, flex: 1, textAlign: 'start' }}>
                <p className="a-list-title">{stripAge(recipe.title)}</p>
                {minMonths != null && <p className="a-list-sub">{agePlus(minMonths)}</p>}
              </div>
              {!isPremium && !free ? <span className="sfg-lock"><Lock size={12} />Premium</span> : <ChevronRight size={16} className="rtl:rotate-180" style={{ color: 'var(--a-ink-faint)' }} />}
            </button>
          ))}
          {!suggested.length && <p className="a3-meta" style={{ padding: 16 }}>{u.recipes_loading}</p>}
        </section>
        <button type="button" className="sfg-premium" onClick={() => setRecipesView({})}>
          <Crown size={18} /><div><b>{u.all_recipes}</b><p>{fill(u.all_recipes_sub, babyRecipes.length)}</p></div>
          <ChevronRight size={16} className="rtl:rotate-180" style={{ marginInlineStart: 'auto' }} />
        </button>
      </div>}

      <p className="a3-meta sfg-disclaimer">{t.disclaimer}</p>
    </ToolPage>
  );
}
