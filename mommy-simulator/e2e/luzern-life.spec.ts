import { expect, test, type Page } from '@playwright/test';
import { CHAPTERS } from '../src/game/content';
import { createState, DEFAULT_AVATAR, reducer } from '../src/game/engine';
import { groceryTotal } from '../src/game/luzern';
import type { GameState, Room } from '../src/game/types';

const KEY = 'mommy-simulator-save-v1';
async function loadFamily(page: Page, overrides: Partial<GameState> = {}) {
  const base = reducer(createState(), { type: 'START', avatar: DEFAULT_AVATAR, chapter: 0, language: 'az' });
  const state = { ...base, settings: { ...base.settings, speed: 2 as const }, ...overrides };
  await page.addInitScript(state => { if (!localStorage.getItem('mommy-simulator-save-v1')) localStorage.setItem('mommy-simulator-save-v1', JSON.stringify(state)); }, state);
  await page.goto('/'); await expect(page.getByTestId('game')).toBeVisible();
  return state;
}
async function liveRoom(page: Page, room?: Room) {
  if (room) await page.getByTestId(`room-${room}`).click();
  await page.getByTestId('mode-room').click();
  const canvas = page.getByTestId('interior-canvas');
  await expect(canvas).toBeVisible(); await expect(canvas).toHaveAttribute('data-ready', 'true');
  if (room) await expect(canvas).toHaveAttribute('data-room', room);
  return canvas;
}
async function completeActivity(page: Page, count: number) {
  await page.getByTestId('mini-complete').click();
  await expect(page.getByTestId('game')).toHaveAttribute('data-actions', String(count));
}
async function travel(page: Page, location: GameState['location']) {
  await page.getByTestId('open-map').click(); await page.getByTestId(`travel-${location}`).click();
  await expect(page.getByTestId('game')).toHaveAttribute('data-location', location);
  await expect(page.locator('.travel-transition')).toHaveCount(0);
}
const saved = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY) as Promise<GameState>;

test('live rooms follow the family, support orbit and pinch, and capture an actual 3D memory', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const base = createState(), chapter = 10;
  await loadFamily(page, { chapter, unlockedChapter: chapter, pregnancy: { ...base.pregnancy, born: true, birthPlan: 'vaginal' },
    missions: { completed: CHAPTERS.slice(0, chapter).flatMap(c => c.mission.steps.map(s => s.id)), quality: {}, rewards: [] } });
  const canvas = await liveRoom(page, 'nursery');
  await expect(canvas).toHaveAttribute('data-family', 'newborn'); await expect(canvas).toHaveAttribute('data-holding', 'true');
  await expect(page.getByTestId('interior-action-feed')).toBeVisible();
  await page.screenshot({ path: 'artifacts/luzern-live-nursery-final.png' });
  for (const room of ['living', 'kitchen', 'bedroom', 'bathroom', 'garden', 'nursery'] as Room[]) {
    await page.getByTestId(`room-${room}`).click(); await expect(canvas).toHaveAttribute('data-room', room);
    expect(await canvas.evaluate(element => element.width > 0 && element.height > 0)).toBe(true);
  }
  await page.getByTestId('room-kitchen').click();
  await expect(page.getByTestId('interior-action-cook')).toBeVisible();
  await page.screenshot({ path: 'artifacts/luzern-live-kitchen-final.png' });
  const hiddenPins = await page.addStyleTag({ content: '.interior-hotspots { visibility: hidden !important; }' });
  const roomBounds = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: roomBounds.width * .5, y: roomBounds.height * .60 } });
  await expect(page.getByRole('dialog')).toBeVisible(); await expect(page.getByRole('dialog').getByRole('heading', { name: 'Sərin su fasiləsi' })).toBeVisible();
  await page.getByTestId('sheet-close').click(); await hiddenPins.evaluate(element => element.remove());
  const initialCamera = await canvas.getAttribute('data-camera'), bounds = (await canvas.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width * .32, bounds.y + bounds.height * .70); await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * .52, bounds.y + bounds.height * .78, { steps: 9 }); await page.mouse.up();
  await expect(canvas).not.toHaveAttribute('data-camera', initialCamera!); await expect(page.getByRole('dialog')).toHaveCount(0);
  const beforeZoom = Number((await canvas.getAttribute('data-camera'))!.split(':')[2]);
  const session = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', spread = 35) => session.send('Input.dispatchTouchEvent', { type,
    touchPoints: type === 'touchEnd' ? [] : [
      { x: bounds.x + bounds.width / 2 - spread, y: bounds.y + bounds.height * .73, id: 1 },
      { x: bounds.x + bounds.width / 2 + spread, y: bounds.y + bounds.height * .73, id: 2 },
    ] });
  await touch('touchStart'); await touch('touchMove', 70); await touch('touchEnd');
  await expect.poll(async () => Number((await canvas.getAttribute('data-camera'))!.split(':')[2])).toBeLessThan(beforeZoom);
  await session.detach();
  await page.getByTestId('photo-mode').click(); await expect(page.locator('.interior-hotspot')).toHaveCount(0);
  await page.getByTestId('capture-photo').click(); await expect(page.getByRole('status')).toContainText('albomuna');
  await page.getByRole('button', { name: 'Bağla', exact: true }).click();
  await page.reload(); await page.getByTestId('nav-album').click();
  await expect(page.locator('.memory-photo > img')).toHaveCount(1);
  expect((await saved(page)).memories.find(memory => memory.kind === 'photo')!.photo!.length).toBeLessThan(900000);
  expect(errors).toEqual([]);
});

