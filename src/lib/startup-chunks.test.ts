import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// 52.0.0 (2026-11-26): a manualChunks vendor split put React and its dependents
// (Radix, framer-motion, react-query) into separate chunks with a cycle between
// them; Radix evaluated before React and every launch stopped on the startup error
// screen ("reading 'useLayoutEffect'"). Keep Rollup's default chunking unless a
// split is proven safe in a real built-app launch, not only in unit tests.
describe('startup chunking', () => {
  it('does not split React-dependent vendors with manualChunks', () => {
    const config = readFileSync(resolve(__dirname, '../../vite.config.ts'), 'utf8');
    expect(config).not.toMatch(/manualChunks\s*[(:]/);
  });
});
