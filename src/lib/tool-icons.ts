import {
  Shield, Timer, Scale, Baby, Briefcase, Volume2, Heart, Footprints, Utensils, Activity, Camera, ShoppingCart,
  Wrench, BookOpen, ChefHat, Stethoscope, Droplet, ImagePlus, Package, Mic, Scan, CloudSun, Gauge, Store, MapPin,
  Gamepad2, ShieldAlert, BookHeart, Stars, Ruler, Sparkles, TrendingUp, Calculator, Pill, Syringe, Dumbbell, Brain,
  HeartPulse, type LucideIcon,
} from 'lucide-react';

/** tool_configs.icon (lucide name) -> component. Shared by ToolsHub and the home quick tools. */
export const TOOL_ICONS: Record<string, LucideIcon> = {
  Ruler, Camera, Utensils, ShoppingCart, Shield, Footprints, Timer, Scale, Baby, Briefcase, Volume2, Activity, Heart,
  Wrench, BookOpen, ChefHat, Stethoscope, Droplet, ImagePlus, Package, Mic, Scan, CloudSun, Gauge, Store, MapPin,
  Gamepad2, ShieldAlert, BookHeart, Stars, Calculator, Pill, Syringe, TrendingUp, Dumbbell, Brain, Sparkles, HeartPulse,
};

export const toolIcon = (name?: string | null): LucideIcon => (name && TOOL_ICONS[name]) || Wrench;

export type ToolTone = 'c-peach' | 'c-pink' | 'c-lav' | 'c-blue' | 'c-green' | 'c-yellow' | 'c-coral' | 'c-ink';

/** Pastel tone per tool so the same tool looks the same everywhere. */
const TONES: Record<string, ToolTone> = {
  kick: 'c-coral', contraction: 'c-ink', hospital: 'c-peach', names: 'c-lav', safety: 'c-green', 'blood-pressure': 'c-pink',
  'danger-signs': 'c-peach', 'vitamin-tracker': 'c-yellow', mood: 'c-pink', 'mental-health': 'c-lav', weight: 'c-green',
  whitenoise: 'c-lav', 'cry-translator': 'c-pink', 'vaccine-calendar': 'c-yellow', 'baby-growth': 'c-blue', teething: 'c-yellow',
  'weather-clothing': 'c-blue', doctors: 'c-green', nutrition: 'c-peach', recipes: 'c-yellow', exercise: 'c-green',
  'fetal-growth': 'c-green', 'blood-sugar': 'c-yellow', shopping: 'c-blue', 'maternity-calculator': 'c-green',
  'pregnancy-album': 'c-peach', 'baby-album': 'c-peach', photoshoot: 'c-pink', 'fairy-tale': 'c-lav', 'noise-meter': 'c-blue',
  'preemie-hub': 'c-green', blog: 'c-peach', 'mini-games': 'c-green', cakes: 'c-pink', 'first-aid': 'c-peach',
};
export const toolTone = (id: string): ToolTone => TONES[id] || 'c-blue';
