export interface TikTokEventsPlugin {
  /** Initializes the SDK once (credentials come from the native plugin config) or re-enables tracking. */
  start(options: { tracking: boolean; debug?: boolean }): Promise<{ started: boolean; reason?: string }>;
  /** Stops (false) or resumes (true) all SDK traffic without uninstalling it. */
  setEnabled(options: { enabled: boolean }): Promise<void>;
  /** Standard TikTok event name (Registration, Login, Subscribe, ...) with optional flat properties. */
  track(options: { event: string; properties?: Record<string, string | number | boolean> }): Promise<void>;
  identify(options: { externalId: string }): Promise<void>;
  logout(): Promise<void>;
}
export declare const TikTokEvents: TikTokEventsPlugin;
