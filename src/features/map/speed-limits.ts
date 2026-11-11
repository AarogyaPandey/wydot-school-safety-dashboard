import type { Feature } from 'geojson';

export type SpeedLimitCategory = { value: number | null; label: string; color: string; schoolZoneAssumption?: boolean };
export type SpeedLimitFeature = Feature & { properties: Record<string, unknown> };
export type SchoolBufferCenter = readonly [longitude: number, latitude: number];

const COLORS = ['#2471a3', '#c0392b', '#239b56', '#8e44ad', '#d68910', '#148f77', '#34495e', '#d35400', '#5b2c6f', '#117864', '#7d6608', '#1f618d', '#a93226', '#117a65', '#884ea0', '#7e5109'];
const UNKNOWN_COLOR = '#7b6e5d';
const SCHOOL_ZONE_COLOR = '#c2185b';
const FEET_TO_METERS = 0.3048006096;
const METERS_PER_DEGREE = 111_320;
const INTERVAL_EPSILON = 1e-10;

export function parseSpeedLimit(value: unknown): number | null {
  if (typeof value !== 'number' && (typeof value !== 'string' || value.trim() === '')) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function speedLimitCategories(features: Feature[]): SpeedLimitCategory[] {
  const values = new Set<number>();
  let hasUnknown = false;
  let hasSchoolZoneAssumption = false;
  for (const feature of features) {
    const value = parseSpeedLimit(feature.properties?.speed_limit);
    if (value === null) hasUnknown = true;
    else values.add(value);
    if (feature.properties?.school_zone_speed_override === true) hasSchoolZoneAssumption = true;
  }
  const categories: SpeedLimitCategory[] = [...values].sort((a, b) => a - b).map((value, index) => ({
    value,
    label: value === 0 ? 'Unspecified (0)' : `${value.toLocaleString('en-US')} mph`,
    color: COLORS[index % COLORS.length],
  }));
  if (hasSchoolZoneAssumption) categories.push({
    value: 20,
    label: '20 mph · school-zone assumption',
    color: SCHOOL_ZONE_COLOR,
    schoolZoneAssumption: true,
  });
  if (hasUnknown) categories.push({ value: null, label: 'Unknown / not recorded', color: UNKNOWN_COLOR });
  return categories;
}

export function speedLimitColor(value: unknown, categories: SpeedLimitCategory[], schoolZoneAssumption = false): string {
  const parsed = parseSpeedLimit(value);
  return categories.find(category => category.value === parsed && Boolean(category.schoolZoneAssumption) === schoolZoneAssumption)?.color || UNKNOWN_COLOR;
}

type Point = number[];
type Interval = { start: number; end: number };
type LineGeometry = { type: 'LineString'; coordinates: Point[] } | { type: 'MultiLineString'; coordinates: Point[][] };

function interpolatePoint(start: Point, end: Point, t: number): Point {
  return start.map((value, index) => value + ((end[index] ?? value) - value) * t);
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = intervals.sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const previous = merged.at(-1);
    if (previous && interval.start <= previous.end + INTERVAL_EPSILON) previous.end = Math.max(previous.end, interval.end);
    else merged.push({ ...interval });
  }
  return merged;
}

function segmentBufferIntervals(start: Point, end: Point, centers: SchoolBufferCenter[], radiusMeters: number): Interval[] {
  const latitude = (start[1] + end[1]) / 2;
  const metersPerLongitudeDegree = METERS_PER_DEGREE * Math.cos(latitude * Math.PI / 180);
  const dx = (end[0] - start[0]) * metersPerLongitudeDegree;
  const dy = (end[1] - start[1]) * METERS_PER_DEGREE;
  const a = dx * dx + dy * dy;
  if (a <= Number.EPSILON) {
    const inside = centers.some(([longitude, lat]) => {
      const x = (longitude - start[0]) * metersPerLongitudeDegree;
      const y = (lat - start[1]) * METERS_PER_DEGREE;
      return x * x + y * y <= radiusMeters * radiusMeters;
    });
    return inside ? [{ start: 0, end: 1 }] : [];
  }

  const intervals: Interval[] = [];
  for (const [longitude, lat] of centers) {
    const x = start[0] - longitude;
    const y = start[1] - lat;
    const centerX = x * metersPerLongitudeDegree;
    const centerY = y * METERS_PER_DEGREE;
    const b = 2 * (centerX * dx + centerY * dy);
    const c = centerX * centerX + centerY * centerY - radiusMeters * radiusMeters;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) continue;
    const root = Math.sqrt(discriminant);
    const entry = Math.max(0, (-b - root) / (2 * a));
    const exit = Math.min(1, (-b + root) / (2 * a));
    if (exit >= entry) intervals.push({ start: entry, end: exit });
  }
  return mergeIntervals(intervals);
}

