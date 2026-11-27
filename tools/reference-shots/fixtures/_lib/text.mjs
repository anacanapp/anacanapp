/** Multi-language columns: ml('title', [az, en, ru, ar]) -> { title, title_az, title_en, title_ru, title_ar }. */
export const ml = (field, [az, en, ru, ar]) => ({ [field]: az, [`${field}_az`]: az, [`${field}_en`]: en, [`${field}_ru`]: ru, [`${field}_ar`]: ar });
export const uuid = (prefix, n) => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;
