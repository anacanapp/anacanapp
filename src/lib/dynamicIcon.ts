import type { LucideIcon } from 'lucide-react';
import {
  Zap, Shield, Sparkles, Crown, Heart, Star, Check, Bell, Baby, Calendar,
  Gift, Lock, Camera, Music, BookOpen, Utensils, Pill, Activity, Truck,
  CreditCard, Package, MapPin, Phone, MessageCircle, Sun, Moon, Droplets,
  Smile, Users, Timer, FileText, Wallet, BadgeCheck, Send } from
'lucide-react';

/**
 * DB-dən gələn ikon adları üçün YÜNGÜL xəritə.
 *
 * Əvvəllər `import { icons } from 'lucide-react'` istifadə olunurdu —
 * bu, BÜTÜN ~1500 ikonu bundle-a salırdı (PremiumModal chunk-ı 592KB idi).
 * Admin panelində istifadə olunan adlar bu siyahıya salınmalıdır.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  Zap, Shield, Sparkles, Crown, Heart, Star, Check, Bell, Baby, Calendar,
  Gift, Lock, Camera, Music, BookOpen, Utensils, Pill, Activity, Truck,
  CreditCard, Package, MapPin, Phone, MessageCircle, Sun, Moon, Droplets,
  Smile, Users, Timer, FileText, Wallet, BadgeCheck, Send
};

/** Ad → ikon komponenti; tapılmasa fallback (default: Sparkles). */
export function getDynamicIcon(name?: string | null, fallback: LucideIcon = Sparkles): LucideIcon {
  if (!name) return fallback;
  return ICON_MAP[name] || fallback;
}
