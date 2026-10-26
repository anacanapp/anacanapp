import { describe, expect, it } from 'vitest';
import { applyStoryGesture, fitStoryMedia, hitStoryText, initialStoryScene, parseStoryScene, storyMediaBox, STORY_HEIGHT, STORY_WIDTH, type StoryTextLayer } from './story-editor';

describe('story framing', () => {
  it.each([[4000, 3000], [3000, 4000], [1080, 1920], [5000, 1000]])('starts with the whole %s × %s image visible', (width, height) => {
    const scene = initialStoryScene(width, height);
    const box = storyMediaBox(scene);
    expect(box.width).toBeLessThanOrEqual(STORY_WIDTH);
    expect(box.height).toBeLessThanOrEqual(STORY_HEIGHT);
    expect(box.x).toBe(STORY_WIDTH / 2);
    expect(box.y).toBe(STORY_HEIGHT / 2);
    expect(box.width / box.height).toBeCloseTo(width / height);
  });

  it('can zoom out below the original fitted size and fill the frame without stretching', () => {
    const scene = initialStoryScene(4000, 3000);
    const zoomed = { ...scene, media: { ...scene.media, zoom: 0.5 } };
    expect(storyMediaBox(zoomed).width).toBe(540);
    const filled = storyMediaBox(fitStoryMedia(scene, 'cover'));
    expect(filled.height).toBeCloseTo(STORY_HEIGHT);
    expect(filled.width / filled.height).toBeCloseTo(4 / 3);
    expect(fitStoryMedia(zoomed).media.zoom).toBe(1);
  });

  it('pans and pinches around the gesture center with the same export-space coordinates', () => {
    const scene = initialStoryScene(1080, 1920);
    const panned = applyStoryGesture(scene, null, [{ x: 100, y: 100 }], [{ x: 208, y: 292 }]);
    expect(panned.media.x).toBeCloseTo(0.6);
    expect(panned.media.y).toBeCloseTo(0.6);
    const pinched = applyStoryGesture(scene, null, [{ x: 440, y: 960 }, { x: 640, y: 960 }], [{ x: 340, y: 960 }, { x: 740, y: 960 }]);
    expect(pinched.media).toMatchObject({ x: 0.5, y: 0.5, zoom: 2, rotation: 0 });
  });

  it('fits the rotated photo and transforms a caption independently of the media', () => {
    const scene = initialStoryScene(4000, 3000);
    const rotated = fitStoryMedia({ ...scene, media: { ...scene.media, rotation: 90 } });
    const box = storyMediaBox(rotated);
    expect(box.height).toBeLessThanOrEqual(STORY_WIDTH + 0.01);
    expect(box.width).toBeLessThanOrEqual(STORY_HEIGHT + 0.01);
    const caption: StoryTextLayer = { id: 'text', text: 'Salam, körpəm!', x: 0.5, y: 0.5, size: 60, rotation: 0, color: '#ffffff', background: 'dark', font: 'sans', align: 'center' };
    const changed = applyStoryGesture({ ...scene, texts: [caption] }, caption.id, [{ x: 0, y: 0 }], [{ x: 108, y: 192 }]);
    expect(changed.media).toEqual(scene.media);
    expect(changed.texts[0]).toMatchObject({ x: 0.6, y: 0.6, text: caption.text });
  });

  it('hit-tests the topmost caption, including rotation', () => {
    const boxes = [{ id: 'lower', x: 200, y: 200, width: 200, height: 50, rotation: 0 }, { id: 'upper', x: 200, y: 200, width: 200, height: 50, rotation: 90 }];
    expect(hitStoryText(boxes, { x: 200, y: 200 })).toBe('upper');
    expect(hitStoryText(boxes, { x: 200, y: 280 })).toBe('upper');
    expect(hitStoryText(boxes, { x: 800, y: 800 })).toBeNull();
  });

  it('validates persisted video scenes without treating legacy strings or corrupt data as layouts', () => {
    const scene = initialStoryScene(1920, 1080);
    expect(parseStoryScene(JSON.parse(JSON.stringify(scene)))).toEqual(scene);
    for (const value of [null, 'legacy caption', {}, { ...scene, media: { ...scene.media, zoom: Infinity } }, { ...scene, background: 'url(javascript:bad)' }, { ...scene, texts: new Array(9).fill({}) }]) {
      expect(parseStoryScene(value)).toBeNull();
    }
  });
});
