import { describe, expect, it } from 'vitest';
import { storeCampaign, storeUrl } from './store-links';

describe('store links', () => {
  it('names the campaign after the placement', () => {
    expect(storeCampaign('download_page_from_article_card')).toBe('web_download_page_from_article_card');
    expect(storeCampaign('Tool ovulation!')).toBe('web_tool_ovulation');
  });
  it('adds App Store campaign and Google Play referrer parameters', () => {
    const ios = new URL(storeUrl('ios', 'download_page', 'az'));
    expect(ios.searchParams.get('ct')).toBe('web_download_page');
    expect(ios.searchParams.get('mt')).toBe('8');
    const play = new URL(storeUrl('android', 'tool_ovulation', 'kk'));
    expect(play.searchParams.get('id')).toBe('com.atlasoon.anacan');
    const referrer = new URLSearchParams(play.searchParams.get('referrer') || '');
    expect(Object.fromEntries(referrer)).toEqual({ utm_source: 'anacan.az', utm_medium: 'website', utm_campaign: 'web_tool_ovulation', utm_content: 'kk' });
  });
});