test('real-time town destinations have their own market, café, clinic and lakeside scenes', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await loadFamily(page);
  for (const [location, action] of [['market', 'groceries'], ['cafe', 'coffee'], ['clinic', 'scan'], ['lakeside', 'lakesideWalk']] as const) {
    await travel(page, location); const canvas = await liveRoom(page);
    await expect(canvas).toHaveAttribute('data-room', location);
    await expect(page.getByTestId(`interior-action-${action}`)).toBeVisible();
    if (location !== 'clinic') await expect(page.getByTestId('mode-overview')).toHaveCount(0);
  }
  await travel(page, 'home'); const canvas = await liveRoom(page, 'living'); await expect(canvas).toHaveAttribute('data-room', 'living');
  expect(errors).toEqual([]);
});

test('shopping changes CHF and visible supplies, cooking consumes them, and the result survives reload', async ({ page }) => {
  const state = await loadFamily(page, { location: 'market' }), canvas = await liveRoom(page);
  await page.getByTestId('interior-action-groceries').click(); await page.getByTestId('activity-mini').click();
  const basket = { vegetables: 2, milk: 1, bread: 1 };
  for (const [id, quantity] of Object.entries(basket)) for (let n = 0; n < quantity; n++) await page.getByTestId(`grocery-plus-${id}`).click();
  await expect(page.getByTestId('grocery-total')).toHaveText('CHF 16.70'); await page.getByTestId('grocery-checkout').click();
  await expect(page.getByTestId('family-wallet')).toHaveAttribute('data-cash', String(state.household.cash - groceryTotal(basket)));
  await completeActivity(page, 1); await travel(page, 'home'); await liveRoom(page, 'kitchen');
  await expect(canvas).toHaveAttribute('data-pantry', '19');
  await page.getByTestId('interior-action-cook').click(); await page.getByTestId('activity-simple').click();
  await expect(page.getByTestId('game')).toHaveAttribute('data-actions', '2');
  await expect(canvas).toHaveAttribute('data-pantry', '16');
  await page.reload(); await page.getByTestId('nav-day').click();
  await expect(page.getByTestId('pantry-vegetables')).toHaveText('4'); await expect(page.getByTestId('pantry-milk')).toHaveText('3');
  const household = (await saved(page)).household;
  expect(household.cash).toBe(state.household.cash - 1670); expect(household.purchases).toBe(1); expect(household.meals).toBe(1);
});

test('empty supplies open the market route and an unaffordable or full basket cannot be paid', async ({ page }) => {
  const household = createState().household;
  await loadFamily(page, { household: { ...household, cash: 200, groceries: { ...household.groceries, vegetables: 0, bread: 40 } } });
  await liveRoom(page, 'kitchen'); await page.getByTestId('interior-action-cook').click();
  await expect(page.getByTestId('activity-mini')).toBeDisabled(); await expect(page.getByTestId('activity-simple')).toBeDisabled();
  await page.getByTestId('activity-restock').click(); await page.getByTestId('travel-market').click();
  await expect(page.getByTestId('game')).toHaveAttribute('data-location', 'market');
  await liveRoom(page); await page.getByTestId('interior-action-groceries').click(); await page.getByTestId('activity-mini').click();
  await expect(page.getByTestId('grocery-plus-bread')).toBeDisabled();
  await page.getByTestId('grocery-plus-milk').click(); await expect(page.getByTestId('grocery-checkout')).toBeDisabled();
  await expect(page.getByTestId('family-wallet')).toHaveAttribute('data-cash', '200');
  await page.getByTestId('sheet-close').click();
  expect((await saved(page)).household.purchases).toBe(0);
});

