import type { GameState, Need } from '../game/types';
import { t } from '../game/i18n';
import { Icon } from './Icon';

const needConfig: Record<Need, { icon: string; colour: string }> = {
  energy: { icon: 'energy', colour: '#b3a1ce' }, food: { icon: 'utensils', colour: '#dfb28d' }, mood: { icon: 'smile', colour: '#a9c3ae' },
  babyFood: { icon: 'bottle', colour: '#d7b191' }, babySleep: { icon: 'moon', colour: '#b9a9ce' }, comfort: { icon: 'sparkles', colour: '#a8c6bc' },
  bond: { icon: 'heart', colour: '#d9a7b5' },
};

export function Needs({ state, baby = false, compact = false }: { state: GameState; baby?: boolean; compact?: boolean }) {
  const keys: Need[] = baby ? ['babyFood', 'babySleep', 'comfort'] : ['energy', 'food', 'mood'];
  return <div className={`needs ${compact ? 'needs-compact' : ''}`}>{keys.map(key => <div key={key} className={`need ${state.needs[key] < 25 ? 'low' : ''}`} style={{ '--need-colour': needConfig[key].colour } as React.CSSProperties}>
    <Icon name={needConfig[key].icon} size={compact ? 15 : 18} /><div><div className="need-label"><span>{t(key, state.language)}</span>{!compact && <strong>{Math.round(state.needs[key])}</strong>}</div><div className="need-track" role="progressbar" aria-label={t(key, state.language)} aria-valuenow={Math.round(state.needs[key])} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${state.needs[key]}%` }} /></div></div>
  </div>)}</div>;
}
