import { describe, expect, it } from 'vitest';
import { BASEMAPS, basemapAvailable, initialBasemap } from '../src/features/map/basemaps';

describe('basemaps in standalone local HTML', () => {
  it('uses USGS for the muted default and rejects a saved OSM selection on file URLs', () => {
    expect(BASEMAPS.streets.url).toContain('basemap.nationalmap.gov/');
    expect(BASEMAPS.streets.attribution).toContain('USGS');
    expect(initialBasemap('osm', 'file:')).toBe('streets');
    expect(basemapAvailable('osm', 'file:')).toBe(false);
    expect(initialBasemap('aerial', 'file:')).toBe('aerial');
    expect(initialBasemap('missing-provider', 'file:')).toBe('streets');
  });

  it('keeps standard OSM available from web addresses that can send a referrer', () => {
    expect(initialBasemap('osm', 'https:')).toBe('osm');
    expect(basemapAvailable('osm', 'http:')).toBe(true);
    expect(BASEMAPS.osm.url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  });
});
