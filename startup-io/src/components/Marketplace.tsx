import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ChangeEvent } from 'react';
import { ArrowRight, Check, ChevronRight, ImagePlus, Palette, Sparkles, Upload, X } from 'lucide-react';
import { COSMETICS, itemById, PALETTE } from '../game/cosmetics';
import type { ItemCategory, ShopItem } from '../game/cosmetics';
import { copy } from '../i18n';
import { buyItem, equippedId, equipItem } from '../persistence';
import type { Progress } from '../persistence';
import { Coin, Logo, LogoToken } from './Logo';

interface Props { progress: Progress; onChange: (progress: Progress) => void; onPlay: () => void }

export function Marketplace({ progress, onChange, onPlay }: Props) {
  const [category, setCategory] = useState<ItemCategory | 'all'>('all');
  const [preview, setPreview] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const t = copy(progress.settings.language);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const notify = (message: string) => { setNotice(message); clearTimeout(timer.current); timer.current = setTimeout(() => setNotice(undefined), 2700); };
  const purchase = (id: string) => {
    const result = buyItem(progress, id);
    if (result.status === 'insufficient') { notify(t.insufficient); return; }
    onChange(result.progress); setPreview(undefined); notify(result.status === 'bought' ? t.bought : t.styleSaved);
  };
  const item = preview ? itemById(preview) : undefined;
  const look = item ? previewLook(progress, item) : progress.look;
  return <section className="marketplace-screen" data-testid="marketplace">
    <div className="page-intro"><span className="eyebrow">THE FOUNDER’S MARKET</span><h1>{t.shopHeading}<Sparkles size={25} /></h1><p>{t.shopIntro}</p></div>
    <div className="market-feature"><div className="market-feature-art"><LogoToken look={{ ...progress.look, logo: 'phoenix', trail: 'fire', frame: 'orbit' }} color="#ffb36b" size={97} /></div><div className="market-feature-copy"><span className="rarity-tag legendary">{t.legendary} COLLECTION</span><h2>Built to<br /><em>stand out.</em></h2><button onClick={() => { setCategory('logo'); setPreview('phoenix'); }}>Phoenix <Coin size={12} />420<ChevronRight size={13} /></button></div><span className="feature-number">01</span></div>
    <div className="shop-category-tabs" role="tablist">{(['all', 'logo', 'trail', 'frame'] as const).map(value => <button role="tab" aria-selected={category === value} key={value} className={category === value ? 'selected' : ''} onClick={() => setCategory(value)}>{value === 'all' ? t.all : value === 'logo' ? t.logos : value === 'trail' ? t.trails : t.frames}</button>)}</div>
    <div className="shop-grid">{COSMETICS.filter(entry => entry.id !== 'custom' && (category === 'all' || entry.category === category)).map(entry => {
      const owned = progress.owned.includes(entry.id);
      const equipped = equippedId(progress, entry.category) === entry.id;
      return <button className={`shop-card ${equipped ? 'equipped' : ''} rarity-${entry.rarity}`} key={entry.id} onClick={() => setPreview(entry.id)} style={{ '--item-color': entry.color } as CSSProperties} data-testid={`shop-${entry.id}`} aria-label={`${entry.name}, ${owned ? t.owned : `${entry.price} ${t.wallet}`}`}>
        <span className={`rarity-tag ${entry.rarity}`}>{t[entry.rarity]}</span>
        <div className="shop-item-art"><ItemArt item={entry} progress={progress} /></div>
        <h3>{entry.name}</h3><span className="shop-item-category">{entry.category === 'logo' ? t.logo : entry.category === 'trail' ? t.trails : t.frames}</span>
        <div className="shop-item-footer">{equipped ? <span className="owned-label"><Check size={12} />{t.equipped}</span> : owned ? <span className="owned-label">{t.owned}</span> : <b><Coin size={13} />{entry.price}</b>}<span className="shop-item-plus">{equipped ? <Check size={11} /> : '+'}</span></div>
      </button>;
    })}</div>
    <div className="earn-tip"><Coin size={23} /><div><b>{t.shopHint}</b><span>{t.insufficient}</span></div><button onClick={onPlay} aria-label={t.play}><ArrowRight size={19} /></button></div>
    {notice && <div className="shop-notice" role="status"><Check size={15} />{notice}</div>}
    {item && <div className="modal-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) setPreview(undefined); }}><section className="home-modal item-preview-modal" role="dialog" aria-modal="true" aria-label={item.name}><div className="modal-heading"><span className={`rarity-tag ${item.rarity}`}>{t[item.rarity]}</span><button className="icon-button" onClick={() => setPreview(undefined)} aria-label={t.close}><X size={19} /></button></div><div className="item-large-preview"><LogoToken look={look} color={item.category === 'logo' ? item.color : progress.color} size={142} /></div><h2>{item.name}</h2><p>{t.customizationTip}</p><div className="preview-balance"><span>{t.wallet}</span><b><Coin size={16} />{progress.credits}</b></div><button className="primary-button" onClick={() => purchase(item.id)} data-testid="purchase-item">{progress.owned.includes(item.id) ? t.equip : t.buy}<span>{!progress.owned.includes(item.id) && <><Coin size={17} />{item.price}</>}<ArrowRight size={18} /></span></button></section></div>}
  </section>;
}

function previewLook(progress: Progress, item: ShopItem) {
  return equipItem({ ...progress, owned: [...progress.owned, item.id] }, item.id).look;
}

function ItemArt({ item, progress }: { item: ShopItem; progress: Progress }) {
  if (item.category === 'logo') return <Logo id={item.id} size={40} color={item.color} look={progress.look} />;
  return <LogoToken look={previewLook(progress, item)} color={item.color} size={63} />;
}

export function Customize({ progress, onChange, onPlay }: Props) {
  const t = copy(progress.settings.language);
  const [tab, setTab] = useState<ItemCategory>('logo');
  const [error, setError] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  const update = (patch: Partial<Progress>) => onChange({ ...progress, ...patch });
  const setLogo = (logo: string) => update({ look: { ...progress.look, logo } });
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) { setError(t.uploadError); return; }
    const url = URL.createObjectURL(file);
    try {
      const image = new Image(); image.src = url; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 160;
      const ctx = canvas.getContext('2d')!; const size = Math.min(image.naturalWidth, image.naturalHeight);
      ctx.drawImage(image, (image.naturalWidth - size) / 2, (image.naturalHeight - size) / 2, size, size, 0, 0, 160, 160);
      const data = canvas.toDataURL('image/png');
      if (data.length >= 150000) throw new Error('Image is too large');
      update({ look: { ...progress.look, logo: 'custom', customImage: data } }); setError(undefined);
    } catch { setError(t.uploadError); } finally { URL.revokeObjectURL(url); }
  };

  return <section className="customize-screen" data-testid="customize"><div className="page-intro"><span className="eyebrow">FOUNDER STUDIO</span><h1>{t.yourStyle}<Palette size={23} /></h1><p>{t.customizationTip}</p></div>
    <div className="studio-preview"><span className="studio-orbit orbit-a" /><span className="studio-orbit orbit-b" /><LogoToken look={progress.look} color={progress.color} size={124} /><span className="studio-name">{progress.name || 'My Startup'}</span><span className="studio-live"><span className="status-dot" />LIVE PREVIEW</span></div>
    <div className="studio-name-field"><label htmlFor="startup-name">{t.name}<span>{t.nameHint}</span></label><input id="startup-name" value={progress.name} onChange={event => update({ name: event.target.value.slice(0, 18) })} onBlur={() => { if (!progress.name.trim()) update({ name: 'My Startup' }); }} aria-label={t.name} maxLength={18} /></div>
    <div className="studio-colors"><div className="studio-section-label"><b>{t.color}</b><span>{progress.color.toUpperCase()}</span></div><div className="studio-color-row">{PALETTE.map(color => <button key={color} style={{ '--swatch': color } as CSSProperties} className={`studio-swatch ${progress.color === color ? 'selected' : ''}`} aria-label={`${t.color} ${color}`} aria-pressed={progress.color === color} onClick={() => update({ color })}>{progress.color === color && <Check size={14} strokeWidth={3} />}</button>)}<label className="custom-color-control" aria-label={t.customColor}><Palette size={15} /><input type="color" value={progress.color} onChange={event => update({ color: event.target.value })} aria-label={t.customColor} /></label></div></div>
    <div className="shop-category-tabs" role="tablist">{(['logo', 'trail', 'frame'] as const).map(category => <button key={category} role="tab" aria-selected={tab === category} onClick={() => setTab(category)} className={tab === category ? 'selected' : ''}>{category === 'logo' ? t.logos : category === 'trail' ? t.trails : t.frames}</button>)}</div>
    <div className="collection-grid">{COSMETICS.filter(item => item.category === tab && progress.owned.includes(item.id) && item.id !== 'custom').map(item => <button key={item.id} className={`collection-item ${equippedId(progress, tab) === item.id ? 'selected' : ''}`} aria-label={`${t.equip} ${item.name}`} aria-pressed={equippedId(progress, tab) === item.id} onClick={() => onChange(equipItem(progress, item.id))}><ItemArt item={{ ...item, color: progress.color }} progress={progress} /><span>{item.name}</span>{equippedId(progress, tab) === item.id && <i><Check size={10} /></i>}</button>)}</div>
    {tab === 'logo' && <div className="custom-mark-editor"><div className="studio-section-label"><b>{t.monogram}</b><span>YOUR OWN MARK</span></div><div className="monogram-row"><button className={`monogram-preview ${progress.look.logo === 'custom' ? 'selected' : ''}`} onClick={() => setLogo('custom')} aria-label={t.yourLogo}><Logo id="custom" size={36} color={progress.color} look={progress.look} /></button><input value={progress.look.monogram} maxLength={3} aria-label={t.monogram} placeholder="S" onChange={event => update({ look: { ...progress.look, logo: 'custom', monogram: event.target.value.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase().slice(0, 3), customImage: null } })} /><span>1–3</span></div><div className="upload-row"><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} hidden /><button onClick={() => fileInput.current?.click()}><ImagePlus size={18} />{t.upload}<Upload size={13} /></button>{progress.look.customImage && <button className="remove-image" onClick={() => update({ look: { ...progress.look, customImage: null } })} aria-label={t.removeImage}><X size={16} /></button>}</div><p className={error ? 'upload-error' : ''}>{error ?? t.uploadHint}</p></div>}
    <button className="primary-button studio-ready" onClick={onPlay}>{t.saveStyle}<ArrowRight size={19} /></button>
  </section>;
}
