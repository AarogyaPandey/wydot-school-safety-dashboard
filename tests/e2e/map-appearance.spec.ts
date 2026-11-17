import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { ResearchDataset } from '../../src/domain/types';

test.beforeEach(async ({ page }) => {
  // A deliberately busy test tile verifies that only the basemap is muted.
  await page.route(/^https:\/\/(tile\.openstreetmap\.org|basemap\.nationalmap\.gov)\//, route => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#deded8"/><rect x="20" y="15" width="80" height="85" fill="#b9d88b"/><path d="M0 160L256 50" stroke="#e3a3b4" stroke-width="13"/><path d="M0 90h256M80 0v256M180 0v256" stroke="#fff" stroke-width="6"/><path d="M0 200h256" stroke="#f4da75" stroke-width="7"/><text x="84" y="85" fill="#666" font-size="10">Street</text></svg>' }));
});

test('crash and school popups stay in front of data and can be closed with the mouse', async ({ page }) => {
  await page.goto('/map?school=cole-elementary');
  await expect(page.getByTestId('unique-crash-count')).not.toHaveText('—');
  await expect(page.locator('.school-marker-wrapper.is-selected')).toHaveCSS('width', '18px');
  const point = page.locator('.leaflet-crash-points-pane path.leaflet-interactive').first();
  const location = await point.boundingBox();
  await point.dispatchEvent('click', { clientX: location!.x + location!.width / 2, clientY: location!.y + location!.height / 2 });
  const popup = page.locator('.leaflet-popup');
  await expect(popup).toBeVisible();
  await expect(popup).toHaveCSS('opacity', '1');
  expect(await popup.evaluate(el => el.parentElement!.classList.contains('leaflet-popup-pane'))).toBe(true);
  const paneOrder = await page.locator('.leaflet-map').evaluate(map => {
    const z = (selector: string) => Number(getComputedStyle(map.querySelector(selector)!).zIndex);
    return { popup: z('.leaflet-popup-pane'), schools: z('.leaflet-marker-pane'), crashes: z('.leaflet-crash-points-pane') };
  });
  expect(paneOrder.popup).toBeGreaterThan(paneOrder.schools); expect(paneOrder.popup).toBeGreaterThan(paneOrder.crashes);
  await expect.poll(() => popup.evaluate(el => {
    const content = el.querySelector('.leaflet-popup-content-wrapper')!, box = content.getBoundingClientRect();
    const probes = [[box.left + box.width / 2, box.top + box.height / 2], [box.left + 18, box.top + 18], [box.right - 18, box.bottom - 18]];
    for (const marker of document.querySelectorAll('.school-marker-wrapper, .leaflet-crash-points-pane path')) {
      const r = marker.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (x > box.left + 10 && x < box.right - 10 && y > box.top + 10 && y < box.bottom - 10) probes.push([x, y]);
    }
    return probes.every(([x, y]) => document.elementFromPoint(x, y)?.closest('.leaflet-popup') === el);
  })).toBe(true);
  await page.screenshot({ path: '.local/qa/popup-stacking.png' });
  await popup.locator('.leaflet-popup-close-button').click(); await expect(popup).toHaveCount(0);
  await page.locator('.school-marker-wrapper.is-selected').click();
  await expect(popup).toContainText('Cole Elementary');
  expect(await popup.evaluate(el => el.parentElement!.classList.contains('leaflet-popup-pane'))).toBe(true);
  await popup.locator('.leaflet-popup-close-button').click(); await expect(popup).toHaveCount(0);
});

test('overview uses a quiet basemap, filled buffers, and smaller school symbols without changing counts', async ({ page }) => {
  await page.goto('/map');
  await expect(page.getByTestId('unique-crash-count')).not.toHaveText('—');
  const count = await page.getByTestId('unique-crash-count').textContent();
  const marker = page.locator('.school-marker-wrapper').first();
  await expect(marker).toHaveCSS('width', '14px');
  await expect(page.locator('.leaflet-marker-pane .school-map-marker').first()).toHaveCSS('width', '14px');
  const tile = page.locator('.subdued-basemap .leaflet-tile').first();
  await expect(tile).toBeVisible();
  expect(await tile.evaluate(el => getComputedStyle(el).filter)).toContain('grayscale');
  expect(await tile.evaluate(el => getComputedStyle(el.closest('.leaflet-layer')!).opacity)).toBe('0.7');
  await expect(page.locator('.leaflet-crash-points-pane')).toHaveCSS('filter', 'none');
  expect(await page.locator('.leaflet-crash-points-pane path[fill="#397eb4"]').count()).toBeGreaterThan(0);
  await expect.poll(() => page.locator('.leaflet-school-zones-pane canvas').evaluate(canvas => {
    const c = canvas as HTMLCanvasElement, pixels = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let filled = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 205 && pixels[i + 1] > 160 && pixels[i + 1] < 210 && pixels[i + 2] < 120 && pixels[i + 3] >= 30 && pixels[i + 3] <= 130) filled++;
    return filled;
  })).toBeGreaterThan(1000);
  await page.screenshot({ path: '.local/qa/map-restyled.png' });
  for (const size of ['10px', '8px']) { await page.getByRole('button', { name: 'Zoom out', exact: true }).click(); await expect(marker).toHaveCSS('width', size); }
  await expect(marker.locator('.school-map-marker svg')).toBeHidden();
  await expect(page.getByTestId('unique-crash-count')).toHaveText(count!);
  await page.screenshot({ path: '.local/qa/map-overview-small-schools.png' });
  for (const size of ['10px', '14px', '18px', '22px']) { await page.getByRole('button', { name: 'Zoom in', exact: true }).click(); await expect(marker).toHaveCSS('width', size); }
  await expect(marker.locator('.school-map-marker svg')).toBeVisible();
  await expect(page.getByTestId('unique-crash-count')).toHaveText(count!);
});

