import { type Cake } from '@/hooks/useCakes';
import { tr } from '@/lib/tr';

export type CakeCategoryKey = 'month' | 'milestone' | 'pregnancy' | 'family';
export const CATEGORY_ORDER: CakeCategoryKey[] = ['month', 'milestone', 'pregnancy', 'family'];

export const categoryOf = (cake: Cake): CakeCategoryKey =>
  (CATEGORY_ORDER as string[]).includes(cake.category) ? cake.category as CakeCategoryKey : 'milestone';

export const categoryLabel = (key: CakeCategoryKey) => ({
  month: tr('cakesscreen_cat_month', 'Aylıq tortlar'),
  milestone: tr('cakesscreen_cat_milestone', 'Xüsusi günlər'),
  pregnancy: tr('cakesscreen_cat_pregnancy', 'Hamiləlik'),
  family: tr('cakesscreen_cat_family', 'Ailə və bayram')
})[key];

export const categoryShort = (key: CakeCategoryKey) => ({
  month: tr('cakesscreen_chip_month', 'Aylıq'),
  milestone: tr('cakesscreen_cat_milestone', 'Xüsusi günlər'),
  pregnancy: tr('cakesscreen_cat_pregnancy', 'Hamiləlik'),
  family: tr('cakesscreen_cat_family', 'Ailə və bayram')
})[key];

export const categorySub = (key: CakeCategoryKey) => ({
  month: tr('cakesscreen_cat_month_sub', 'Hər ayın fotosu üçün bento tort'),
  milestone: tr('cakesscreen_cat_milestone_sub', '40 gün, ilk diş, ilk addım, 1 yaş'),
  pregnancy: tr('cakesscreen_cat_pregnancy_sub', 'Gender reveal və sevindirici xəbər'),
  family: tr('cakesscreen_cat_family_sub', 'Ana, əkizlər, bayramlar və adlı tortlar')
})[key];

/** Size, weight and servings written in the description ("10–11 sm, ~400 q, 1–3 nəfərlik"). */
export function cakeSpecs(description: string | null | undefined) {
  const text = description || '';
  const size = text.match(/(\d+(?:\s*[–-]\s*\d+)?)\s*sm\b/i)?.[1];
  const weight = text.match(/(~?\s*\d+(?:[.,]\d+)?)\s*(kq|q)\b/i);
  const people = text.match(/(\d+(?:\s*[–-]\s*\d+)?)\s*nəfər/i)?.[1];
  return {
    size: size ? `${size.replace(/\s+/g, '')} sm` : null,
    weight: weight ? `${weight[1].replace(/\s+/g, '')} ${weight[2]}` : null,
    people: people ? people.replace(/\s+/g, '') : null
  };
}

/** Description without the measurements already shown as chips. */
export const cakeStory = (description: string | null | undefined) =>
  (description || '').replace(/\s*\d+(?:\s*[–-]\s*\d+)?\s*sm,?\s*~?\s*[\d.,]*\s*(?:kq|q)?,?\s*\d*(?:\s*[–-]\s*\d+)?\s*nəfərlik\.?/i, '').trim();

export const FLAVORS = ['Vanil', 'Şokolad', 'Çiyələk', 'Karamel'];
export const FLAVOR_FIELD = 'Dad';

/** Photo box add-on: the bento with six cupcakes in one window box. */
export const PHOTO_BOX = {
  extra: 18,
  field: 'Əlavə',
  value: 'Foto qutusu (+6 kapkeyk)',
  image: 'https://api.anacan.az/storage/v1/object/public/assets/cakes/cake-1793813000-pkg-foto-qutusu.jpg'
};
export const isBento = (cake: Cake) => cake.category === 'month' || /bento/i.test(cake.name || '');

/** Cakes without required fields can go straight to the cart from a card. */
export const canQuickAdd = (cake: Cake) =>
  !(cake.has_custom_fields && Array.isArray(cake.custom_field_labels) && cake.custom_field_labels.length > 0);

export const money = (value: number) => `${Number.isInteger(value) ? value : value.toFixed(2)} ₼`;
