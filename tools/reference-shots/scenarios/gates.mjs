// Gate sequence for a fresh install (persona new-user): language -> country -> intro -> auth.
// The brand splash is transient (1.5 s timer) and is not captured.
export default [
  {
    id: 'gate.first-run', persona: 'new-user',
    async steps(page, h) {
      await page.locator('[data-lang]').first().waitFor({ timeout: 30000 });
      await h.shot('language');
      await page.locator(`[data-lang="${h.lang}"]`).click();
      await page.locator('button', { hasText: 'Continue' }).last().click();
      await page.getByRole('button', { name: /^\W*(AZ|Azərbaycan|Azerbaijan|Азербайджан|أذربيجان)\W*$/ }).first().waitFor({ timeout: 15000 });
      await h.shot('country');
      // Choosing the country completes the step; non-az languages reload the app once (InitialLanguageScreen).
      await page.getByRole('button', { name: /^\W*(AZ|Azərbaycan|Azerbaijan|Азербайджан|أذربيجان)\W*$/ }).first().click();
      await page.locator('.onb-primary').first().waitFor({ timeout: 30000 });
      await h.shot('intro');
      await page.locator('.onb-primary').first().click();
      await h.ready();
      await h.shot('auth');
    },
  },
];
