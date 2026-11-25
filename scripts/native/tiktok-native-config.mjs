#!/usr/bin/env node
// Stages the TikTok Business SDK credentials into the generated native capacitor.config.json files
// (ios/App/App and android/app/src/main/assets, both ignored by Git) as plugins.TikTokEvents.
// Source: the private, Git-ignored .env.tiktok.local (or the same variables in the CI environment).
// Runs automatically after every `cap copy` / `cap sync` (package.json "capacitor:copy:after").
// Without credentials the block is removed and the plugin reports "not_configured" (no TikTok traffic).
// Never prints the secrets.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const env = { ...process.env };
const file = join(root, '.env.tiktok.local');
if (existsSync(file)) for (const line of readFileSync(file, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && !line.trim().startsWith('#') && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const ios = { iosAppId: env.TIKTOK_IOS_APP_ID, iosTikTokAppId: env.TIKTOK_IOS_TT_APP_ID, iosAppSecret: env.TIKTOK_IOS_APP_SECRET };
const android = { androidAppId: env.TIKTOK_ANDROID_APP_ID, androidTikTokAppId: env.TIKTOK_ANDROID_TT_APP_ID, androidAppSecret: env.TIKTOK_ANDROID_APP_SECRET };
const complete = o => Object.values(o).every(v => typeof v === 'string' && v.length > 0);
const only = process.env.CAPACITOR_PLATFORM_NAME;
const targets = [
  ['ios', join(root, 'ios/App/App/capacitor.config.json'), ios],
  ['android', join(root, 'android/app/src/main/assets/capacitor.config.json'), android],
];
for (const [platform, path, creds] of targets) {
  if (only && only !== platform) continue;
  if (!existsSync(path)) continue;
  const cfg = JSON.parse(readFileSync(path, 'utf8'));
  cfg.plugins = cfg.plugins || {};
  if (complete(creds)) { cfg.plugins.TikTokEvents = creds; console.log(`[tiktok] ${platform}: credentials staged`); }
  else { delete cfg.plugins.TikTokEvents; console.log(`[tiktok] ${platform}: no credentials, TikTok SDK stays off`); }
  writeFileSync(path, JSON.stringify(cfg, null, '\t') + '\n');
}
