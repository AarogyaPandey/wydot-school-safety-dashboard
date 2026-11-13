import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// Deliberately synthetic files, kept in the test process and never in public assets.
const payload = (name: string, features: unknown[]) => ({ name, mimeType: 'application/geo+json', buffer: Buffer.from(JSON.stringify({ type: 'FeatureCollection', features })) });
const point = (id: string, severity: string, date: string, value: number, coordinates: number[] | null) => ({ type: 'Feature', id, properties: { severity, date, value, label: '<img src=x onerror="window.uploadExecuted=true">' }, geometry: coordinates ? { type: 'Point', coordinates } : null });
const files = [payload('synthetic-points.geojson', [point('SYNTHETIC-PRIVATE-1', 'Minor', '2024-01-01T23:45:00-07:00', 10, [-122.33, 47.6]), point('SYNTHETIC-PRIVATE-2', 'Major', '2024-02-02', 20, [-122.32, 47.61]), point('SYNTHETIC-PRIVATE-3', 'Major', '2024-02-03', 30, null)]), payload('synthetic-area.geojson', [{ type: 'Feature', properties: { severity: 'Major', date: '2024-03-03', value: 40 }, geometry: { type: 'Polygon', coordinates: [[[-122.35, 47.58], [-122.31, 47.58], [-122.31, 47.62], [-122.35, 47.62], [-122.35, 47.58]]] } }])];

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\/(tile\.openstreetmap\.org|basemap\.nationalmap\.gov)\//, route => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#eeeae3"/></svg>' }));
});
async function paintedPixels(page: Page) {
  return page.locator('.leaflet-map').evaluate(map => {
    let painted = 0;
    for (const canvas of map.querySelectorAll<HTMLCanvasElement>('.leaflet-overlay-pane canvas')) {
      const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) painted++;
    }
    return painted;
  });
}