function splitLineAtSchoolBuffers(
  coordinates: Point[],
  centers: SchoolBufferCenter[],
  radiusMeters: number,
  properties: Record<string, unknown>,
): SpeedLimitFeature[] {
  if (coordinates.length < 2) return [];
  const pieces: SpeedLimitFeature[] = [];
  let currentCoordinates: Point[] = [];
  let currentOverride: boolean | null = null;
  const flush = () => {
    if (currentCoordinates.length >= 2 && currentOverride !== null) {
      const sourceSpeedLimit = properties.source_speed_limit ?? properties.speed_limit ?? null;
      pieces.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: currentCoordinates },
        properties: {
          ...properties,
          source_speed_limit: sourceSpeedLimit,
          speed_limit: currentOverride ? 20 : sourceSpeedLimit,
          school_zone_speed_override: currentOverride,
        },
      });
    }
    currentCoordinates = [];
  };

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const start = coordinates[index];
    const end = coordinates[index + 1];
    const bufferIntervals = segmentBufferIntervals(start, end, centers, radiusMeters);
    const intervals = mergeIntervals([
      { start: 0, end: 0 },
      ...bufferIntervals,
      { start: 1, end: 1 },
    ]);
    const boundaries = [...new Set(intervals.flatMap(interval => [interval.start, interval.end]))].sort((a, b) => a - b);
    for (let boundary = 0; boundary < boundaries.length - 1; boundary += 1) {
      const from = boundaries[boundary];
      const to = boundaries[boundary + 1];
      if (to - from <= INTERVAL_EPSILON) continue;
      const midpoint = (from + to) / 2;
      const override = bufferIntervals.some(interval => midpoint >= interval.start - INTERVAL_EPSILON && midpoint <= interval.end + INTERVAL_EPSILON);
      if (currentOverride !== override) {
        flush();
        currentOverride = override;
      }
      const firstPoint = interpolatePoint(start, end, from);
      const lastPoint = interpolatePoint(start, end, to);
      const previous = currentCoordinates.at(-1);
      if (!previous || previous.some((value, dimension) => Math.abs(value - firstPoint[dimension]) > INTERVAL_EPSILON)) {
        currentCoordinates.push(firstPoint);
      }
      currentCoordinates.push(lastPoint);
    }
  }
  flush();
  return pieces;
}

export function applySchoolZoneSpeedAssumption(
  features: Feature[],
  centers: SchoolBufferCenter[],
  bufferFt: number,
): SpeedLimitFeature[] {
  const radiusMeters = bufferFt * FEET_TO_METERS;
  const output: SpeedLimitFeature[] = [];
  for (const feature of features) {
    const geometry = feature.geometry as LineGeometry | null;
    if (!geometry || (geometry.type !== 'LineString' && geometry.type !== 'MultiLineString')) continue;
    const properties = feature.properties || {};
    const lines = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates;
    const pieces = centers.length
      ? lines.flatMap(line => splitLineAtSchoolBuffers(line, centers, radiusMeters, properties))
      : lines.map((line): SpeedLimitFeature => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: line },
        properties: { ...properties, source_speed_limit: properties.source_speed_limit ?? properties.speed_limit ?? null, school_zone_speed_override: false },
      }));
    for (const piece of pieces) {
      output.push({ ...piece, id: `speed-segment-${output.length}` });
    }
  }
  return output;
}
