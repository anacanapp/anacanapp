import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { CHAPTERS } from '../src/game/content';
import { createState, DEFAULT_AVATAR, reducer } from '../src/game/engine';
import { BIRTH_CHAPTER } from '../src/game/scenario';
import type { GameState } from '../src/game/types';

async function loadGame(page: Page, chapter = 0, partial = 0, birthPlan: GameState['pregnancy']['birthPlan'] = 'vaginal') {
  const base = reducer(createState(), { type: 'START', avatar: DEFAULT_AVATAR, chapter: 0, language: 'az' });
  const completed = CHAPTERS.slice(0, chapter).flatMap(chapter => chapter.mission.steps.map(step => step.id));
  completed.push(...CHAPTERS[chapter].mission.steps.slice(0, partial).map(s => s.id));
  const step = CHAPTERS[chapter].mission.steps[partial];
  const state: GameState = { ...base, chapter, unlockedChapter: chapter, location: step?.location ?? 'home',
    pregnancy: { ...base.pregnancy, birthPlan, born: chapter >= 9 },
    missions: { completed, quality: Object.fromEntries(completed.map(id => [id, 80])), rewards: CHAPTERS.slice(0, chapter).map(c => c.id) } };
  await page.addInitScript(state => { if (!localStorage.getItem('mommy-simulator-save-v1')) localStorage.setItem('mommy-simulator-save-v1', JSON.stringify(state)); }, state);
  await page.goto('/'); await expect(page.getByTestId('game')).toBeVisible();
  await expect(page.getByTestId('room-artwork')).toBeVisible();
}

async function openMission(page: Page) {
  await page.getByTestId('mission-widget').click();
  const button = page.getByTestId('activity-mini');
  if (await button.isVisible()) await button.click();
}

async function finishScene(page: Page, count: number) {
  await page.getByTestId('mini-complete').click();
  await expect(page.getByTestId('game')).toHaveAttribute('data-actions', String(count), { timeout: 30000 });
}

async function cook(page: Page) {
  for (const i of [0, 1, 2, 3]) await page.getByTestId(`ingredient-${i}`).click();
  const board = page.getByTestId('chopping-board'), r = (await board.boundingBox())!;
  for (let i = 0; i < 4; i++) {
    await page.mouse.move(r.x + 25, r.y + 85 + i * 12); await page.mouse.down();
    await page.mouse.move(r.x + r.width - 25, r.y + 85 + i * 12, { steps: 3 }); await page.mouse.up();
    if (!await board.isVisible()) break;
  }
  await expect(page.getByTestId('stove-start')).toBeVisible();
  await page.getByTestId('stove-start').click();
  await page.getByTestId('stove-heat').fill('52');
  await expect(page.getByTestId('cooking-serve')).toBeVisible({ timeout: 20000 });
  await page.getByTestId('cooking-serve').click();
}

test('ordered pregnancy story plays the test, four-stage meal and next chapter', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await page.getByTestId('welcome-start').click();
  await page.getByTestId('avatar-name').fill('Leyla');
  await page.getByRole('button', { name: 'Trikotaj', exact: true }).click();
  await page.getByTestId('avatar-next').click(); await page.getByTestId('begin-story').click();
  await page.getByTestId('chapter-ready').click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'artifacts/v2-world-final.png' });
  await page.getByTestId('nav-tasks').click(); await page.waitForTimeout(350);
  await page.screenshot({ path: 'artifacts/v2-missions-final.png' });
  await page.getByTestId('mission-play').click(); await page.getByTestId('activity-mini').click();
  await page.getByTestId('test-next').click(); await page.getByTestId('test-next').click();
  await expect(page.getByTestId('test-finish')).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: 'artifacts/v2-test-positive.png' });
  await page.getByTestId('test-finish').click(); await finishScene(page, 1);
  await openMission(page); await cook(page); await page.screenshot({ path: 'artifacts/v2-cooking-complete.png' }); await finishScene(page, 2);
  await openMission(page); await page.getByTestId('activity-simple').click();
  await expect(page.getByTestId('game')).toHaveAttribute('data-actions', '3', { timeout: 30000 });
  await openMission(page); await page.getByTestId('activity-simple').click();
  await expect(page.getByTestId('game')).toHaveAttribute('data-actions', '4', { timeout: 30000 });
  await page.getByTestId('nav-tasks').click(); await page.getByTestId('claim-mission').click();
  await page.getByTestId('advance-chapter').click(); await page.getByTestId('chapter-ready').click();
  await expect(page.getByTestId('game')).toHaveAttribute('data-chapter', '1');
  expect(errors).toEqual([]);
});

