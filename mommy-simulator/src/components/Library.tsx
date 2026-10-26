import { useDeferredValue, useState } from 'react';
import { pregnancyForWeek, rowArray, rowText, safeContentImage } from '../game/catalogue';
import { CHAPTERS, copy } from '../game/content';
import { t, text } from '../game/i18n';
import type { Catalogue, GameState, PublicRow } from '../game/types';
import { Icon } from './Icon';
import { simulationWeek } from '../game/progression';

type Category = 'pregnancy' | 'milestones' | 'recipes' | 'names' | 'bag';

export function Library({ state, catalogue, onFavourite, onName, onCook, onRefresh, refreshing }: {
  state: GameState; catalogue: Catalogue; onFavourite(id: string): void; onName(name: string): void;
  onCook(row: PublicRow): void; onRefresh(): void; refreshing: boolean;
}) {
  const language = state.language, [category, setCategory] = useState<Category>(CHAPTERS[state.chapter].baby ? 'milestones' : 'pregnancy');
  const [search, setSearch] = useState(''), [selected, setSelected] = useState<PublicRow | null>(null), [onlyFav, setOnlyFav] = useState(false);
  const deferred = useDeferredValue(search.toLocaleLowerCase());
  const categories: { id: Category; icon: string }[] = [{ id: 'pregnancy', icon: 'heart' }, { id: 'milestones', icon: 'footprints' }, { id: 'recipes', icon: 'cooking' }, { id: 'names', icon: 'baby' }, { id: 'bag', icon: 'bag' }];
  const field = category === 'pregnancy' ? 'baby_size_fruit' : category === 'milestones' ? 'label' : category === 'recipes' ? 'title' : category === 'names' ? 'name' : 'item_name';
  const all = catalogue[category];
  const rows = all.filter(row => (!onlyFav || state.favourites.includes(row.id)) && (!deferred || rowText(row, field, language).toLocaleLowerCase().includes(deferred)));
  const currentPregnancy = pregnancyForWeek(catalogue, CHAPTERS[state.chapter].baby ? 39 : simulationWeek(state));
  const updateCategory = (category: Category) => { setCategory(category); setSelected(null); setSearch(''); };

  return <div className="library-panel">
    <div className="library-source"><span><i />{t('source', language)}</span><button onClick={onRefresh} disabled={refreshing} aria-label={t('refresh', language)}><Icon name="refresh" size={17} className={refreshing ? 'spin' : ''} /></button></div>
    <div className="category-tabs">{categories.map(c => <button className={category === c.id ? 'active' : ''} onClick={() => updateCategory(c.id)} key={c.id}><Icon name={c.icon} size={17} />{t(c.id, language)}</button>)}</div>
    {selected ? <div className="library-detail"><button className="back-link" onClick={() => setSelected(null)}><Icon name="left" size={16} />{t('back', language)}</button>
      <div className="detail-heading"><div><span className="eyebrow">{t(category, language)}</span><h3>{rowText(selected, field, language)}</h3></div><button className={`icon-button favourite ${state.favourites.includes(selected.id) ? 'active' : ''}`} aria-label={t('save', language)} onClick={() => onFavourite(selected.id)}><Icon name="heart" /></button></div>
      {category === 'recipes' ? <RecipeDetail row={selected} state={state} onCook={onCook} />
        : category === 'pregnancy' ? <><span className="detail-week">{selected.week_number as number} {text(copy('həftə', 'weeks', 'hafta'), language)}</span>{(['baby_message', 'baby_development', 'daily_tip'] as const).map((field, i) => rowText(selected, field, language) && <div className="detail-copy" key={field}><h4><Icon name={['heart', 'baby', 'leaf'][i]} size={18} />{text([copy('Balacandan bir mesaj', 'A message from your little one', 'Bebeğinden bir mesaj'), copy('Kiçik inkişaf', 'Little developments', 'Küçük gelişmeler'), copy('Günün qeydi', 'A note for today', 'Günün notu')][i], language)}</h4><p>{rowText(selected, field, language)}</p></div>)}</>
        : <><p className="detail-description">{rowText(selected, category === 'names' ? 'meaning' : 'description', language)}</p>{category === 'milestones' && <div className="gentle-card"><Icon name="footprints" /><p>{text(copy('Bu mərhələlər hekayənin ilham mənbəyidir. Hər balaca öz vaxtında kəşf edir.', 'These milestones inspire the story. Every little one discovers at their own pace.', 'Bu aşamalar hikâyeye ilham verir. Her bebek kendi zamanında keşfeder.'), language)}</p></div>}{category === 'names' && <button className="button primary" onClick={() => onName(rowText(selected, 'name', language))}><Icon name="heart" size={18} />{t('selectName', language)}</button>}{category === 'bag' && <span className="essential-pill">{t(selected.is_essential ? 'essential' : 'optional', language)}</span>}</>}
      <small className="record-source">Anacan · {catalogue.project}<br />{selected.id}</small>
    </div> : <>
      {category === 'pregnancy' && currentPregnancy && !search && !onlyFav && <button className="library-feature" onClick={() => setSelected(currentPregnancy)}><img src="/assets/anacan-bump.webp" alt="" /><div><span className="eyebrow">{text(copy('Sənin hekayəndə', 'In your story', 'Senin hikâyende'), language)}</span><strong>{rowText(currentPregnancy, 'baby_size_fruit', language)}</strong><small>{t('week', language)} {currentPregnancy.week_number as number}</small></div><Icon name="right" /></button>}
      <div className="library-search"><label><Icon name="search" size={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search', language)} aria-label={t('search', language)} /></label><button className={`icon-button ${onlyFav ? 'active' : ''}`} onClick={() => setOnlyFav(!onlyFav)} aria-label={t('favourites', language)} aria-pressed={onlyFav}><Icon name="heart" size={19} /></button></div>
      <div className={`library-list library-${category}`}>{rows.slice(0, 65).map(row => <button key={row.id} className="library-row" onClick={() => setSelected(row)} data-testid="catalogue-row">
        {category === 'recipes' ? <RecipeThumb row={row} /> : <span className={`library-row-icon ${category}`}><Icon name={categories.find(c => c.id === category)!.icon} size={22} /></span>}
        <div><strong>{rowText(row, field, language)}</strong><small>{category === 'pregnancy' ? `${row.week_number} ${text(copy('həftə', 'weeks', 'hafta'), language)}` : category === 'names' ? rowText(row, 'meaning', language).slice(0, 90) : category === 'bag' ? t(row.is_essential ? 'essential' : 'optional', language) : category === 'recipes' ? `${(Number(row.prep_time) || 0) + (Number(row.cook_time) || 0)} ${t('minutes', language)}` : rowText(row, 'description', language)}</small></div><Icon name={state.favourites.includes(row.id) ? 'heart' : 'right'} size={17} />
      </button>)}</div>
      {!rows.length && <div className="empty-state"><Icon name="search" size={30} /><p>{t('search', language)}</p></div>}
    </>}
    <div className="library-footer"><Icon name="bookheart" size={15} /><span>{t('offline', language)} · {new Date(catalogue.fetchedAt).toLocaleDateString(language)}</span></div>
  </div>;
}

function RecipeThumb({ row }: { row: PublicRow }) {
  const [failed, setFailed] = useState(false), image = safeContentImage(row.image_url);
  return image && !failed ? <img className="recipe-thumb" src={image} loading="lazy" alt="" onError={() => setFailed(true)} /> : <span className="library-row-icon recipes"><Icon name="cooking" size={23} /></span>;
}

function RecipeDetail({ row, state, onCook }: { row: PublicRow; state: GameState; onCook(row: PublicRow): void }) {
  return <><div className="recipe-hero"><RecipeThumb row={row} /><span><Icon name="cooking" size={20} />{(Number(row.prep_time) || 0) + (Number(row.cook_time) || 0)} {t('minutes', state.language)}</span></div>
    <p className="detail-description">{rowText(row, 'description', state.language)}</p>
    <h4>{t('ingredients', state.language)}</h4><ul className="recipe-ingredients">{rowArray(row, 'ingredients', state.language).map((item, i) => <li key={i}><Icon name="leaf" size={14} />{item}</li>)}</ul>
    <h4>{t('instructions', state.language)}</h4><ol className="recipe-instructions">{rowArray(row, 'instructions', state.language).map((item, i) => <li key={i}><span>{i + 1}</span>{item}</li>)}</ol>
    <button className="button primary large" onClick={() => onCook(row)}><Icon name="cooking" />{t('playMini', state.language)}</button>
  </>;
}
