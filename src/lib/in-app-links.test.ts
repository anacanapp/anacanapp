import { describe, expect, it } from 'vitest';
import { inAppDeeplink } from './in-app-links';

describe('inAppDeeplink', () => {
  it('routes app.anacan.az and anacan:// links the router knows', () => {
    expect(inAppDeeplink('https://app.anacan.az/parenting/article/screen-time')).toEqual({ action: 'tool', params: { tool_id: 'parenting', parenting_kind: 'article', parenting_id: 'screen-time' } });
    expect(inAppDeeplink('anacan://premium')).toEqual({ action: 'screen', params: { screen: 'billing' } });
  });
  it('leaves other hosts, unknown paths and credentialed URLs alone', () => {
    expect(inAppDeeplink('https://example.com/parenting/sos/a')).toBeNull();
    expect(inAppDeeplink('http://app.anacan.az/premium')).toBeNull();
    expect(inAppDeeplink('https://api.anacan.az/premium')).toBeNull();
    expect(inAppDeeplink('https://app.anacan.az/unknown')).toBeNull();
    expect(inAppDeeplink('https://user:pw@app.anacan.az/premium')).toBeNull();
    expect(inAppDeeplink('not a url')).toBeNull();
  });
});