test('browser-only multi-file uploads drive charts and map, including all-off and source switching', async ({ page }) => {
  const errors: string[] = [], transmitted: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.method() !== 'GET') transmitted.push(request.url()); });
  await page.goto('http://127.0.0.1:4173/analytics');
  await expect(page.getByText('Data unavailable in this build.', { exact: true })).toBeVisible();
  const choosing = page.waitForEvent('filechooser'); await page.getByRole('button', { name: 'Upload GeoJSON' }).click();
  expect((await choosing).isMultiple()).toBe(true);
  await page.getByLabel('GeoJSON files').setInputFiles(files);
  await expect(page.getByTestId('uploaded-feature-count')).toHaveText('4');
  await page.getByLabel('Manage uploaded layers').click();
  await expect(page.getByRole('switch', { name: 'Use synthetic-points.geojson' })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'Use synthetic-area.geojson' })).toBeChecked();
  await page.getByRole('switch', { name: 'Use synthetic-area.geojson' }).click();
  await expect(page.getByTestId('uploaded-feature-count')).toHaveText('3');
  await page.getByRole('switch', { name: 'Use synthetic-points.geojson' }).click();
  await expect(page.getByTestId('uploaded-feature-count')).toHaveText('0');
  await expect(page.getByText('All uploaded layers are off. Enable a layer in Data.')).toBeVisible();
  await page.getByRole('switch', { name: 'Use synthetic-points.geojson' }).click();
  await page.getByRole('switch', { name: 'Use synthetic-area.geojson' }).click();
  await page.getByRole('heading', { name: 'Features by layer', exact: true }).click();
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await expect(page.getByLabel('Category field', { exact: true })).toHaveValue('severity');
  await expect(page.getByLabel('Date field', { exact: true })).toHaveValue('date');
  await page.getByLabel('Category value', { exact: true }).selectOption('Major');
  await page.getByLabel('From date').fill('2024-03-01');
  await expect(page.getByTestId('uploaded-feature-count')).toHaveText('1');
  await page.keyboard.press('Escape');
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export aggregate CSV' }).click();
  const csv = await readFile((await (await downloading).path())!, 'utf8');
  expect(csv).toContain('1 features'); expect(csv).toContain('2024-03-01'); expect(csv).not.toContain('SYNTHETIC-PRIVATE'); expect(csv).not.toContain('-122.33');
  await page.getByRole('link', { name: 'Map', exact: true }).first().click();
  await expect(page.getByTestId('uploaded-feature-count')).toHaveText('1');
  await expect(page.getByRole('button', { name: 'Play years' })).toHaveCount(0);
  await expect.poll(() => paintedPixels(page)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Reset map and filters' }).click();
  await expect(page.getByTestId('uploaded-feature-count')).toHaveText('4');
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await page.getByRole('switch', { name: 'Use synthetic-points.geojson' }).click();
  await page.getByRole('switch', { name: 'Use synthetic-area.geojson' }).click();
  await expect(page.getByTestId('uploaded-feature-count')).toHaveText('0');
  await expect.poll(() => paintedPixels(page)).toBe(0);
  await page.getByRole('switch', { name: 'Use synthetic-points.geojson' }).click();
  await expect.poll(() => paintedPixels(page)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Close map layers' }).click();
  const box = await page.locator('.leaflet-map').boundingBox();
  await page.locator('.leaflet-map').click({ position: { x: box!.width / 2, y: box!.height / 2 } });
  await expect(page.locator('.leaflet-popup-content')).toContainText('<img src=x');
  await expect(page.locator('.leaflet-popup-content img')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { uploadExecuted?: boolean }).uploadExecuted)).toBeUndefined();
  await page.screenshot({ path: '.local/qa/uploads-map.png' });
  await page.getByRole('link', { name: 'Analytics', exact: true }).click();
  await expect(page.getByTestId('uploaded-feature-count')).toHaveText('3');
  await page.getByLabel('Manage uploaded layers').click();
  await page.getByRole('radio', { name: 'Project data', exact: true }).check();
  await expect(page.getByText('Data unavailable in this build.', { exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'Uploaded files', exact: true }).check();
  await expect(page.getByTestId('uploaded-feature-count')).toHaveText('3');
  await page.getByRole('heading', { name: 'Features by layer', exact: true }).click();
  await page.screenshot({ path: '.local/qa/uploads-analytics.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Upload GeoJSON' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel('Manage uploaded layers').click();
  await page.screenshot({ path: '.local/qa/uploads-mobile.png' });
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await expect(page.getByTestId('uploaded-feature-count')).toHaveCount(0);
  await expect(page.getByLabel('Manage uploaded layers')).toHaveCount(0);
  expect(transmitted).toEqual([]); expect(errors).toEqual([]);
});

test('invalid uploads retain valid layers, absent fields stay unavailable, and refresh clears files', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/analytics');
  await page.getByLabel('GeoJSON files').setInputFiles([payload('synthetic-geometry.geojson', [{ type: 'Feature', geometry: { type: 'Point', coordinates: [-104.8, 41.14] }, properties: null }]), { name: 'broken.geojson', mimeType: 'application/json', buffer: Buffer.from('{broken') }]);
  await expect(page.getByTestId('uploaded-feature-count')).toHaveText('1');
  await expect(page.getByRole('alert')).toContainText('broken.geojson');
  await expect(page.getByRole('button', { name: 'Export Features by month as PNG' })).toBeDisabled();
  await expect(page.getByText('No numeric field selected. Choose an available numeric field in Filters.')).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss upload errors' }).click();
  await page.getByLabel('GeoJSON files').setInputFiles(payload('projected.geojson', [point('SYNTHETIC', 'Minor', '2024-01-01', 5, [753850, 238950])]));
  await expect(page.getByRole('alert')).toContainText('EPSG:4326');
  await expect(page.getByTestId('uploaded-feature-count')).toHaveText('1');
  await page.getByRole('button', { name: 'Dismiss upload errors' }).click();
  await page.getByLabel('GeoJSON files').setInputFiles(files[0]);
  await expect(page.getByTestId('uploaded-feature-count')).toHaveText('4');
  await page.getByLabel('Manage uploaded layers').click();
  await page.getByRole('button', { name: 'Remove synthetic-points.geojson' }).click();
  await expect(page.getByTestId('uploaded-feature-count')).toHaveText('1');
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await expect(page.getByLabel('Category field', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Date field', { exact: true })).toHaveValue('');
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.getByText('Data unavailable in this build.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Manage uploaded layers')).toHaveCount(0);
});

test('Reset clears research filters while preserving map zoom and pan', async ({ page }) => {
  await page.goto('/map?level=Middle&from=2023');
  await expect(page.getByTestId('unique-crash-count')).not.toHaveText('—');
  const initialScale = await page.locator('.leaflet-control-scale-line').textContent();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(page.locator('.leaflet-control-scale-line')).not.toHaveText(initialScale!);
  const map = page.locator('.leaflet-map'), box = await map.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2); await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 90, box!.y + box!.height / 2 + 50, { steps: 10 }); await page.mouse.up();
  // Wait for Leaflet's drag inertia and zoom animation to finish, not a fixed sleep.
  await expect(page.locator('.leaflet-map-pane.leaflet-pan-anim')).toHaveCount(0);
  await expect(page.locator('.leaflet-map.leaflet-zoom-anim')).toHaveCount(0);
  const transform = await page.locator('.leaflet-map-pane').getAttribute('style');
  const scale = await page.locator('.leaflet-control-scale-line').textContent();
  await page.getByRole('button', { name: 'Reset map and filters' }).click();
  await expect(page).toHaveURL(/\/map$/);
  await expect(page.locator('.leaflet-control-scale-line')).toHaveText(scale!);
  await expect(page.locator('.leaflet-map-pane')).toHaveAttribute('style', transform!);
});