test('Light Gray and standard OSM are separate, and custom distance drives the shared results within coverage', async ({ page, request }) => {
  await page.goto('/map');
  await expect(page.getByTestId('unique-crash-count')).not.toHaveText('—');
  const originalCount = await page.getByTestId('unique-crash-count').textContent();
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await expect(page.getByRole('radio', { name: /^Light Gray/ })).toBeChecked();
  await expect(page.locator('.basemap-options').getByRole('radio')).toHaveCount(4);
  await expect(page.locator('.basemap-options')).not.toContainText('muted');
  await page.getByRole('radio', { name: /^OpenStreetMap/ }).check();
  const normalTile = page.locator('.leaflet-tile-pane .leaflet-tile').first();
  await expect(normalTile).toHaveCSS('filter', 'none');
  expect(await normalTile.evaluate(el => getComputedStyle(el.closest('.leaflet-layer')!).opacity)).toBe('1');
  await expect(page.getByTestId('unique-crash-count')).toHaveText(originalCount!);
  await page.getByRole('radio', { name: /^Light Gray/ }).check();
  await expect(page.locator('.subdued-basemap .leaflet-tile').first()).toHaveCSS('filter', /grayscale/);
  await page.screenshot({ path: '.local/qa/basemaps-four-options.png' });
  await page.getByRole('button', { name: 'Close map layers' }).click();
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await expect(page.getByRole('button', { name: '¼ mile', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Custom distance (ft)')).toHaveValue('1320');
  await page.getByLabel('Custom distance (ft)').fill('750');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page).toHaveURL(/buffer=750/);
  const dataset = await (await request.get('/__research/dataset')).json() as ResearchDataset;
  const inPeriod = new Set(dataset.crashes.filter(c => c.year >= 2016 && c.year <= 2025).map(c => c.id));
  const expected = new Set(dataset.links.filter(l => l.distanceFt <= 750 && inPeriod.has(l.crashId)).map(l => l.crashId)).size;
  await expect(page.getByTestId('unique-crash-count')).toHaveText(expected.toLocaleString());
  await page.getByRole('button', { name: 'Close filters' }).click();
  await expect(page.locator('.map-filter-summary')).toContainText('750 ft');
  await page.getByRole('link', { name: 'Analytics', exact: true }).click();
  await expect(page.getByTestId('unique-crash-count')).toHaveText(expected.toLocaleString());
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export aggregate CSV' }).click();
  const csv = await readFile((await (await downloading).path())!, 'utf8');
  expect(csv).toContain('distance 750 ft');
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await expect(page.getByLabel('Custom distance (ft)')).toHaveValue('750');
  await page.getByLabel('Custom distance (ft)').fill('2000');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('1,320 ft');
  await expect(page.getByTestId('unique-crash-count')).toHaveText(expected.toLocaleString());
  await expect(page).toHaveURL(/buffer=750/);
  await page.getByRole('button', { name: '¼ mile', exact: true }).click();
  await expect(page.getByLabel('Custom distance (ft)')).toHaveValue('1320');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByTestId('unique-crash-count')).toHaveText(originalCount!);
  await page.getByLabel('Custom distance (ft)').fill('750'); await page.getByLabel('Custom distance (ft)').press('Enter');
  await expect(page).toHaveURL(/buffer=750/);
  await page.getByRole('button', { name: 'Reset analytics filters' }).click();
  await expect(page.getByLabel('Custom distance (ft)')).toHaveValue('1320');
  await expect(page).toHaveURL(/\/analytics$/);
  await page.screenshot({ path: '.local/qa/custom-buffer-filter.png' });
});
