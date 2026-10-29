import { expect, it } from 'vitest';
import { offersBreastfeeding } from './breastfeeding';

it('offers breastfeeding until the second birthday', () => {
  expect(offersBreastfeeding(0)).toBe(true);
  expect(offersBreastfeeding(23)).toBe(true);
  expect(offersBreastfeeding(24)).toBe(false);
  expect(offersBreastfeeding(null)).toBe(true);
});