test('a partial laundry load is sorted, washed, dried and folded in the bedroom', async ({ page }) => {
  const household = createState().household;
  await loadFamily(page, { household: { ...household, laundry: { dirty: 3, clean: 0, folded: 0 } } });
  const canvas = await liveRoom(page, 'bedroom');
  await page.getByTestId('interior-action-laundry').click(); await page.getByTestId('activity-mini').click();
  await expect(page.getByTestId('laundry-cloth-3')).toHaveCount(0);
  await page.getByTestId('laundry-cloth-0').click(); await page.getByTestId('laundry-basket-1').click();
  await expect(page.getByTestId('laundry-game')).toHaveAttribute('data-stage', '0'); await page.getByTestId('laundry-basket-0').click();
  for (const [i, basket] of [[1, 1], [2, 0]]) { await page.getByTestId(`laundry-cloth-${i}`).click(); await page.getByTestId(`laundry-basket-${basket}`).click(); }
  await page.getByTestId('laundry-program-30').click(); await page.getByTestId('laundry-start-wash').click();
  await expect(page.getByTestId('laundry-game')).toHaveAttribute('data-stage', '3');
  for (let i = 0; i < 3; i++) await page.getByTestId(`laundry-dry-${i}`).click();
  for (let i = 0; i < 3; i++) await page.getByTestId('fold-cloth').click();
  await completeActivity(page, 1); await expect(canvas).toHaveAttribute('data-room', 'bedroom');
  await expect(canvas).toHaveAttribute('data-dirty', '0'); await expect(canvas).toHaveAttribute('data-folded', '3');
  await page.reload(); await page.getByTestId('nav-day').click();
  await expect(page.getByTestId('laundry-dirty-count')).toHaveText('0'); await expect(page.getByTestId('laundry-folded-count')).toHaveText('3');
});

test('cleaning, a meal, a lakeside walk and shared care complete a real family day', async ({ page }) => {
  const household = createState().household;
  const state = await loadFamily(page, { day: 2, household: { ...household, cleanliness: 30, weather: 'cloudy' } });
  const canvas = await liveRoom(page, 'living'); await expect(canvas).toHaveAttribute('data-dust', '4');
  await page.getByTestId('interior-action-clean').click(); await page.getByTestId('activity-mini').click();
  const surface = page.getByTestId('cleaning-surface'), r = (await surface.boundingBox())!;
  await page.mouse.move(r.x + r.width * .17, r.y + r.height * .30); await page.mouse.down();
  for (const [x, y] of [[42, 54], [66, 39], [76, 74], [28, 79], [88, 23]]) await page.mouse.move(r.x + r.width * x / 100, r.y + r.height * y / 100, { steps: 5 });
  await page.mouse.up(); await completeActivity(page, 1); await expect(canvas).toHaveAttribute('data-dust', '3');
  await liveRoom(page, 'kitchen'); await page.getByTestId('interior-action-cook').click(); await page.getByTestId('activity-simple').click();
  await expect(page.getByTestId('game')).toHaveAttribute('data-actions', '2');
  await travel(page, 'lakeside'); await liveRoom(page); await page.getByTestId('interior-action-lakesideWalk').click(); await page.getByTestId('activity-mini').click();
  for (let i = 0; i < 3; i++) await page.getByTestId(`lake-find-${i}`).click(); await completeActivity(page, 3);
  await travel(page, 'home'); await liveRoom(page, 'living'); await page.getByTestId('room-actions-toggle').click(); await page.getByTestId('room-tray-help').click();
  await page.getByTestId('activity-simple').click(); await expect(page.getByTestId('game')).toHaveAttribute('data-actions', '4');
  await page.getByTestId('nav-day').click(); await expect(page.getByTestId('claim-life-day')).toBeEnabled();
  const coins = (await saved(page)).coins; await page.getByTestId('claim-life-day').click(); await expect(page.getByTestId('claim-life-day')).toBeDisabled();
  await expect.poll(async () => (await saved(page)).coins).toBe(coins + 45);
  await page.getByTestId('finish-day').click(); await expect(page.getByTestId('game')).toHaveAttribute('data-day', '3');
  await expect(canvas).toHaveAttribute('data-dirty', String(state.household.laundry.dirty + 3));
  await page.getByTestId('nav-day').click(); await expect(page.getByTestId('claim-life-day')).toBeDisabled();
});

test('live-room controls and daily panels fit small phones, tablets and landscape', async ({ page }) => {
  await loadFamily(page); await liveRoom(page, 'kitchen');
  for (const [width, height] of [[320, 700], [360, 800], [430, 932], [768, 1024], [1280, 800], [932, 430]]) {
    await page.setViewportSize({ width, height });
    const controls = await page.evaluate(() => {
      const canvas = document.querySelector('[data-testid="interior-canvas"]')!.getBoundingClientRect();
      const roomTabs = document.querySelector('.luzern-room-tabs')!.getBoundingClientRect();
      return { horizontal: document.documentElement.scrollWidth > innerWidth, canvasVisible: canvas.width > 0 && canvas.height > 160,
        tabsFit: roomTabs.left >= 0 && roomTabs.right <= innerWidth };
    });
    expect(controls, `${width}×${height}`).toEqual({ horizontal: false, canvasVisible: true, tabsFit: true });
    await page.getByTestId('nav-day').click();
    const panel = await page.evaluate(() => { const content = document.querySelector('.sheet-content')!; return content.scrollWidth <= content.clientWidth + 1; });
    expect(panel).toBe(true); await page.getByTestId('sheet-close').click();
  }
});
