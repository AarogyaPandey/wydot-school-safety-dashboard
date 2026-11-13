import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import type { Bounds } from '../../domain/types';

export type UploadedFeature = Feature<Geometry | null>;
export type UploadedCollection = FeatureCollection<Geometry | null>;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 30 * 1024 * 1024;
export const MAX_FEATURES = 50000;
export const MAX_LAYERS = 12;
export const UPLOAD_COLORS = ['#806345', '#387e87', '#ae7940', '#74618f', '#548067', '#ae5663'];
export type UploadedLayer = { id: string; name: string; bytes: number; enabled: boolean; color: string; data: UploadedCollection };
export type UploadSettings = { categoryField: string; categoryValue: string; dateField: string; fromDate: string; toDate: string; valueField: string };
export type UploadedRow = { layer: UploadedLayer; feature: UploadedFeature };
export const EMPTY_UPLOAD_SETTINGS: UploadSettings = { categoryField: '', categoryValue: '', dateField: '', fromDate: '', toDate: '', valueField: '' };

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
function position(value: unknown): asserts value is Position {
  if (!Array.isArray(value) || value.length < 2 || !value.every(n => typeof n === 'number' && Number.isFinite(n)) || Math.abs(value[0]) > 180 || Math.abs(value[1]) > 90)
    throw new Error('Coordinates must use longitude, latitude in WGS 84 (EPSG:4326). Reproject projected coordinates before uploading.');
}
function positions(value: unknown, minimum: number, ring = false) {
  if (!Array.isArray(value) || value.length < minimum) throw new Error('A geometry has too few coordinates.');
  value.forEach(position);
  if (ring && JSON.stringify(value[0]) !== JSON.stringify(value[value.length - 1])) throw new Error('Polygon rings must be closed.');
}
function parts(value: unknown, validate: (part: unknown) => void) {
  if (!Array.isArray(value) || !value.length) throw new Error('Empty geometry coordinates are not supported.');
  value.forEach(validate);
}
function geometry(value: unknown, depth = 0): void {
  if (depth > 8 || !object(value)) throw new Error('Invalid or overly nested geometry.');
  switch (value.type) {
    case 'Point': position(value.coordinates); break;
    case 'MultiPoint': positions(value.coordinates, 1); break;
    case 'LineString': positions(value.coordinates, 2); break;
    case 'MultiLineString': parts(value.coordinates, p => positions(p, 2)); break;
    case 'Polygon': parts(value.coordinates, p => positions(p, 4, true)); break;
    case 'MultiPolygon': parts(value.coordinates, polygon => parts(polygon, p => positions(p, 4, true))); break;
    case 'GeometryCollection': parts(value.geometries, g => geometry(g, depth + 1)); break;
    default: throw new Error('Unsupported GeoJSON geometry type.');
  }
}
function crs(value: Record<string, unknown>) {
  if (value.crs === undefined || value.crs === null) return;
  const declared = value.crs;
  if (!object(declared) || declared.type !== 'name' || !object(declared.properties) || typeof declared.properties.name !== 'string' || !/^(EPSG:4326|urn:ogc:def:crs:EPSG::4326|urn:ogc:def:crs:OGC:1\.3:CRS84|OGC:CRS84)$/i.test(declared.properties.name))
    throw new Error('Only WGS 84 longitude/latitude GeoJSON is supported. Reproject this file to EPSG:4326 first.');
}
export function parseGeoJson(text: string): UploadedCollection {
  let value: unknown;
  try { value = JSON.parse(text.replace(/^\uFEFF/, '')); } catch { throw new Error('This file is not valid JSON.'); }
  if (!object(value)) throw new Error('Expected a GeoJSON FeatureCollection or Feature.');
  crs(value);
  const features = value.type === 'FeatureCollection' ? value.features : value.type === 'Feature' ? [value] : null;
  if (!Array.isArray(features)) throw new Error('Expected a GeoJSON FeatureCollection or Feature.');
  if (!features.length) throw new Error('This GeoJSON contains no features.');
  if (features.length > MAX_FEATURES) throw new Error(`Use no more than ${MAX_FEATURES.toLocaleString()} features per upload workspace.`);
  features.forEach((feature: unknown, index: number) => {
    try {
      if (!object(feature) || feature.type !== 'Feature' || !Object.hasOwn(feature, 'geometry') || !(feature.properties === null || object(feature.properties))) throw new Error('Expected a Feature with geometry and object or null properties.');
      crs(feature);
      if (feature.geometry !== null) geometry(feature.geometry);
      if (feature.id !== undefined && typeof feature.id !== 'string' && typeof feature.id !== 'number') throw new Error('Feature IDs must be strings or numbers.');
    } catch (error) { throw new Error(`Feature ${index + 1}: ${error instanceof Error ? error.message : 'Invalid feature.'}`); }
  });
  let vertexCount = 0;
  for (const feature of features) visitPositions(feature.geometry, () => { if (++vertexCount > 250000) throw new Error('This file exceeds 250,000 coordinate positions. Simplify the geometry before uploading.'); });
  // Drop foreign members such as stale bbox/style/HTML instructions. Properties remain data only.
  return { type: 'FeatureCollection', features: features.map(feature => ({ type: 'Feature', geometry: feature.geometry, properties: feature.properties, ...(feature.id !== undefined ? { id: feature.id } : {}) })) };
}
export function visitPositions(value: Geometry | null, visit: (p: Position) => void) {
  if (!value) return;
  if (value.type === 'GeometryCollection') { value.geometries.forEach(g => visitPositions(g, visit)); return; }
  const walk = (coordinates: unknown) => {
    if (!Array.isArray(coordinates)) return;
    if (typeof coordinates[0] === 'number') visit(coordinates as Position);
    else coordinates.forEach(walk);
  };
  walk(value.coordinates);
}
export function geometryBounds(value: Geometry | null): Bounds | null {
  let south = Infinity, north = -Infinity, west = Infinity, east = -Infinity;
  visitPositions(value, ([lon, lat]) => { south = Math.min(south, lat); north = Math.max(north, lat); west = Math.min(west, lon); east = Math.max(east, lon); });
  return Number.isFinite(south) ? { south, north, west, east } : null;
}
export function layerBounds(layers: UploadedLayer[]): Bounds | null {
  let result: Bounds | null = null;
  for (const layer of layers.filter(l => l.enabled)) for (const feature of layer.data.features) {
    const b = geometryBounds(feature.geometry);
    if (b) result = result ? { south: Math.min(result.south, b.south), north: Math.max(result.north, b.north), west: Math.min(result.west, b.west), east: Math.max(result.east, b.east) } : b;
  }
  return result;
}
export const scalarValue = (value: unknown): string | null => typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value) ? String(value) : null;
export const propertyValue = (feature: UploadedFeature, field: string): unknown => feature.properties && Object.hasOwn(feature.properties, field) ? feature.properties[field] : undefined;
export function localDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T\d{2}:\d{2}| \d{2}:\d{2})/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match, year = Number(y), month = Number(m), day = Number(d);
  const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1] ? `${y}-${m}-${d}` : null;
}
export function uploadFields(layers: UploadedLayer[]) {
  const category = new Set<string>(), numeric = new Set<string>(), date = new Set<string>();
  for (const layer of layers) for (const feature of layer.data.features) for (const [key, value] of Object.entries(feature.properties || {})) {
    if (scalarValue(value) !== null) category.add(key);
    if (typeof value === 'number' && Number.isFinite(value)) numeric.add(key);
    if (localDate(value)) date.add(key);
  }
  return { category: [...category].sort(), numeric: [...numeric].sort(), date: [...date].sort() };
}
export function defaultUploadSettings(layers: UploadedLayer[]): UploadSettings {
  const fields = uploadFields(layers);
  const prefer = (list: string[], pattern: RegExp) => list.find(f => pattern.test(f)) || list[0] || '';
  return { ...EMPTY_UPLOAD_SETTINGS, categoryField: prefer(fields.category, /severity|category|type|class/i), dateField: prefer(fields.date, /date|time/i), valueField: prefer(fields.numeric, /count|volume|aadt|speed|value/i) };
}
export function selectUploadedRows(layers: UploadedLayer[], settings: UploadSettings, bounds: Bounds | null): UploadedRow[] {
  const rows: UploadedRow[] = [];
  for (const layer of layers.filter(l => l.enabled)) for (const feature of layer.data.features) {
    if (settings.categoryValue && scalarValue(propertyValue(feature, settings.categoryField)) !== settings.categoryValue) continue;
    const date = localDate(propertyValue(feature, settings.dateField));
    if ((settings.fromDate || settings.toDate) && (!date || date < (settings.fromDate || '0000-01-01') || date > (settings.toDate || '9999-12-31'))) continue;
    if (bounds) {
      const b = geometryBounds(feature.geometry);
      // For lines/polygons this is a bounding-box query, not a precise spatial intersection.
      if (!b || b.east < bounds.west || b.west > bounds.east || b.north < bounds.south || b.south > bounds.north) continue;
    }
    rows.push({ layer, feature });
  }
  return rows;
}
export function categoryCounts(rows: UploadedRow[], field: string): [string, number][] {
  const counts = new Map<string, number>();
  for (const { feature } of rows) {
    const raw = scalarValue(propertyValue(feature, field));
    // JSON keys keep a missing value distinct from the literal string "Missing".
    const key = raw === null ? 'null' : JSON.stringify(raw);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts].map(([key, count]): [string, number] => [key === 'null' ? '(missing value)' : JSON.parse(key), count]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
export function dateCounts(rows: UploadedRow[], field: string): [string, number][] {
  const counts = new Map<string, number>();
  for (const { feature } of rows) { const date = localDate(propertyValue(feature, field)); if (date) { const month = date.slice(0, 7); counts.set(month, (counts.get(month) || 0) + 1); } }
  return [...counts].sort(([a], [b]) => a.localeCompare(b));
}
export function numericBins(rows: UploadedRow[], field: string): [string, number][] {
  const values = rows.map(({ feature }) => propertyValue(feature, field)).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!values.length) return [];
  const min = Math.min(...values), max = Math.max(...values);
  if (min === max) return [[String(min), values.length]];
  const count = Math.min(10, Math.ceil(Math.sqrt(values.length))), bins = Array<number>(count).fill(0);
  const range = max - min;
  values.forEach(v => {
    const fraction = Number.isFinite(range) ? (v - min) / range : (v / 2 - min / 2) / (max / 2 - min / 2);
    bins[Math.min(count - 1, Math.floor(fraction * count))]++;
  });
  const label = (n: number) => Number(n.toPrecision(5)).toLocaleString();
  const edge = (i: number) => min * (1 - i / count) + max * (i / count);
  return bins.map((n, i) => [`${label(edge(i))} – ${label(i === count - 1 ? max : edge(i + 1))}${i === count - 1 ? ' inclusive' : ''}`, n]);
}
