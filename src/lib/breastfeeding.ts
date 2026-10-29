/** Breastfeeding entries are offered until the child's second birthday (WHO: up to 2 years). */
export const BREASTFEEDING_MAX_MONTHS = 24;

export const offersBreastfeeding = (ageInMonths: number | null | undefined): boolean =>
  ageInMonths == null || ageInMonths < BREASTFEEDING_MAX_MONTHS;
