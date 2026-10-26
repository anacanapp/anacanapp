type Rpc = (name: string, args: Record<string, unknown>) => PromiseLike<{ data: any; error: unknown }>;
/** One account-bound receipt per rendered creative; nothing is persisted locally. */
export function createBrandExposure({ rpc, actor, banner, language, platform, version = 2, now = Date.now }: {
  rpc: Rpc; actor: string; banner: string; language: string; platform: string; version?: 2 | 3; now?: () => number;
}) {
  // v3 creatives (multi-tier, life-stage targeting, audience buckets) use the v2 receipt RPCs.
  const issueRpc = version === 3 ? 'issue_brand_ad_delivery_v2' : 'issue_brand_ad_delivery_v1';
  const eventRpc = version === 3 ? 'record_brand_ad_event_v2' : 'record_brand_ad_event_v1';
  let id = crypto.randomUUID(), pending: Promise<string | null> | null = null;
  let ticket: string | null = null, blocked = false, expires = 0, visible = false, since = 0, disposed = false, measured = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => { if (timer) clearTimeout(timer); timer = undefined; };
  const issue = async (): Promise<string | null> => {
    if (blocked) return null;
    if (ticket && expires > now()) return ticket;
    if (pending) return pending;
    if (ticket) { ticket = null; measured = false; id = crypto.randomUUID(); }
    pending = Promise.resolve(rpc(issueRpc, { p_actor: actor, p_banner: banner, p_exposure: id, p_platform: platform, p_language: language }))
      .then(({ data, error }) => {
        if (error) return null;
        if (!data) { blocked = true; return null; }
        if (data.id !== id || !Number.isFinite(Date.parse(data.expires_at))) return null;
        ticket = data.id; expires = Date.parse(data.expires_at); return ticket;
      }).catch(() => null).finally(() => { pending = null; });
    return pending;
  };
  const schedule = async () => {
    const issued = await issue();
    if (!issued || disposed || !visible || measured) return;
    clear();
    // Start after the server receipt exists so both the visibility assertion and
    // the server's minimum elapsed-time check pass without client clock trust.
    timer = setTimeout(async () => {
      if (disposed || !visible || measured || now() - since < 1000) return;
      const result = await Promise.resolve(rpc(eventRpc, { p_actor: actor, p_delivery: issued, p_event: 'impression', p_visible_ms: Math.min(3600000, now() - since) })).catch(() => ({ data: false, error: true }));
      if (!result.error && result.data === true) measured = true;
    }, 1100);
  };
  return {
    visible(value: boolean) {
      if (disposed || value === visible) return;
      visible = value; clear(); since = value ? now() : 0;
      if (value && !measured) void schedule();
    },
    async click(): Promise<string | null | undefined> {
      // A genuine click can finish after navigation unmounts the slot. SQL still
      // checks this captured actor against the request's current authenticated ID.
      const issued = await issue(); if (!issued) return;
      await Promise.resolve(rpc(eventRpc, { p_actor: actor, p_delivery: issued, p_event: 'click', p_visible_ms: 0 })).catch(() => {});
      return issued;
    },
    dispose() { disposed = true; visible = false; clear(); },
  };
}
