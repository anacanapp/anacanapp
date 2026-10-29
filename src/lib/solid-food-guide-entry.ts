/** The guide's content is Azerbaijani for now; entry points show it only in that language. */
export const isSolidFoodGuideAvailable = (language: string) => language === 'az';

/** Shown from shortly before six months (about five months) up to four years. */
export const solidFoodGuideRelevant = (ageInMonths: number | null | undefined) =>
  ageInMonths != null && ageInMonths >= 5 && ageInMonths < 48;
