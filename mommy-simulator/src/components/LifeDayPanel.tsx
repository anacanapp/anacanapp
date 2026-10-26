import { art, dailyLifeComplete, dailyLifeGoals, LIFE_LOCATIONS, lifeDate, money, GROCERY_PRODUCTS, householdActivityIssue } from '../game/luzern';
import { activityById } from '../game/engine';
import { text, t } from '../game/i18n';
import { copy as c } from '../game/copy';
import type { ActivityId, GameAction, GameState } from '../game/types';
import { Icon } from './Icon';
import { activityLocation } from '../game/progression';

export function LifeDayPanel({ state, dispatch, onActivity, onTravel, onClose }: { state: GameState; dispatch(action: GameAction): void;
  onActivity(id: ActivityId): void; onTravel(location?: GameState['location']): void; onClose(): void;
}) {
  const l = state.language;
  return <div className="life-day-panel"><div className="life-day-intro"><img src={art('terrace')} alt="" /><div><span className="eyebrow">LUZERN · {lifeDate(state.day, l)}</span><h3>{t('todaysPlan', l)}</h3><p>{t('dailyLifeHint', l)}</p></div></div>
    <div className="household-meters">{[['cleanliness', state.household.cleanliness, 'clean'], ['relationship', state.household.relationship, 'heart'], ['laundryCount', state.household.laundry.dirty, 'laundry']] .map(([key, value, icon]) => <div key={String(key)}><Icon name={String(icon)} size={22} /><strong>{Math.round(Number(value))}{key !== 'laundryCount' ? '%' : ''}</strong><small>{t(key as 'cleanliness', l)}</small></div>)}</div>
    <div className="life-goals">{dailyLifeGoals(state).map((id, i) => {
      const a = activityById(id), done = state.household.chores.includes(id), issue = householdActivityIssue(state, id);
      return <button className={done ? 'done' : ''} key={id} onClick={() => activityLocation(a, state) !== state.location ? onTravel() : onActivity(id)} disabled={Boolean(state.activity) || done} data-testid={`life-goal-${id}`}><span><Icon name={done ? 'check' : a.icon} size={23} /></span><div><small>0{i + 1} · {t(a.location && a.location !== 'home' ? a.location : 'homeLocation', l)}</small><strong>{text(a.title, l)}</strong><p>{issue ? t(issue, l) : text(a.description, l)}</p></div><Icon name={done ? 'check' : 'right'} size={17} /></button>;
    })}</div>
    <button className="button primary large" onClick={() => dispatch({ type: 'CLAIM_LIFE_DAY' })} disabled={!dailyLifeComplete(state) || state.household.dailyRewardDay === state.day} data-testid="claim-life-day"><Icon name="gift" size={19} />{t(state.household.dailyRewardDay === state.day ? 'claimed' : 'claim', l)} · +45 <Icon name="coins" size={16} /></button>
    <div className="household-budget"><div><Icon name="wallet" size={21} /><strong>{t('familyBudget', l)}</strong><span>CHF {money(state.household.cash, l)}</span></div><p>{t('householdHint', l)}</p></div>
    <div className="laundry-summary"><span>{t('laundryDirty', l)} <strong data-testid="laundry-dirty-count">{state.household.laundry.dirty}</strong></span><span>{t('laundryFolded', l)} <strong data-testid="laundry-folded-count">{state.household.laundry.folded}</strong></span></div>
    <h4>{t('pantry', l)}</h4><div className="pantry-grid">{GROCERY_PRODUCTS.map(p => <div key={p.id}><Icon name={p.icon} size={20} /><span>{text(p.title, l)}</span><strong data-testid={`pantry-${p.id}`}>{state.household.groceries[p.id]}</strong></div>)}</div>
    <button className="button secondary large" onClick={() => onTravel('market')} disabled={state.location === 'market' || Boolean(state.activity)}><Icon name="bag" size={19} />{text(c('Məhəllə marketinə gedək', 'Let’s visit our local market', 'Mahalle marketine gidelim'), l)}</button>
    <div className="sleep-card"><Icon name="moon" size={26} /><div><strong>{t('sleep', l)}</strong><small>{t(state.dailyActions < 3 ? 'finishSome' : 'sleepHint', l)}</small></div><button className="icon-button" disabled={state.dailyActions < 3 || Boolean(state.activity)} onClick={() => { dispatch({ type: 'SLEEP' }); onClose(); }} aria-label={t('sleep', l)} data-testid="finish-day"><Icon name="arrow" /></button></div>
  </div>;
}

export function LuzernMap({ state, onTravel }: { state: GameState; onTravel(location: GameState['location']): void }) {
  const l = state.language;
  return <div className="luzern-map"><div className="luzern-map-hero"><img src={art('lakeside-wide')} alt="Luzern" /><div><span>SWITZERLAND · 47.05° N</span><h3>Luzern</h3><p>{text(c('Gölün yanında bir ailə həyatı', 'A family life beside the lake', 'Gölün yanında bir aile hayatı'), l)}</p></div></div><div className="luzern-map-locations">{LIFE_LOCATIONS.map(location => <button className={state.location === location.id ? 'current' : ''} onClick={() => onTravel(location.id)} key={location.id} disabled={state.location === location.id || Boolean(state.activity)} data-testid={`travel-${location.id}`}><img src={art(location.image)} alt="" /><div><small>{state.location === location.id ? t('current', l) : `${location.minutes || 15} ${t('minutes', l)}`}</small><strong>{text(location.title, l)}</strong><span>{text(location.subtitle, l)}</span></div><Icon name={state.location === location.id ? 'check' : 'right'} size={19} /></button>)}</div></div>;
}
