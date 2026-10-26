/**
 * Mixpanel Analytics — DISABLED (performance).
 *
 * Root-caused as a meaningful contributor to app slowness:
 *  - `initMixpanel()` was called eagerly at module scope in main.tsx, BEFORE
 *    React even renders. Because of that, Rollup statically bundled the full
 *    `mixpanel-browser` SDK (~1.1MB raw / ~220KB gzip, including the rrweb
 *    session-replay engine) into the app's ROOT entry chunk — every other
 *    `import('@/lib/mixpanel')` call site elsewhere in the app only *looked*
 *    lazy; Rollup rewrote them to read off the already-loaded main chunk, so
 *    nothing was actually deferred. This added real parse/compile weight to
 *    every cold start, on every device (incl. low-end Android WebViews).
 *  - `record_sessions_percent: 100` ran full rrweb session-replay recording
 *    (continuous DOM-mutation/mouse/scroll/input capture) on 100% of
 *    sessions, for the app's entire lifetime — an ongoing main-thread/memory
 *    cost layered on top of a framer-motion-heavy, feed-heavy UI.
 *  - `autocapture: { click, input, scroll, submit }` added global window-level
 *    listeners for every DOM interaction app-wide, for the whole session.
 *
 * All exported function SIGNATURES below are kept identical to before, so
 * every existing call site (AuthContext.tsx, analytics.ts,
 * useScreenAnalytics.ts) keeps working unchanged — they just become no-ops.
 * The `mixpanel-browser` package is no longer imported anywhere in this file,
 * so it is fully excluded from the production bundle (verify via build output
 * — no `mixpanel`/`rrweb` chunk should appear).
 *
 * To re-enable: restore the previous implementation from git history
 * (commit before this one), and strongly consider lowering
 * `record_sessions_percent` well below 100 and dropping `autocapture` before
 * doing so again.
 */

const MIXPANEL_DISABLED_LOGGED = { done: false };

const noteDisabledOnce = () => {
  if (import.meta.env.DEV && !MIXPANEL_DISABLED_LOGGED.done) {
    MIXPANEL_DISABLED_LOGGED.done = true;
    console.log('🔮 Mixpanel is disabled (performance) — see src/lib/mixpanel.ts');
  }
};

/**
 * Initialize Mixpanel — no-op (disabled for performance, see file header).
 */
export const initMixpanel = () => {
  noteDisabledOnce();
};

/**
 * Identify user and set profile properties — no-op (disabled).
 */
export const identifyUser = (_userId: string, _properties?: Record<string, any>) => {
  noteDisabledOnce();
};

/**
 * Update user profile properties — no-op (disabled).
 */
export const setUserProfile = (_properties: Record<string, any>) => {
  noteDisabledOnce();
};

/**
 * Register super properties (attached to ALL future events) — no-op (disabled).
 */
export const setSuperProperties = (_properties: Record<string, any>) => {
  noteDisabledOnce();
};

/**
 * Reset on logout — no-op (disabled).
 */
export const resetMixpanel = () => {
  noteDisabledOnce();
};

/**
 * Track custom event — no-op (disabled).
 */
export const trackMixpanelEvent = (_eventName: string, _properties?: Record<string, any>) => {
  noteDisabledOnce();
};

/**
 * Track page/screen view — no-op (disabled).
 */
export const trackPageView = (_pageName: string, _properties?: Record<string, any>) => {
  noteDisabledOnce();
};

/**
 * Increment a numeric user property (e.g. tool_uses, messages_sent) — no-op (disabled).
 */
export const incrementUserProperty = (_property: string, _value: number = 1) => {
  noteDisabledOnce();
};

/**
 * Track revenue event — no-op (disabled).
 */
export const trackRevenue = (_amount: number, _properties?: Record<string, any>) => {
  noteDisabledOnce();
};

/**
 * Time an event (call before the action, then track normally after) — no-op (disabled).
 */
export const timeEvent = (_eventName: string) => {
  noteDisabledOnce();
};

// ─────────────────────────────────────────
// Pre-built event helpers for Product/Growth/Marketing
// (kept for API compatibility — all route through the no-ops above)
// ─────────────────────────────────────────

