// Anacan Type Definitions
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
{ id: 'breast_tenderness', label: tr("anacan_dos_hessasligi_326b6d", "Döş həssaslığı"), icon: '💗' },
{ id: 'acne', label: tr("anacan_sizanaq_0b0664", "Sızanaq"), icon: '😖' },
{ id: 'cravings', label: tr("anacan_istah_54578a", "İştah"), icon: '🍫' }];


export const MOODS = [
{ value: 1, label: tr("anacan_cox_pis_e041c5", "Çox pis"), emoji: '😢' },
{ value: 2, label: 'Pis', emoji: '😔' },
{ value: 3, label: 'Normal', emoji: '😐' },
{ value: 4, label: tr("anacan_yaxsi_9d8595", "Yaxşı"), emoji: '😊' },
{ value: 5, label: tr("anacan_ela_720a0e", "Əla"), emoji: '🥰' }];


export const FRUIT_SIZES: Record<number, {fruit: string;emoji: string;lengthCm: number;weightG: number;}> = {
  4: { fruit: tr("anacan_xasxas_toxumu_c36b2c", "Xa\u015Fxa\u015F toxumu"), emoji: '🌱', lengthCm: 0.1, weightG: 0.04 },
  5: { fruit: 'Susam', emoji: '🫘', lengthCm: 0.2, weightG: 0.1 },
  6: { fruit: tr("anacan_merci_d0387b", "M\u0259rci"), emoji: '🫛', lengthCm: 0.4, weightG: 0.2 },
  7: { fruit: 'Moruq', emoji: '🫐', lengthCm: 1.0, weightG: 1 },
  8: { fruit: 'Noxud', emoji: '🟢', lengthCm: 1.6, weightG: 2 },
  9: { fruit: 'Gilas', emoji: '🍒', lengthCm: 2.3, weightG: 4 },
  10: { fruit: 'Qoz', emoji: '🌰', lengthCm: 3.1, weightG: 7 },
  11: { fruit: tr("anacan_encir_2bf440", "\u018Fncir"), emoji: '🫒', lengthCm: 4.1, weightG: 10 },
  12: { fruit: 'Limon', emoji: '🍋', lengthCm: 5.4, weightG: 14 },
  13: { fruit: tr("anacan_saftali_24c015", "\u015Eaftal\u0131"), emoji: '🍑', lengthCm: 7.4, weightG: 23 },
  14: { fruit: 'Limon', emoji: '🍋', lengthCm: 8.7, weightG: 43 },
  15: { fruit: 'Alma', emoji: '🍎', lengthCm: 10.1, weightG: 70 },
  16: { fruit: 'Avokado', emoji: '🥑', lengthCm: 11.6, weightG: 100 },
  17: { fruit: 'Armud', emoji: '🍐', lengthCm: 13, weightG: 140 },
  18: { fruit: tr("anacan_biber_ed96af", "Bib\u0259r"), emoji: '🫑', lengthCm: 14.2, weightG: 190 },
  19: { fruit: 'Pomidor', emoji: '🍅', lengthCm: 15.3, weightG: 240 },
  20: { fruit: 'Banan', emoji: '🍌', lengthCm: 16.4, weightG: 300 },
  24: { fruit: tr("anacan_qargidali_c6cab2", "Qar\u011F\u0131dal\u0131"), emoji: '🌽', lengthCm: 21.3, weightG: 600 },
  28: { fruit: tr("anacan_badimcan_376039", "Bad\u0131mcan"), emoji: '🍆', lengthCm: 25.4, weightG: 1000 },
  32: { fruit: tr("anacan_ciyelek_fff292", "\xC7iy\u0259l\u0259k"), emoji: '🍓', lengthCm: 27.4, weightG: 1700 },
  36: { fruit: tr("anacan_kesnis_a9eb3e", "K\u0259\u015Fni\u015F"), emoji: '🥬', lengthCm: 34, weightG: 2600 },
  40: { fruit: tr("anacan_qarpiz_517288", "Qarp\u0131z"), emoji: '🍉', lengthCm: 36, weightG: 3400 }
};