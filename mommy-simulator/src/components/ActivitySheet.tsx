import { availableActivities } from '../game/engine';
import { copy } from '../game/content';
import { t, text } from '../game/i18n';
import type { Activity, GameState } from '../game/types';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { currentStep } from '../game/progression';
import { householdActivityIssue, laundryLoad } from '../game/luzern';

export function ActivitySheet({ activity, state, onSimple, onMini, onSelect, onRestock, onClose }: { activity: Activity; state: GameState; onSimple(): void; onMini(): void; onSelect(a: Activity): void; onRestock(): void; onClose(): void }) {
  const language = state.language;
  const required = currentStep(state)?.action === activity.id && currentStep(state)?.interactive || activity.id === 'groceries';
  const issue = householdActivityIssue(state, activity.id);
  return <Sheet title={text(activity.title, language)} subtitle={t('activities', language)} icon={activity.icon} language={language} onClose={onClose} className="activity-sheet">
    <div className="activity-intro"><span className={`activity-illustration activity-${activity.id}`}><Icon name={activity.icon} size={45} /><i /><i /></span><p>{text(activity.description, language)}</p></div>
    <div className="activity-effects">{Object.entries(activity.effect).filter(([, value]) => value > 0).slice(0, 3).map(([key, value]) => <span key={key}><Icon name={key.includes('ood') ? 'utensils' : key === 'energy' ? 'energy' : key === 'babySleep' ? 'moon' : key === 'bond' ? 'heart' : 'sparkles'} size={15} />+{value} {t(key as 'energy', language)}</span>)}</div>
    <div className="activity-reward"><span><Icon name="coins" size={17} />+{activity.coins}</span><span><Icon name="star" size={16} />+{activity.xp} XP</span><small>{activity.minutes} {t('minutes', language)} {text(copy('oyun vaxtı', 'game time', 'oyun zamanı'), language)}</small></div>
    {activity.id === 'cook' && <p className="activity-supplies">{t('mealSupplies', language)}</p>}
    {activity.id === 'laundry' && <p className="activity-supplies">{t('laundryDirty', language)}: {laundryLoad(state.household).count} · {t('laundryFolded', language)}: {state.household.laundry.folded}</p>}
    {issue && <div className="activity-resource-note" role="status"><Icon name={issue === 'stockLow' ? 'bag' : 'check'} size={20} /><span>{t(issue, language)}</span>{issue === 'stockLow' && <button className="button secondary" onClick={onRestock} data-testid="activity-restock">{t('market', language)}<Icon name="arrow" size={16} /></button>}</div>}
    {activity.mini && <button className="button primary large" onClick={onMini} disabled={Boolean(issue)} data-testid="activity-mini"><Icon name="play" size={18} />{t('playScene', language)}<span className="small-bonus">+50%</span></button>}
    {!required && <button className={`button ${activity.mini ? 'subtle' : 'primary'} large`} onClick={onSimple} disabled={Boolean(issue)} data-testid="activity-simple">{t(activity.mini ? 'simple' : 'doIt', language)}<Icon name={activity.mini ? 'leaf' : 'arrow'} size={18} /></button>}
    <div className="other-activities"><span>{text(copy('Bu guşədə başqa anlar', 'Other moments in this corner', 'Bu köşedeki diğer anlar'), language)}</span><div>{availableActivities(state).filter(a => a.room === activity.room && a.id !== activity.id).map(a => <button key={a.id} onClick={() => onSelect(a)}><Icon name={a.icon} size={16} />{text(a.title, language)}</button>)}</div></div>
  </Sheet>;
}
