import { describe, expect, it } from 'vitest';
import copy from '../../scripts/i18n/community-moderation-copy.json';
import { APP_LANGUAGE_CODES } from './app-languages';
import { AD_REASONS, isHeldPost, moderationError, moderationReason } from './community-moderation';
import { moderationText } from './community-moderation-i18n';
import { intentFromPushData } from './pushNav';

describe('advertising moderation language contract', () => {
  it.each(APP_LANGUAGE_CODES)('has complete status, decision and reason copy in %s', language => {
    const values = copy.languages[language];
    expect(Object.keys(values).sort()).toEqual(Object.keys(copy.languages.en).sort());
    for (const value of Object.values(values)) expect(typeof value === 'string' && value.trim().length > 0).toBe(true);
    expect(values.email_destination).toContain('jamil@anacan.az');
    for (const reason of AD_REASONS) expect(moderationReason(reason, language)).toBe(values[`reason_${reason}`]);
    for (const state of ['checking', 'review', 'approved', 'rejected'] as const) expect(moderationText(`${state}_body`, language)).toBe(values[`${state}_body`]);
    if (language !== 'en') expect(values.review_body).not.toBe(copy.languages.en.review_body);
  });
  it('routes a moderation push to the private post with a validated identifier', () => {
    const id = '826fc991-8d57-4b29-8566-9e7b4f1b1d5d';
    expect(intentFromPushData({ type: 'community_moderation', postId: id })).toEqual({ tab: 'community', communityTarget: { postId: id } });
    expect(intentFromPushData({ type: 'community_moderation', postId: 'https://example.invalid' })).toEqual({ tab: 'community' });
  });
  it('holds checking/review/rejected posts and distinguishes conflict from installation-unavailable', () => {
    for (const state of ['checking', 'review', 'rejected']) expect(isHeldPost(state)).toBe(true);
    for (const state of [null, undefined, 'approved']) expect(isHeldPost(state)).toBe(false);
    expect(moderationError({ code: 'PGRST202' }, 'az')).toBe(copy.languages.az.unavailable);
    expect(moderationError({ code: '40001' }, 'az')).toBe(copy.languages.az.conflict);
  });
});
