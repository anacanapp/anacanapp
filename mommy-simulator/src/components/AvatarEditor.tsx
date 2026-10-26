import { HAIRS, OUTFITS, SKINS } from '../game/content';
import { t } from '../game/i18n';
import type { Avatar, Language } from '../game/types';
import { AvatarPortrait } from './AvatarPortrait';
import { Icon } from './Icon';
import { CharacterPreview } from './CharacterPreview';

export function AvatarEditor({ avatar, onChange, language, baby = false }: { avatar: Avatar; onChange(avatar: Avatar): void; language: Language; baby?: boolean }) {
  const set = (key: keyof Avatar, value: string) => onChange({ ...avatar, [key]: value });
  return <div className="avatar-editor">
    <div className="avatar-preview"><CharacterPreview avatar={avatar} pregnant={!baby} /><span className="avatar-name">{avatar.name || 'Aylin'}<Icon name="heart" size={14} /></span></div>
    <div className="avatar-fields">
      <div className="name-fields"><label>{t('yourName', language)}<input maxLength={24} value={avatar.name} onChange={e => set('name', e.target.value)} placeholder="Aylin" autoComplete="off" data-testid="avatar-name" /></label>
        <label>{t('babyName', language)}<input maxLength={24} value={avatar.babyName} onChange={e => set('babyName', e.target.value)} placeholder="Dəniz" autoComplete="off" /></label></div>
      {([['skin', SKINS], ['hair', HAIRS], ['outfit', OUTFITS]] as const).map(([key, colours]) => <fieldset className="swatch-field" key={key}><legend>{t(key, language)}</legend><div className="swatches">
        {colours.map((colour, index) => <button key={colour} style={{ '--swatch': colour } as React.CSSProperties} className={`swatch ${avatar[key] === colour ? 'selected' : ''}`} onClick={() => set(key, colour)} aria-label={`${t(key, language)} ${index + 1}`} aria-pressed={avatar[key] === colour}>{avatar[key] === colour && <Icon name="check" size={18} />}</button>)}
      </div></fieldset>)}
      <fieldset className="swatch-field"><legend>{t('hairstyle', language)}</legend><div className="segmented">{(['bob', 'bun', 'long'] as const).map(style => <button className={avatar.hairstyle === style ? 'selected' : ''} onClick={() => set('hairstyle', style)} key={style}>{t(style, language)}</button>)}</div></fieldset>
      <fieldset className="swatch-field"><legend>{t('outfitStyle', language)}</legend><div className="segmented">{(['dress', 'casual', 'knit'] as const).map(style => <button className={avatar.outfitStyle === style ? 'selected' : ''} onClick={() => set('outfitStyle', style)} key={style}>{t(style, language)}</button>)}</div></fieldset>
      <fieldset className="swatch-field"><legend>{t('personality', language)}</legend><div className="personalities">{(['dreamer', 'maker', 'gentle'] as const).map((p, i) => <button className={avatar.personality === p ? 'selected' : ''} onClick={() => set('personality', p)} key={p} aria-pressed={avatar.personality === p}><Icon name={['moon', 'palette', 'leaf'][i]} size={18} />{t(p, language)}</button>)}</div></fieldset>
    </div>
  </div>;
}
