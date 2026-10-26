export const APP_ENTRY_HOSTS: string[];
export const APP_STORE_URL: string;
export const GOOGLE_PLAY_URL: string;
export const ADMIN_WEB_QUERY: string;
export const ADMIN_WEB_VALUE: string;
export const APP_PACKAGE: string;
export type EntryDecision = 'native' | 'unmanaged' | 'resource' | 'legal' | 'system' | 'brand' | 'admin' | 'moderator' | 'launch';
export interface AppLaunchDestination { path: string; language: string; module?: string }
export function isLegalEntryPath(path: string): boolean;
export function legalDocumentType(path: string): string | null;
export function entryDecision(input: string, options?: { native?: boolean }): EntryDecision;
export function entryPlatform(navigator?: { userAgent?: string; platform?: string; maxTouchPoints?: number }): 'ios' | 'android' | 'mac' | 'desktop';
export function entryLanguage(input: string, fallback?: string): string;
export function appLaunchDestination(input: string): AppLaunchDestination;
export function appLaunchLinks(input: string): { destination: AppLaunchDestination; scheme: string; androidIntent: string; appStore: string; googlePlay: string };
export function safeAdminNext(value: unknown, origin: string): string;
