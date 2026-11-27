// Ported from: src/lib/breastfeeding.ts, src/lib/solid-food-guide-entry.ts

/// Breastfeeding entries are offered until the child's second birthday (WHO: up to 2 years).
const int breastfeedingMaxMonths = 24;

bool offersBreastfeeding(int? ageInMonths) => ageInMonths == null || ageInMonths < breastfeedingMaxMonths;

/// Shown from shortly before six months (about five months) up to four years.
bool solidFoodGuideRelevant(int? ageInMonths) => ageInMonths != null && ageInMonths >= 5 && ageInMonths < 48;
