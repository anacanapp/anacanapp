import { Hand, MousePointer2, Repeat2, Grid2X2, Lightbulb, Star } from 'lucide-react';
import type { GardenText } from './useGardenText';

export default function GardenHelp({ t }: { t: GardenText }) {
  return <ol className="wg-help-list">{([
    [Hand, 'helpDraw'], [MousePointer2, 'helpTap'], [Repeat2, 'helpRepeat'], [Grid2X2, 'helpBoard'], [Lightbulb, 'helpHints'], [Star, 'helpStars'],
  ] as const).map(([Icon, key]) => <li key={key}><span><Icon size={20} /></span><p>{t(key)}</p></li>)}</ol>;
}
