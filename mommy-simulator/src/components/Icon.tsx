import { Activity, Baby, Bath, BedDouble, BookHeart, BookOpen, Camera, Check, ChevronDown, ChevronLeft, ChevronRight,
  CircleHelp, Cloud, Coins, CookingPot, Download, Flower2, Footprints, Gift, HandHeart, Heart, Home, Leaf,
  Menu, Moon, Music2, Package, Palette, PartyPopper, Pause, PencilLine, Play, Plus, Rainbow, RotateCw, Search,
  Settings2, Share2, Shirt, Smile, Sofa, Sparkles, Star, Sun, Trash2, Trophy, Upload, Users, Utensils, Volume2,
  VolumeX, Waves, Wind, X, Droplets, Blocks, CheckCheck, ArrowRight, LockKeyhole, LoaderCircle, RefreshCw,
  Maximize2, Circle, NotebookPen, Milk, MapPin, CalendarDays, ClipboardList, HeartPulse, Phone,
  ScanLine, Hammer, Car, Timer, Stethoscope, FlaskConical, Clock3, Move, Scissors, Coffee, Carrot, Apple, Croissant,
  WashingMachine, SprayCan, CloudRain, Wallet, Map, type LucideIcon } from 'lucide-react';

const icons: Record<string, LucideIcon> = {
  baby: Baby, bath: Bath, bed: BedDouble, book: BookOpen, bookheart: BookHeart, camera: Camera, check: Check,
  down: ChevronDown, left: ChevronLeft, right: ChevronRight, cloud: Cloud, coins: Coins, cooking: CookingPot,
  download: Download, flower: Flower2, footprints: Footprints, gift: Gift, hands: HandHeart, heart: Heart,
  home: Home, leaf: Leaf, menu: Menu, moon: Moon, music: Music2, bag: Package, palette: Palette,
  party: PartyPopper, pause: Pause, pen: PencilLine, play: Play, plus: Plus, rainbow: Rainbow,
  rotate: RotateCw, search: Search, settings: Settings2, share: Share2, shirt: Shirt, smile: Smile,
  sofa: Sofa, sparkles: Sparkles, star: Star, sun: Sun, trash: Trash2, trophy: Trophy, upload: Upload,
  users: Users, utensils: Utensils, volume: Volume2, mute: VolumeX, waves: Waves, wind: Wind, close: X,
  droplet: Droplets, blocks: Blocks, completed: CheckCheck, arrow: ArrowRight, lock: LockKeyhole,
  loading: LoaderCircle, refresh: RefreshCw, maximize: Maximize2, circle: Circle, notebook: NotebookPen,
  bottle: Milk, energy: Activity, help: CircleHelp,
  map: MapPin, calendar: CalendarDays, clipboard: ClipboardList, heartpulse: HeartPulse, phone: Phone,
  scan: ScanLine, hammer: Hammer, car: Car, timer: Timer, doctor: Stethoscope, test: FlaskConical, clock: Clock3,
  stretch: Move, scissors: Scissors, activity: HeartPulse,
  coffee: Coffee, carrot: Carrot, apple: Apple, bread: Croissant, laundry: WashingMachine, clean: SprayCan, rain: CloudRain, wallet: Wallet, town: Map,
};

export function Icon({ name, size = 20, className = '', stroke = 1.8 }: { name: string; size?: number; className?: string; stroke?: number }) {
  const Component = icons[name] ?? Sparkles;
  return <Component size={size} strokeWidth={stroke} className={className} aria-hidden="true" />;
}
