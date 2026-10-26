import type { CustomerIoDataInPlugin } from '@anacan/customerio-data-in';
import type { CustomerIoConfig } from './customerio-config';
import type { AnalyticsScreen } from './analytics-screen';

type Identity = { userId: string; backend: string; language: string; consent: boolean };
const screenName = /^[A-Za-z][A-Za-z0-9 _-]{0,79}$/;

/** Serializes identity changes and events so a delayed login/post cannot track
 * against another account. Only fixed behavioral fields leave the app. */
export function createCustomerIoTracking(config: CustomerIoConfig | null, load: () => Promise<CustomerIoDataInPlugin>, currentScreen: () => AnalyticsScreen | null = () => null) {
  let plugin: CustomerIoDataInPlugin | null = null;
  let initialization: Promise<CustomerIoDataInPlugin> | null = null;
  let desired: Identity | null = null;
  let revision = 0;
  let identified: string | null = null;
  let identifiedTraits = '';
  let lastScreen: number | null = null, manualScreen = 0;
  let pending = Promise.resolve();
  const sentPosts = new Set<string>();
  const owner = (identity: Identity | null) => identity ? `${identity.backend}:${identity.userId}` : null;
  const queue = (task: () => Promise<void>) => {
    // Optional analytics must not break auth, navigation, or a completed mutation.
    pending = pending.then(task).catch(() => {});
    return pending;
  };
  const initialize = () => {
    if (!initialization) initialization = load().then(async loaded => {
      await loaded.initialize(config!);
      plugin = loaded;
      return loaded;
    }).catch(() => { initialization = null; throw new Error('CUSTOMERIO_UNAVAILABLE'); });
    return initialization;
  };
  const sendScreen = async (sdk: CustomerIoDataInPlugin, screen: AnalyticsScreen) => {
    if (lastScreen === screen.id || !screenName.test(screen.title)) return;
    await sdk.screen({ title: screen.title, properties: { environment: config!.environment,
      ...(screen.category && screenName.test(screen.category) ? { screen_class: screen.category } : {}) } });
    lastScreen = screen.id;
  };

  return {
    setIdentity(identity: Identity | null): Promise<void> {
      const next = config && identity?.consent && identity.userId && identity.backend ? { ...identity } : null;
      if (owner(next) !== owner(desired)) revision++;
      desired = next;
      const version = revision;
      return queue(async () => {
        if (version !== revision) return;
        if (!next) {
          if (plugin) await plugin.reset();
          identified = null; identifiedTraits = ''; lastScreen = null;
          return;
        }
        const sdk = await initialize();
        if (version !== revision || owner(next) !== owner(desired)) return;
        const key = owner(next)!;
        const language = /^[a-z]{2}$/.test(next.language) ? next.language : 'en';
        const traits = { language, environment: config!.environment };
        const serialized = JSON.stringify(traits);
        if (identified === key && identifiedTraits === serialized) return;
        if (identified && identified !== key) { await sdk.reset(); identified = null; lastScreen = null; }
        if (version !== revision) return;
        await sdk.identify({ userId: next.userId, traits });
        identified = key; identifiedTraits = serialized;
        // The screen may mount before the consent/auth query completes. Emit the
        // screen that is visible now, not a history of pre-consent navigation.
        const active = currentScreen();
        if (version === revision && active) await sendScreen(sdk, active);
      });
    },
    postCreated(userId: string, backend: string, operationId: string): Promise<void> {
      const key = owner(desired), version = revision;
      if (!key || key !== `${backend}:${userId}` || !operationId) return Promise.resolve();
      const eventKey = `${key}:${operationId}`;
      return queue(async () => {
        if (!plugin || version !== revision || identified !== key || sentPosts.has(eventKey)) return;
        await plugin.track({ name: 'community_post_created', properties: { environment: config!.environment, entry_point: 'community' } });
        sentPosts.add(eventKey);
        if (sentPosts.size > 500) sentPosts.delete(sentPosts.values().next().value!);
      });
    },
    screen(title: string, category?: string): Promise<void> {
      const key = owner(desired), version = revision;
      if (!key || !screenName.test(title)) return Promise.resolve();
      const active = currentScreen();
      const screen = active?.title === title ? active : { id: --manualScreen, title, category };
      return queue(async () => {
        if (!plugin || version !== revision || identified !== key) return;
        if (screen.id > 0 && currentScreen()?.id !== screen.id) return;
        await sendScreen(plugin, screen);
      });
    },
  };
}
