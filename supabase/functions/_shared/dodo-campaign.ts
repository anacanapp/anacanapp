// Campaign discounts of the Dodo web checkout (dodo-checkout). Pure helpers, tested in src/lib/dodo-campaign.test.ts.
/** Discount code for a campaign checkout, or null (wrong campaign or plan, outside the window, malformed setting). */
export function campaignDiscount(c: unknown, requested: string, plan: string, now: number): string | null {
  if (!c || typeof c !== 'object') return null;
  const v = c as Record<string, unknown>;
  if (!(now >= Date.parse(String(v.starts_at)) && now < Date.parse(String(v.ends_at)))) return null;
  const codes = v.codes as Record<string, unknown> | undefined;
  if (typeof v.campaign === 'string' && codes && typeof codes === 'object') {
    const code = codes[plan];
    return v.campaign === requested && typeof code === 'string' && /^[A-Za-z0-9_-]{3,32}$/.test(code) ? code : null;
  }
  return v.code === requested && v.plan === plan ? String(v.code) : null;
}

/** Where Dodo returns after a campaign checkout: only an anacan.az campaign page, else the default. */
export function campaignReturnPage(page: unknown): string | null {
  return typeof page === 'string' && /^https:\/\/anacan\.az\/website\/premium\/[a-z0-9-]+\/index\.html$/.test(page) ? page : null;
}
