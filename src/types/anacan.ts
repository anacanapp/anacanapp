// Anacan Type Definitions
import { FETAL_SIZE_BY_WEEK } from '@/lib/fetal-size';
import { tr } from '@/lib/tr';

export type LifeStage = 'flow' | 'bump' | 'mommy' | 'partner';

export type UserRole = 'woman' | 'partner';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  lifeStage: LifeStage;
  avatarUrl?: string;
  partnerCode?: string;
  linkedPartnerId?: string;
  createdAt: Date;
}

export interface CycleData {
  lastPeriodDate: Date;
  cycleLength: number;
  periodLength: number;
  currentDay: number;
  phase: 'menstrual' | 'follicular' | 'ovulation' | 'luteal';
  fertileWindow: {start: Date;end: Date;};
  nextPeriodDate: Date;
}

export interface PregnancyData {
  dueDate: Date;
  lastPeriodDate: Date;
  currentWeek: number;
  currentDay: number;
  trimester: 1 | 2 | 3;
  babySize: {
    fruit: string;
    lengthCm: number;
    weightG: number;
  };
}

export interface BabyData {
  id: string;
  name: string;
  birthDate: Date;
  gender: 'boy' | 'girl';
  ageInDays: number;
  ageInMonths: number;
  avatarUrl?: string;
}

export type DeliveryType = 'natural' | 'cesarean' | 'assisted';

export interface PostpartumData {
  birthDate: Date;
  daysSinceBirth: number;
  week: number;
  deliveryType: DeliveryType | null;
}

export interface DailyLog {
  id: string;
  userId: string;
  date: Date;
  mood?: 1 | 2 | 3 | 4 | 5;
  symptoms?: string[];
  waterIntake?: number;
  temperature?: number;
  notes?: string;
  bleeding?: 'light' | 'medium' | 'heavy' | 'spotting';
}

export interface BabyLog {
  id: string;
  babyId: string;
  type: 'sleep' | 'feed' | 'diaper';
  startTime: Date;
  endTime?: Date;
  feedSide?: 'left' | 'right' | 'bottle';
  diaperType?: 'wet' | 'dirty' | 'both';
  notes?: string;
}

export interface PartnerMission {
  id: string;
  title: string;
  description: string;
  icon: string;
  completed: boolean;
  basedOn?: string; // symptom that triggered this mission
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  icon: string;
  route: string;
  stages: LifeStage[];
}

export const SYMPTOMS = [
{ id: 'headache', label: tr("anacan_bas_agrisi_ff6f4c", "Baş ağrısı"), icon: '🤕' },
{ id: 'cramps', label: tr("anacan_sanci_350c2d", "Sancı"), icon: '😣' },
{ id: 'bloating', label: tr("anacan_siskinlik_7c7923", "Şişkinlik"), icon: '🫄' },
{ id: 'fatigue', label: tr("anacan_yorgunluq_c68d62", "Yorğunluq"), icon: '😴' },
{ id: 'mood_swings', label: tr("anacan_ehval_deyisikliyi_9fa36f", "Əhval dəyişikliyi"), icon: '🎭' },
{ id: 'nausea', label: tr("anacan_urek_bulanmasi_e8f29d", "Ürək bulanması"), icon: '🤢' },
{ id: 'back_pain', label: tr("anacan_bel_agrisi_9e824e", "Bel ağrısı"), icon: '🔙' },
{ id: 'breast_tenderness', label: tr("anacan_dos_hessasligi_326b6d", "Sinə həssaslığı"), icon: '💗' },
{ id: 'acne', label: tr("anacan_sizanaq_0b0664", "Sızanaq"), icon: '😖' },
{ id: 'cravings', label: tr("anacan_istah_54578a", "İştah"), icon: '🍫' }];


export const MOODS = [
{ value: 1, label: tr("anacan_cox_pis_e041c5", "Çox pis"), emoji: '😢' },
{ value: 2, label: 'Pis', emoji: '😔' },
{ value: 3, label: 'Normal', emoji: '😐' },
{ value: 4, label: tr("anacan_yaxsi_9d8595", "Yaxşı"), emoji: '😊' },
{ value: 5, label: tr("anacan_ela_720a0e", "Əla"), emoji: '🥰' }];


/** Fruit names that already have a UI translation key; the others show in Azerbaijani when the daily content is
 *  missing (the hero normally takes the translated fruit from pregnancy_daily_content). */
const FRUIT_NAME_TR: Record<string, string> = {
  'Xaşxaş toxumu': tr("anacan_xasxas_toxumu_c36b2c", "Xa\u015Fxa\u015F toxumu"),
  'Əncir': tr("anacan_encir_2bf440", "\u018Fncir"),
  'Şaftalı': tr("anacan_saftali_24c015", "\u015Eaftal\u0131"),
  'Qarğıdalı': tr("anacan_qargidali_c6cab2", "Qar\u011F\u0131dal\u0131"),
  'Badımcan': tr("anacan_badimcan_376039", "Bad\u0131mcan"),
  'Kahı': tr("anacan_kahi_wk36", "Kah\u0131"),
  'Qarpız': tr("anacan_qarpiz_517288", "Qarp\u0131z"),
};

/** Fallback size per completed week (4-42), from src/lib/fetal-size.ts (Hadlock 1991 / CRL / crown-heel). */
export const FRUIT_SIZES: Record<number, {fruit: string;emoji: string;lengthCm: number;weightG: number;}> = Object.fromEntries(
  Object.entries(FETAL_SIZE_BY_WEEK).map(([week, row]) => [Number(week), {
    fruit: FRUIT_NAME_TR[row.fruit] ?? row.fruit, emoji: row.emoji, lengthCm: row.lengthCm, weightG: row.weightG
  }])
);