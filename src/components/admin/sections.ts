import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { componentFor } from './registry';

type SectionProps = { onNavigate?: (section: string) => void };
type Loader = () => Promise<{ default: ComponentType<SectionProps> }>;

// Every Admin*.tsx stays its own lazy chunk (test files and the shell itself excluded).
const files = import.meta.glob<{ default: ComponentType<SectionProps> }>(['./Admin*.tsx', '!./**/*.test.tsx', '!./AdminLayout.tsx']);
const loaders: Record<string, Loader> = Object.fromEntries(Object.entries(files).map(([path, load]) => [path.split('/').pop()!.replace('.tsx', ''), load]));
loaders.RevenueCatDebug = () => import('@/pages/RevenueCatDebug') as Promise<{ default: ComponentType<SectionProps> }>;

const lazyCache = new Map<string, LazyExoticComponent<ComponentType<SectionProps>>>();
const prefetched = new Set<string>();

/** Loader for a section id (aliases resolve to their historical component). */
export function sectionLoader(id: string): Loader | null {
  const component = componentFor(id);
  return component ? loaders[component] ?? null : null;
}

/** React.lazy component for a section; cached so revisits do not remount Suspense. */
export function sectionComponent(id: string) {
  const component = componentFor(id) ?? 'AdminDashboard';
  let cached = lazyCache.get(component);
  if (!cached) {
    const load = loaders[component] ?? loaders.AdminDashboard;
    cached = lazy(load);
    lazyCache.set(component, cached);
  }
  return cached;
}

/** Warm a section's JS chunk (menu/palette hover, focus, touchstart). Safe to call repeatedly. */
export function prefetchSection(id: string) {
  const component = componentFor(id);
  if (!component || prefetched.has(component)) return;
  prefetched.add(component);
  loaders[component]?.().catch(() => prefetched.delete(component));
}

export const hasLoader = (component: string) => typeof loaders[component] === 'function';
