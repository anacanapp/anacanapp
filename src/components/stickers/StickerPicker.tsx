import { useMemo, useState } from 'react';
import '@/styles/stickers.css';
import { X } from 'lucide-react';
import { STICKERS, STICKER_GROUPS, recentStickers, rememberSticker, stickerAsset, stickerText, type StickerGroup } from '@/lib/stickers';

const GROUP_LABEL: Record<StickerGroup, string> = { ritm: 'Ritm', tumurcuq: 'Tumurcuq', qucaq: 'Qucaq', trio: '♥' };
const GROUP_COLOR: Record<StickerGroup, string> = { ritm: '#EF4452', tumurcuq: '#9A4FE0', qucaq: '#14A889', trio: '#FF5A5F' };

/** Compact sticker tray used by community comments and every chat composer. */
export default function StickerPicker({ onPick, onClose, disabled = false }: { onPick: (id: string) => void; onClose: () => void; disabled?: boolean }) {
  const [group, setGroup] = useState<StickerGroup | 'all'>('all');
  const recent = useMemo(() => recentStickers(), []);
  const list = group === 'all' ? STICKERS : STICKERS.filter(sticker => sticker.group === group);
  const pick = (id: string) => { if (disabled) return; rememberSticker(id); onPick(id); };
  return <div className="sticker-picker" role="dialog" aria-label={stickerText('stickers')} data-sticker-picker>
    <div className="sticker-picker-head">
      <strong>{stickerText('stickers')}</strong>
      <button type="button" className="sticker-picker-close" onClick={onClose} aria-label="×"><X size={16} /></button>
    </div>
    <div className="sticker-picker-tabs" role="tablist">
      <button type="button" role="tab" aria-selected={group === 'all'} onClick={() => setGroup('all')}>{stickerText('all')}</button>
      {STICKER_GROUPS.map(item => <button key={item} type="button" role="tab" aria-selected={group === item} onClick={() => setGroup(item)}
        style={group === item ? { background: GROUP_COLOR[item], color: '#fff' } : undefined}>{GROUP_LABEL[item]}</button>)}
    </div>
    <div className="sticker-picker-grid">
      {group === 'all' && recent.map(id => <button key={`r-${id}`} type="button" onClick={() => pick(id)} aria-label={`${stickerText('send')} ${Number(id)}`} disabled={disabled}>
        <img src={stickerAsset(id)} alt="" loading="lazy" decoding="async" /></button>)}
      {list.filter(sticker => group !== 'all' || !recent.includes(sticker.id)).map(sticker => <button key={sticker.id} type="button" onClick={() => pick(sticker.id)}
        aria-label={`${stickerText('send')} ${Number(sticker.id)}`} disabled={disabled}><img src={stickerAsset(sticker.id)} alt="" loading="lazy" decoding="async" /></button>)}
    </div>
  </div>;
}

/** Renders a sent sticker (no bubble chrome). */
export function StickerImage({ id, size = 132 }: { id: string; size?: number }) {
  return <img className="sticker-image" src={stickerAsset(id)} alt={`${stickerText('sticker')} ${Number(id)}`} width={size} height={size} loading="lazy" decoding="async"
    style={{ width: size, height: size, objectFit: 'contain', display: 'block' }} />;
}
