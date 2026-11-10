import { describe, expect, it } from 'vitest';
import { isLocalRequest } from '../server/local-data';
import { clipLine, clipRoadFeatures, clipSegment } from '../server/geometry';
import { parseCsv } from '../server/source-data';

describe('research data access boundary', () => {
  it('allows same-origin loopback reads and rejects network, foreign-origin, and cross-site requests', () => {
    expect(isLocalRequest('127.0.0.1', '127.0.0.1:5173', 'http://127.0.0.1:5173', 'same-origin')).toBe(true);
    expect(isLocalRequest('::1', 'localhost:5173', undefined)).toBe(true);
    expect(isLocalRequest('192.168.1.2', '127.0.0.1:5173', undefined)).toBe(false);
    expect(isLocalRequest('127.0.0.1', 'malicious.example:5173', undefined)).toBe(false);
    expect(isLocalRequest('127.0.0.1', '127.0.0.1:5173', 'http://malicious.example')).toBe(false);
    expect(isLocalRequest('127.0.0.1', '127.0.0.1:5173', undefined, 'cross-site')).toBe(false);
    expect(isLocalRequest('127.0.0.1', '127.0.0.1:5173', 'null')).toBe(false);
  });
});
describe('road visualization clipping', () => {
  it('keeps a crossing segment even when both source vertices are outside', () => {
    expect(clipSegment([-5, 5], [15, 5], [0, 0, 10, 10])).toEqual([[0, 5], [10, 5]]);
    expect(clipSegment([-5, -2], [15, -2], [0, 0, 10, 10])).toBeNull();
    expect(clipSegment([4, -10], [4, 15], [0, 0, 10, 10])).toEqual([[4, 0], [4, 10]]);
  });
  it('does not join unrelated visible runs through an outside vertex', () => {
    const lines = clipLine([[2, 2], [12, 2], [12, 8], [2, 8]], [0, 0, 10, 10]);
    expect(lines).toEqual([[[2, 2], [10, 2]], [[10, 8], [2, 8]]]);
  });
  it('retains properties while dropping invisible road geometries', () => {
    const result = clipRoadFeatures({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { route: 'fixture' }, geometry: { type: 'LineString', coordinates: [[-120, 41.1], [-100, 41.1]] } }] });
    expect(result.features).toHaveLength(1); expect(result.features[0].properties?.route).toBe('fixture');
    expect(result.features[0].geometry.type).toBe('MultiLineString');
  });
});
describe('source CSV parsing', () => {
  it('retains quoted commas, escaped quotes, embedded newlines, and NA strings', () => {
    expect(parseCsv('\uFEFFSchool,note,flag\r\n"Fixture, West","A ""quoted""\nvalue",NA\r\n')).toEqual([{ School: 'Fixture, West', note: 'A "quoted"\nvalue', flag: 'NA' }]);
  });
});