test('clinic travel and ultrasound play require a focused probe and persist a scan', async ({ page }) => {
  await loadGame(page, 1, 1);
  await page.getByTestId('open-map').click(); await page.getByTestId('travel-clinic').click();
  await expect(page.getByTestId('game')).toHaveAttribute('data-location', 'clinic');
  await page.waitForTimeout(600); await page.screenshot({ path: 'artifacts/v2-clinic.png' });
  await openMission(page);
  await expect(page.getByTestId('scan-pad')).toBeVisible({ timeout: 15000 });
  const r = (await page.getByTestId('scan-pad').boundingBox())!;
  const targets = [[60, 40, 58], [37, 64, 42], [68, 63, 68]];
  for (const [x, y, depth] of targets) {
    await page.getByTestId('scan-pad').click({ position: { x: r.width * x / 100, y: r.height * y / 100 } });
    await page.getByTestId('scan-depth').fill(String(depth));
    await expect(page.getByTestId('scan-capture')).toBeEnabled();
    await page.screenshot({ path: 'artifacts/v2-ultrasound.png' });
    await page.getByTestId('scan-capture').click();
  }
  await finishScene(page, 1); await page.reload();
  await expect(page.getByTestId('game')).toHaveAttribute('data-actions', '1');
  await page.getByTestId('nav-album').click();
  await expect(page.getByRole('dialog').getByRole('button', { name: /Ultrasəs müayinəsi/ })).toBeVisible();
});

test('crib assembly requires rotation and real drag-and-drop placement', async ({ page }) => {
  await loadGame(page, 6);
  await openMission(page); await expect(page.getByTestId('puzzle-board')).toBeVisible();
  await page.screenshot({ path: 'artifacts/v2-crib-puzzle.png' });
  for (const id of ['head', 'base', 'foot', 'rail']) {
    if (id === 'head' || id === 'foot') await page.getByTestId(`rotate-${id}`).click();
    const piece = (await page.getByTestId(`piece-${id}`).boundingBox())!;
    const slot = (await page.getByTestId(`slot-${id}`).boundingBox())!;
    await page.mouse.move(piece.x + piece.width / 2, piece.y + 30); await page.mouse.down();
    await page.mouse.move(slot.x + slot.width / 2, slot.y + slot.height / 2, { steps: 9 }); await page.mouse.up();
    if (id !== 'rail') await expect(page.getByTestId(`slot-${id}`)).toHaveClass(/placed/);
  }
  await finishScene(page, 1);
});

for (const path of ['vaginal', 'cesarean'] as const) {
  test(`${path} birth plays all five scenes before newborn care`, async ({ page }) => {
    await loadGame(page, BIRTH_CHAPTER, 4, path);
    await openMission(page);
    await expect(page.getByTestId('birth-experience')).toBeVisible();
    for (let i = 0; i < 3; i++) await page.getByTestId(`birth-check-${i}`).click();
    await page.getByTestId('birth-next').click();
    if (path === 'cesarean') for (let i = 0; i < 3; i++) await page.getByTestId(`birth-prep-${i}`).click();
    else { await page.getByTestId('birth-breathing').click(); const r = (await page.getByTestId('breath-hold').boundingBox())!;
      await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.mouse.down();
      await page.waitForTimeout(2300); await page.mouse.up();
      await expect(page.getByTestId('birth-next')).toBeEnabled({ timeout: 20000 }); }
    await page.getByTestId('birth-next').click();
    for (let i = 0; i < 5; i++) {
      await expect(page.getByTestId('birth-heart')).toHaveAttribute('data-open', 'true');
      await page.getByTestId('birth-heart').click();
      await page.waitForTimeout(1300);
    }
    await expect(page.getByTestId('birth-next')).toBeEnabled();
    await page.getByTestId('birth-next').click();
    await page.waitForTimeout(700); await page.screenshot({ path: `artifacts/v2-birth-${path}.png` });
    await expect(page.getByTestId('birth-next')).toBeEnabled(); await page.getByTestId('birth-next').click();
    await page.getByTestId('birth-next').click();
    await page.getByTestId('nav-tasks').click(); await page.getByTestId('advance-chapter').click();
    await page.getByTestId('chapter-ready').click();
    await expect(page.getByTestId('game')).toHaveAttribute('data-chapter', '9');
    await page.getByTestId('nav-album').click();
    await expect(page.getByRole('button', { name: /Xoş gəldin, balacam/ })).toBeVisible();
  });
}