export const mpEvents = {
  // ── Onboarding & Auth ──
  signUp: (method: string) => {
    trackMixpanelEvent('Sign Up', { method });
    incrementUserProperty('sign_up_count');
  },
  login: (method: string) => {
    trackMixpanelEvent('Login', { method });
    incrementUserProperty('login_count');
  },
  onboardingCompleted: (lifeStage: string) => {
    trackMixpanelEvent('Onboarding Completed', { life_stage: lifeStage });
  },

  // ── Tool Usage (Product) ──
  toolOpened: (toolId: string, toolName: string) => {
    trackMixpanelEvent('Tool Opened', { tool_id: toolId, tool_name: toolName });
    incrementUserProperty('tools_opened');
  },
  toolUsed: (toolId: string, action: string, metadata?: Record<string, any>) => {
    trackMixpanelEvent('Tool Used', { tool_id: toolId, action, ...metadata });
    incrementUserProperty('tools_used');
  },

  // ── AI (Product) ──
  aiChatStarted: (chatType: string) => {
    trackMixpanelEvent('AI Chat Started', { chat_type: chatType });
    incrementUserProperty('ai_chats_started');
  },
  aiChatMessage: (chatType: string) => {
    trackMixpanelEvent('AI Chat Message', { chat_type: chatType });
    incrementUserProperty('ai_messages_sent');
  },

  // ── Content (Growth) ──
  blogRead: (postId: string, category: string, title?: string) => {
    trackMixpanelEvent('Blog Read', { post_id: postId, category, title });
    incrementUserProperty('blogs_read');
  },
  blogLiked: (postId: string) => {
    trackMixpanelEvent('Blog Liked', { post_id: postId });
  },
  blogSaved: (postId: string) => {
    trackMixpanelEvent('Blog Saved', { post_id: postId });
  },
  recipeViewed: (recipeId: string, title?: string) => {
    trackMixpanelEvent('Recipe Viewed', { recipe_id: recipeId, title });
    incrementUserProperty('recipes_viewed');
  },

  // ── Community (Growth) ──
  postCreated: (groupId?: string) => {
    trackMixpanelEvent('Community Post Created', { group_id: groupId });
    incrementUserProperty('posts_created');
  },
  postLiked: (postId: string) => {
    trackMixpanelEvent('Community Post Liked', { post_id: postId });
  },

  // ── Health Tracking (Product) ──
  waterLogged: (glasses: number) => {
    trackMixpanelEvent('Water Logged', { glasses });
    incrementUserProperty('water_logs');
  },
  symptomLogged: (count: number) => {
    trackMixpanelEvent('Symptom Logged', { symptom_count: count });
    incrementUserProperty('symptom_logs');
  },
  weightLogged: (weight: number) => {
    trackMixpanelEvent('Weight Logged', { weight });
  },
  kickCounted: (count: number) => {
    trackMixpanelEvent('Kick Counted', { count });
    incrementUserProperty('kick_counts');
  },
  contractionTimed: (durationSec: number) => {
    trackMixpanelEvent('Contraction Timed', { duration_sec: durationSec });
  },
  mealLogged: (mealType: string, calories: number) => {
    trackMixpanelEvent('Meal Logged', { meal_type: mealType, calories });
    incrementUserProperty('meals_logged');
  },
  exerciseCompleted: (exerciseId: string, durationMin: number) => {
    trackMixpanelEvent('Exercise Completed', { exercise_id: exerciseId, duration_min: durationMin });
  },
  moodLogged: (moodValue: number) => {
    trackMixpanelEvent('Mood Logged', { mood_value: moodValue });
    incrementUserProperty('mood_logs');
  },

  // ── Premium / Revenue (Marketing) ──
  paywallShown: (source: string) => {
    trackMixpanelEvent('Paywall Shown', { source });
  },
  paywallClicked: (source: string, plan: string) => {
    trackMixpanelEvent('Paywall Clicked', { source, plan });
  },
  premiumSubscribed: (plan: string, amount?: number) => {
    trackMixpanelEvent('Premium Subscribed', { plan });
    setUserProfile({ is_premium: true, premium_plan: plan });
    if (amount) trackRevenue(amount, { plan });
  },
  premiumCancelled: () => {
    trackMixpanelEvent('Premium Cancelled');
    setUserProfile({ is_premium: false });
  },

  // ── Feature-specific (Product) ──
  babyPhotoGenerated: (style: string) => {
    trackMixpanelEvent('Baby Photo Generated', { style });
    incrementUserProperty('photos_generated');
  },
  cryAnalyzed: () => {
    trackMixpanelEvent('Cry Analyzed');
    incrementUserProperty('cry_analyses');
  },
  poopAnalyzed: () => {
    trackMixpanelEvent('Poop Analyzed');
    incrementUserProperty('poop_analyses');
  },
  fairyTaleGenerated: () => {
    trackMixpanelEvent('Fairy Tale Generated');
    incrementUserProperty('fairy_tales_generated');
  },
  breathingExerciseDone: (exerciseId: string) => {
    trackMixpanelEvent('Breathing Exercise Done', { exercise_id: exerciseId });
  },
  whiteNoisePlayed: (soundId: string) => {
    trackMixpanelEvent('White Noise Played', { sound_id: soundId });
  },
  nameSearched: (query: string) => {
    trackMixpanelEvent('Name Searched', { query });
    incrementUserProperty('name_searches');
  },
  partnerLinked: () => {
    trackMixpanelEvent('Partner Linked');
  },
  appointmentCreated: (type: string) => {
    trackMixpanelEvent('Appointment Created', { appointment_type: type });
  },
  shoppingItemAdded: () => {
    trackMixpanelEvent('Shopping Item Added');
    incrementUserProperty('shopping_items_added');
  },

  // ── Notifications (Marketing) ──
  notificationReceived: (type?: string) => {
    trackMixpanelEvent('Notification Received', { notification_type: type });
  },
  notificationClicked: (type?: string) => {
    trackMixpanelEvent('Notification Clicked', { notification_type: type });
  },

  // ── Deeplink (Marketing) ──
  deeplinkOpened: (path: string, source?: string) => {
    trackMixpanelEvent('Deeplink Opened', { path, source });
  },

  // ── Shop / Orders (Revenue) ──
  productViewed: (productId: string, name?: string) => {
    trackMixpanelEvent('Product Viewed', { product_id: productId, name });
  },
  orderPlaced: (orderType: string, amount: number) => {
    trackMixpanelEvent('Order Placed', { order_type: orderType, amount });
    trackRevenue(amount, { order_type: orderType });
  },
};
