import { describe, expect, it } from 'vitest';
import type { UploadedFeature as Feature } from '../src/features/uploads/data';
import { categoryCounts, dateCounts, defaultUploadSettings, EMPTY_UPLOAD_SETTINGS, geometryBounds, localDate, MAX_FEATURES, numericBins, parseGeoJson, selectUploadedRows, uploadFields, type UploadedLayer } from '../src/features/uploads/data';
import { uploadedCsv } from '../src/features/uploads/aggregates';

// Synthetic upload records only; this fixture is never bundled with the application.
const point = (properties: Record<string, unknown>, coordinates = [-122.33, 47.6]): Feature => ({ type: 'Feature', geometry: { type: 'Point', coordinates }, properties });
const makeLayer = (id: string, features: Feature[], enabled = true): UploadedLayer => ({ id, name: `${id}.geojson`, data: { type: 'FeatureCollection', features }, enabled, color: '#806345', bytes: 100 });
const featureCollection = (features: unknown[]) => JSON.stringify({ type: 'FeatureCollection', features });

describe('GeoJSON upload validation', () => {
  it('accepts features, multi-geometries, null geometry, and preserves property values without executing HTML', () => {
    const f = point({ severity: '<img src=x onerror=alert(1)>', count: 0, unknown: null });
    expect(parseGeoJson(JSON.stringify(f)).features[0].properties).toEqual(f.properties);
    const result = parseGeoJson(featureCollection([f, { type: 'Feature', geometry: null, properties: null }, { type: 'Feature', geometry: { type: 'GeometryCollection', geometries: [{ type: 'MultiPoint', coordinates: [[0, 0], [1, 2, 3]] }, { type: 'MultiLineString', coordinates: [[[0, 0], [1, 2]]] }, { type: 'MultiPolygon', coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]]] }] }, properties: {} }]));
    expect(result.features).toHaveLength(3);
    expect(geometryBounds(result.features[2].geometry)).toEqual({ south: 0, north: 2, west: 0, east: 1 });
  });
  it('rejects malformed files, projected coordinates/CRS, open rings, and missing geometry', () => {
    expect(() => parseGeoJson('not JSON')).toThrow('valid JSON');
    expect(() => parseGeoJson(featureCollection([]))).toThrow('no features');
    expect(() => parseGeoJson(featureCollection([point({}, [753850, 238950])]))).toThrow('EPSG:4326');
    expect(() => parseGeoJson(JSON.stringify({ type: 'FeatureCollection', crs: { type: 'name', properties: { name: 'EPSG:3857' } }, features: [point({})] }))).toThrow('Reproject');
    expect(() => parseGeoJson(featureCollection([{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] }, properties: {} }]))).toThrow('closed');
    expect(() => parseGeoJson(featureCollection([{ type: 'Feature', properties: {} }]))).toThrow('Feature 1');
    expect(() => parseGeoJson(featureCollection([point({}, [1, 100])]))).toThrow('Coordinates');
  });
  it('does not trust foreign bounding boxes or feature-style markup, and enforces feature limits', () => {
    const f = { ...point({ name: 'synthetic' }), bbox: [-180, -90, 180, 90], style: { html: '<script>' } };
    const result = parseGeoJson(featureCollection([f]));
    expect(result.features[0]).not.toHaveProperty('bbox'); expect(result.features[0]).not.toHaveProperty('style');
    expect(() => parseGeoJson(featureCollection(Array(MAX_FEATURES + 1).fill(f)))).toThrow('50,000');
  });
});
describe('shared uploaded layer selection and attribute aggregation', () => {
  const layers = [makeLayer('one', [point({ severity: 'minor', date: '2024-01-01T23:45:00-07:00', value: 0 }), point({ severity: 'major', date: '2024-02-01', value: 10 })]), makeLayer('two', [point({ severity: 'major', date: '2024-03-01', value: 20 }), { type: 'Feature', geometry: null, properties: { severity: null, value: null } }])];
  it('discovers actual fields and never substitutes missing numeric/date values', () => {
    expect(uploadFields(layers)).toEqual({ category: ['date', 'severity', 'value'], numeric: ['value'], date: ['date'] });
    expect(defaultUploadSettings(layers)).toMatchObject({ categoryField: 'severity', dateField: 'date', valueField: 'value' });
    const rows = selectUploadedRows(layers, EMPTY_UPLOAD_SETTINGS, null);
    expect(categoryCounts(rows, 'severity')).toEqual([['major', 2], ['(missing value)', 1], ['minor', 1]]);
    expect(dateCounts(rows, 'date')).toEqual([['2024-01', 1], ['2024-02', 1], ['2024-03', 1]]);
    expect(numericBins(rows, 'value').reduce((sum, r) => sum + r[1], 0)).toBe(3);
  });
  it('combines enabled layers, keeps all-off empty, and applies category/date/area filters consistently', () => {
    expect(selectUploadedRows(layers.map(l => ({ ...l, enabled: false })), EMPTY_UPLOAD_SETTINGS, null)).toEqual([]);
    expect(selectUploadedRows([{ ...layers[0], enabled: false }, layers[1]], EMPTY_UPLOAD_SETTINGS, null)).toHaveLength(2);
    const settings = { ...defaultUploadSettings(layers), categoryValue: 'major', fromDate: '2024-02-15' };
    expect(selectUploadedRows(layers, settings, null)).toHaveLength(1);
    const b = { south: 47.5, north: 47.7, west: -122.4, east: -122.2 };
    expect(selectUploadedRows(layers, EMPTY_UPLOAD_SETTINGS, b)).toHaveLength(3);
    expect(selectUploadedRows(layers, EMPTY_UPLOAD_SETTINGS, { ...b, north: 40, south: 39 })).toHaveLength(0);
  });
  it('preserves calendar dates across timezone labels and rejects impossible dates', () => {
    expect(localDate('2024-02-29T23:59:00-07:00')).toBe('2024-02-29');
    expect(localDate('2023-02-29')).toBeNull(); expect(localDate('2024-13-01')).toBeNull(); expect(localDate('2024-02-31')).toBeNull();
    expect(localDate('01/02/2024')).toBeNull(); expect(localDate(null)).toBeNull();
  });
  it('keeps numeric zero, includes the maximum bin, and handles constant/large values', () => {
    const rows = selectUploadedRows(layers, EMPTY_UPLOAD_SETTINGS, null);
    expect(numericBins(rows, 'missing')).toEqual([]);
    expect(numericBins(selectUploadedRows([makeLayer('constant', [point({ v: 0 }), point({ v: 0 })])], EMPTY_UPLOAD_SETTINGS, null), 'v')).toEqual([['0', 2]]);
    const large = numericBins(selectUploadedRows([makeLayer('large', [point({ v: -1e308 }), point({ v: 1e308 })])], EMPTY_UPLOAD_SETTINGS, null), 'v');
    expect(large.reduce((n, r) => n + r[1], 0)).toBe(2); expect(JSON.stringify(large)).not.toContain('NaN');
  });
  it('exports aggregates with the active scope rather than raw geometry or feature IDs', () => {
    const data = [makeLayer('one', [{ ...point({ severity: '=SUM(1,2)', date: '2024-01-01', value: 3 }), id: 'SYNTHETIC-SECRET-ID' }])];
    const text = uploadedCsv(selectUploadedRows(data, EMPTY_UPLOAD_SETTINGS, null), { ...EMPTY_UPLOAD_SETTINGS, categoryField: 'severity' }, ['one.geojson'], false);
    expect(text).toContain('1 features'); expect(text).toContain("'=SUM(1,2)");
    expect(text).not.toContain('coordinates'); expect(text).not.toContain('-122.33'); expect(text).not.toContain('SYNTHETIC-SECRET-ID');
    expect(uploadedCsv([], EMPTY_UPLOAD_SETTINGS, ['enabled-empty.geojson'], false)).toContain('"layer","enabled-empty.geojson","0"');
  });
});
