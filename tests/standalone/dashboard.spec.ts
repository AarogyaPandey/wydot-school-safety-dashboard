import { expect, test } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const htmlUrl = pathToFileURL(path.resolve('School-Zone-Safety.html')).href;
const tiles = /^https:\/\/(tile\.openstreetmap\.org|basemap\.nationalmap\.gov)\//;
test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\//, route => tiles.test(route.request().url())
    ? route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#eee"/></svg>' })
    : route.abort());
});

test('double-click HTML loads populated maps and charts with no server or external code files', async ({ page }) => {
  const errors: string[] = [], resources: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => resources.push(request.url()));
  await page.goto(htmlUrl);
  await expect(page).toHaveURL(/#\/map$/);
  await expect(page.getByTestId('unique-crash-count')).not.toHaveText('—');
  expect(Number((await page.getByTestId('unique-crash-count').textContent())!.replaceAll(',', ''))).toBeGreaterThan(0);
  await expect(page.locator('script[src], link[rel=stylesheet], link[rel=modulepreload]')).toHaveCount(0);
  await page.getByRole('link', { name: 'Analytics', exact: true }).click();
  await expect(page.locator('.chart-content canvas').first()).toBeVisible();
  await page.getByRole('button', { name: 'Statistical results', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('School zone');
  await page.screenshot({ path: '.local/qa/standalone-analysis.png' });
  expect(resources.filter(url => !url.startsWith(htmlUrl) && !url.startsWith('data:') && !tiles.test(url))).toEqual([]);
  expect(errors).toEqual([]);
});

test('local HTML replaces saved OSM with USGS on the main map and Spatial Story maps', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.addInitScript(() => sessionStorage.setItem('school-safety-basemap', 'osm'));
  await page.goto(htmlUrl + '#/map');
  await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible();
  await expect(page.locator('.leaflet-tile').first()).toHaveAttribute('src', /basemap\.nationalmap\.gov\/.*USGSTopo/);
  await expect(page.locator('.leaflet-control-attribution')).toContainText('USGS');
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await expect(page.getByRole('radio', { name: /Light Gray/ })).toBeChecked();
  await expect(page.getByRole('radio', { name: /OpenStreetMap/ })).toBeDisabled();
  await page.getByRole('radio', { name: /Topographic/ }).check();
  await expect(page.locator('.leaflet-tile').first()).toHaveAttribute('src', /USGSTopo/);
  await page.getByRole('radio', { name: /Aerial/ }).check();
  await expect(page.locator('.leaflet-tile').first()).toHaveAttribute('src', /USGSImageryOnly/);
  await page.getByRole('button', { name: 'Close map layers' }).click();
  await page.getByRole('link', { name: 'Spatial Story', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Spatial Story', exact: true })).toBeVisible();
  await expect(page).toHaveTitle(/Spatial Story/);
  await expect(page.locator('.leaflet-container')).toHaveCount(3);
  expect(requests.some(url => url.startsWith('https://basemap.nationalmap.gov/'))).toBe(true);
  expect(requests.some(url => url.includes('tile.openstreetmap.org'))).toBe(false);
});

test('file navigation preserves shared filters, refresh, section anchors, and Reset', async ({ page }) => {
  await page.goto(htmlUrl + '#/map');
  await expect(page.getByTestId('unique-crash-count')).not.toHaveText('—');
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByLabel('School level').selectOption('Middle');
  await page.getByLabel('Custom distance (ft)').fill('750');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.getByLabel('From year', { exact: true }).selectOption('2020');
  await page.getByLabel('Through year', { exact: true }).selectOption('2022');
  await page.getByRole('button', { name: 'Close filters' }).click();
  await page.getByRole('link', { name: 'Analytics', exact: true }).click();
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await expect(page.getByLabel('School level')).toHaveValue('Middle');
  await expect(page.getByLabel('Custom distance (ft)')).toHaveValue('750');
  await expect(page.getByLabel('From year', { exact: true })).toHaveValue('2020');
  await expect(page.getByLabel('Through year', { exact: true })).toHaveValue('2022');
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'About', exact: true }).click();
  await page.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name: 'Limitations' }).click();
  await expect(page).toHaveURL(/#\/about\?.*#limitations$/);
  await expect(page.getByRole('heading', { name: 'Limitations', exact: true })).toBeInViewport();
  await page.getByRole('link', { name: 'Spatial Story', exact: true }).click();
  await page.getByRole('navigation', { name: 'Story chapters' }).getByRole('link', { name: /Weekday and hour/ }).click();
  await expect(page).toHaveURL(/#\/story\?.*#weekday-hour-chart$/);
  await page.reload();
  await expect(page.locator('#weekday-hour-chart')).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Map', exact: true }).click();
  await page.getByRole('button', { name: 'Reset map and filters' }).click();
  await expect(page).toHaveURL(htmlUrl + '#/map');
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await expect(page.getByLabel('Custom distance (ft)')).toHaveValue('1320');
});

test('local HTML works offline with packaged layers, GeoJSON uploads, and chart exports', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.setOffline(true);
  await page.goto(htmlUrl + '#/map');
  await expect(page.getByTestId('unique-crash-count')).not.toHaveText('—');
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await page.getByLabel('Posted speed limits', { exact: true }).check();
  await page.getByLabel('Traffic volume · AADT', { exact: true }).check();
  await page.getByLabel('AADT observation year').selectOption('2024');
  await page.getByRole('button', { name: 'Close map layers' }).click();
  await expect(page.locator('.layer-error')).toHaveCount(0);
  await page.getByRole('link', { name: 'Analytics', exact: true }).click();
  await expect(page.locator('.chart-content canvas').first()).toBeVisible();
  const projectDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Crashes by year as PNG' }).click();
  expect((await projectDownload).suggestedFilename()).toMatch(/\.png$/);
  await page.getByLabel('GeoJSON files').setInputFiles({ name: 'synthetic-local.geojson', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [-104.8, 41.14] }, properties: { category: 'Synthetic test only', date: '2020-01-01', value: 4 } }] })) });
  await expect(page.getByTestId('uploaded-feature-count')).toHaveText('1');
  const csvDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export aggregate CSV' }).click();
  expect((await csvDownload).suggestedFilename()).toMatch(/\.csv$/);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Map', exact: true }).click();
  await expect(page.getByTestId('uploaded-feature-count')).toHaveText('1');
  await page.screenshot({ path: '.local/qa/standalone-file-map.png' });
  expect(errors).toEqual([]);
});
