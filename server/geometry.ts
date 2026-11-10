import type { FeatureCollection, Geometry, Position } from 'geojson';

// Clip visualization lines to a documented context box. This does not define the analysis study area.
export const CONTEXT_BOUNDS = [-105.12, 41.02, -104.60, 41.28] as const;
export function clipSegment(a: Position, b: Position, bounds: readonly number[] = CONTEXT_BOUNDS): [Position, Position] | null {
  const [west, south, east, north] = bounds;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const p = [-dx, dx, -dy, dy], q = [a[0] - west, east - a[0], a[1] - south, north - a[1]];
  let low = 0, high = 1;
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return null; continue; }
    const r = q[i] / p[i];
    if (p[i] < 0) low = Math.max(low, r); else high = Math.min(high, r);
    if (low > high) return null;
  }
  if (low === high) return null;
  return [[a[0] + low * dx, a[1] + low * dy], [a[0] + high * dx, a[1] + high * dy]];
}
export function clipLine(line: Position[], bounds: readonly number[] = CONTEXT_BOUNDS): Position[][] {
  const result: Position[][] = [];
  let run: Position[] = [];
  for (let i = 1; i < line.length; i++) {
    const clipped = clipSegment(line[i - 1], line[i], bounds);
    if (!clipped) { if (run.length > 1) result.push(run); run = []; continue; }
    const [a, b] = clipped, last = run.at(-1);
    if (last && Math.abs(last[0] - a[0]) < 1e-10 && Math.abs(last[1] - a[1]) < 1e-10) run.push(b);
    else { if (run.length > 1) result.push(run); run = [a, b]; }
  }
  if (run.length > 1) result.push(run);
  return result;
}
export function clipRoadFeatures(collection: FeatureCollection): FeatureCollection {
  return { type: 'FeatureCollection', features: collection.features.flatMap(feature => {
    const geometry = feature.geometry;
    if (geometry.type !== 'LineString' && geometry.type !== 'MultiLineString') return [];
    const lines = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates;
    const clipped = lines.flatMap(line => clipLine(line));
    return clipped.length ? [{ ...feature, geometry: { type: 'MultiLineString', coordinates: clipped } as Geometry }] : [];
  }) };
}