test('hospital bag uses the real Anacan checklist in a placement game', async ({ page }) => {
  await loadGame(page, 7, 1);
  await openMission(page); await expect(page.getByTestId('puzzle-board')).toBeVisible();
  const catalogue = JSON.parse(await readFile('public/data/catalogue.json', 'utf8'));
  for (const item of catalogue.bag.filter((row: { is_essential: boolean }) => row.is_essential).slice(0, 6)) {
    await page.getByTestId(`piece-${item.id}`).click(); await page.getByTestId(`slot-${item.id}`).click();
  }
  await finishScene(page, 1);
});

test('family routine and birth-plan choices change the actual simulation save', async ({ page }) => {
  await loadGame(page, 7);
  await openMission(page);
  await page.getByTestId('birth-plan-cesarean').click();
  await page.getByRole('button', { name: 'Ailə üzvüm', exact: true }).click();
  await page.getByRole('button', { name: 'Yumşaq işıq', exact: true }).click();
  await page.getByTestId('birth-plan-confirm').click();
  await finishScene(page, 1);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mommy-simulator-save-v1')!).pregnancy);
  expect(saved.birthPlan).toBe('cesarean'); expect(saved.supportPerson).toBe('family'); expect(saved.comfort).toBe('light');
});

test('family day planning is playable with drag or tap placement', async ({ page }) => {
  await loadGame(page, 11);
  await openMission(page);
  for (let i = 0; i < 4; i++) { await page.getByTestId(`piece-routine-${i}`).click(); await page.getByTestId(`slot-routine-${i}`).click(); }
  await finishScene(page, 1);
});

test('newborn care, house decor, offline library and photo memories are usable', async ({ page }) => {
  await loadGame(page, 10, 2);
  await openMission(page); await expect(page.getByTestId('care-step-0')).toBeVisible();
  await page.getByRole('button', { name: 'Qarışıq', exact: true }).click();
  for (let i = 0; i < 4; i++) await page.getByTestId(`care-step-${i}`).click();
  await finishScene(page, 1);
  await page.getByTestId('nav-decorate').click(); await page.getByTestId('buy-moon-lamp').click();
  await page.getByTestId('place-moon-lamp').click(); await page.getByTestId('placement-slot-0').click();
  await expect(page.locator('.placement-toolbar')).toHaveCount(0);
  await page.getByTestId('photo-mode').click(); await page.getByTestId('capture-photo').click();
  await expect(page.getByRole('status')).toContainText('albomuna');
  await page.getByRole('button', { name: 'Bağla', exact: true }).click();
  await page.getByTestId('nav-album').click(); await expect(page.locator('.memory-photo > img')).toHaveCount(1);
  await page.getByTestId('sheet-close').click();
  await page.getByRole('button', { name: 'Anacan kitabxanası', exact: true }).click();
  await page.getByRole('button', { name: 'Körpə adları', exact: true }).click();
  await page.getByRole('textbox', { name: 'Axtar…' }).fill('Dəniz');
  await expect(page.getByTestId('catalogue-row').first()).toBeVisible();
  await page.getByTestId('catalogue-row').first().click();
  await expect(page.locator('.record-source')).toContainText('ninth-park-492111-m4');
});

test('simulator overlays remain aligned on small phones, iPad and landscape', async ({ page }) => {
  await loadGame(page);
  for (const [width, height] of [[320, 700], [360, 800], [430, 932], [768, 1024], [1280, 800], [932, 430]]) {
    await page.setViewportSize({ width, height });
    await page.getByTestId('nav-journey').click(); await page.waitForTimeout(350);
    const layout = await page.evaluate(() => { const shell = document.querySelector('main')!, sheet = document.querySelector('.sheet')!, content = document.querySelector('.sheet-content')!;
      return { scrolled: shell.scrollLeft !== 0, horizontal: document.documentElement.scrollWidth > innerWidth,
        sheetFits: sheet.getBoundingClientRect().left >= -1 && sheet.getBoundingClientRect().right <= innerWidth + 1,
        contentFits: content.scrollWidth <= content.clientWidth + 1 }; });
    expect(layout, `${width}x${height}`).toEqual({ scrolled: false, horizontal: false, sheetFits: true, contentFits: true });
    await page.getByTestId('sheet-close').click();
  }
  await page.screenshot({ path: 'artifacts/v2-landscape.png' });
});
