export type ItemCategory = 'logo' | 'trail' | 'frame';
export type Rarity = 'starter' | 'rare' | 'epic' | 'legendary';
export type TrailId = 'none' | 'mint' | 'electric' | 'stardust' | 'fire' | 'rainbow';
export type FrameId = 'classic' | 'orbit' | 'hex' | 'crown';

export interface ShopItem {
  id: string;
  name: string;
  category: ItemCategory;
  price: number;
  rarity: Rarity;
  color: string;
  path?: string;
}

export const COSMETICS: readonly ShopItem[] = [
  { id: 'rocket', name: 'Launch', category: 'logo', price: 0, rarity: 'starter', color: '#b9ff6b', path: 'M12 2c5 2.5 7 7 5.5 12L12 17l-5.5-3C5 9 7 4.5 12 2ZM6.5 10 2 15v5l6-3M17.5 10 22 15v5l-6-3M9 19l3 4 3-4' },
  { id: 'bolt', name: 'Disrupt', category: 'logo', price: 0, rarity: 'starter', color: '#b9ff6b', path: 'M13 2 3 14h8l-1 8L21 9h-8l1-7Z' },
  { id: 'cube', name: 'Builder', category: 'logo', price: 0, rarity: 'starter', color: '#66d5ff', path: 'M12 2 22 7v10l-10 5-10-5V7L12 2ZM2 7l10 5 10-5M12 12v10' },
  { id: 'orbit-logo', name: 'Orbit', category: 'logo', price: 0, rarity: 'starter', color: '#b6a0ff', path: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM3 5C-3 13 12 23 20 19 28 15 13-3 5 3M21 4l1 3-3 1' },
  { id: 'lotus', name: 'Lotus AI', category: 'logo', price: 180, rarity: 'rare', color: '#ffabd6', path: 'M12 2C5 8 7 14 12 20c5-6 7-12 0-18ZM12 20C3 20 1 13 2 7c7 1 10 5 10 13ZM12 20c9 0 11-7 10-13-7 1-10 5-10 13ZM3 20l9 2 9-2' },
  { id: 'infinity', name: 'Infinite', category: 'logo', price: 220, rarity: 'rare', color: '#66d5ff', path: 'M12 12c-3-5-6-7-9-4-4 4-1 10 3 9 3-.5 5-3.5 6-5Zm0 0c3-5 6-7 9-4 4 4 1 10-3 9-3-.5-5-3.5-6-5Z' },
  { id: 'wave', name: 'Flow State', category: 'logo', price: 240, rarity: 'rare', color: '#62ecc0', path: 'M2 14c3-9 7-9 10-2s7 7 10-2M2 20c3-9 7-9 10-2s7 7 10-2M2 8c3-9 7-9 10-2s7 7 10-2' },
  { id: 'diamond', name: 'Crystal', category: 'logo', price: 280, rarity: 'rare', color: '#a7caff', path: 'M7 3h10l5 6-10 13L2 9l5-6ZM2 9h20M7 3l5 19 5-19M7 3l5 6 5-6' },
  { id: 'circuit', name: 'Neural', category: 'logo', price: 360, rarity: 'epic', color: '#66d5ff', path: 'M8 8h8v8H8V8ZM2 4h6v4M16 4h6v6h-6M4 16v6h8v-6M20 16v4h-4M12 2v6M2 12h6M16 12h6M12 16v6' },
  { id: 'phoenix', name: 'Phoenix', category: 'logo', price: 420, rarity: 'epic', color: '#ffb36b', path: 'M12 3 8 10 2 5l3 10 7 7 7-7 3-10-6 5-4-7ZM7 14l5 4 5-4M12 3v15M2 5l10 8L22 5' },
  { id: 'falcon', name: 'Falcon', category: 'logo', price: 460, rarity: 'epic', color: '#b6a0ff', path: 'M2 3 12 9 22 3l-4 11-6 8-6-8L2 3ZM6 9l6 5 6-5M12 9v13M3 6l6 3M21 6l-6 3' },
  { id: 'galaxy', name: 'Nebula', category: 'logo', price: 520, rarity: 'epic', color: '#d5a6ff', path: 'M12 2v5M12 17v5M2 12h5M17 12h5M5 5l4 4M15 15l4 4M5 19l4-4M15 9l4-4M12 7l5 5-5 5-5-5 5-5Z' },
  { id: 'unicorn', name: 'Unicorn', category: 'logo', price: 800, rarity: 'legendary', color: '#ffabd6', path: 'M15 7 20 1l-1 9 3 5-4 3-5-3-1 7H4C1 14 4 9 9 6l4-4 2 5ZM9 6l2 5M15 7l4 3M16 12h1M4 22c5-3 3-5 5-8' },
  { id: 'crown-logo', name: 'Empire', category: 'logo', price: 1100, rarity: 'legendary', color: '#ffd480', path: 'M3 7l5 4 4-8 4 8 5-4-3 12H6L3 7ZM6 22h12M5 16h14' },
  { id: 'custom', name: 'Your mark', category: 'logo', price: 0, rarity: 'starter', color: '#ffffff' },
  { id: 'trail-none', name: 'Clean', category: 'trail', price: 0, rarity: 'starter', color: '#b9ff6b' },
  { id: 'trail-mint', name: 'Mint Rush', category: 'trail', price: 120, rarity: 'rare', color: '#b9ff6b' },
  { id: 'trail-electric', name: 'Electric', category: 'trail', price: 280, rarity: 'rare', color: '#66d5ff' },
  { id: 'trail-stardust', name: 'Stardust', category: 'trail', price: 450, rarity: 'epic', color: '#b6a0ff' },
  { id: 'trail-fire', name: 'Afterburn', category: 'trail', price: 600, rarity: 'epic', color: '#ff9e62' },
  { id: 'trail-rainbow', name: 'Prismatic', category: 'trail', price: 900, rarity: 'legendary', color: '#ffabd6' },
  { id: 'frame-classic', name: 'Classic', category: 'frame', price: 0, rarity: 'starter', color: '#b9ff6b' },
  { id: 'frame-orbit', name: 'Satellite', category: 'frame', price: 200, rarity: 'rare', color: '#66d5ff' },
  { id: 'frame-hex', name: 'Hex Tech', category: 'frame', price: 400, rarity: 'epic', color: '#b6a0ff' },
  { id: 'frame-crown', name: 'Royal', category: 'frame', price: 750, rarity: 'legendary', color: '#ffd480' },
];

export const itemById = (id: string) => COSMETICS.find(item => item.id === id);
export const FREE_ITEMS = COSMETICS.filter(item => item.price === 0).map(item => item.id);
export const PALETTE = ['#b9ff6b', '#62ecc0', '#66d5ff', '#7b9dff', '#b6a0ff', '#ffabd6', '#ff9574', '#ffd480'] as const;

export interface PlayerLook {
  logo: string;
  trail: TrailId;
  frame: FrameId;
  monogram: string;
  customImage: string | null;
}

export { BRANDS } from './fictional-brands';
export type { Brand, BotStrategy } from './fictional-brands';

export const defaultLook = (): PlayerLook => ({ logo: 'rocket', trail: 'none', frame: 'classic', monogram: 'S', customImage: null });
