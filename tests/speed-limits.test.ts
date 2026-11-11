import { describe, expect, it } from 'vitest';
import { applySchoolZoneSpeedAssumption, speedLimitCategories, speedLimitColor, type SchoolBufferCenter } from '../src/features/map/speed-limits';
import { normalizeCountySpeedFeature } from '../server/source-data';

const geometry = { type: 'LineString' as const, coordinates: [[-104.8, 41.1], [-104.7, 41.2]] };

describe('posted speed-limit symbology', () => {
  it('creates a distinct color for each sorted limit and a separate category for missing values', () => {
    const categories = speedLimitCategories([
      { type: 'Feature', properties: { speed_limit: 45 }, geometry },
      { type: 'Feature', properties: { speed_limit: 30 }, geometry },
      { type: 'Feature', properties: { speed_limit: '45' }, geometry },
      { type: 'Feature', properties: { speed_limit: null }, geometry },
    ]);

    expect(categories.map(category => category.label)).toEqual(['30 mph', '45 mph', 'Unknown / not recorded']);
    expect(new Set(categories.map(category => category.color)).size).toBe(categories.length);
    expect(speedLimitColor(45, categories)).toBe(categories[1].color);
    expect(speedLimitColor(undefined, categories)).toBe(categories[2].color);
  });

  it('keeps zero as unspecified and treats invalid and negative limits as not recorded', () => {
    const categories = speedLimitCategories([
      { type: 'Feature', properties: { speed_limit: 0 }, geometry },
      { type: 'Feature', properties: { speed_limit: -5 }, geometry },
      { type: 'Feature', properties: { speed_limit: 'unknown' }, geometry },
    ]);
    expect(categories.map(category => category.label)).toEqual(['Unspecified (0)', 'Unknown / not recorded']);
  });

  it('assigns a distinct swatch to every current source value, including unknown', () => {
    const categories = speedLimitCategories([0, 1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 65, 75, null]
      .map(speed_limit => ({ type: 'Feature' as const, properties: { speed_limit }, geometry })));
    expect(new Set(categories.map(category => category.color)).size).toBe(categories.length);
  });

  it('splits lines at school buffers and retains source limits for assumed sections', () => {
    const feature = {
      type: 'Feature' as const,
      properties: { speed_limit: 35, speed_limit_source: 'Test source' },
      geometry: { type: 'LineString' as const, coordinates: [[-0.01, 0], [0.01, 0]] },
    };
    const pieces = applySchoolZoneSpeedAssumption([feature], [[0, 0]], 500);
    const overridden = pieces.filter(piece => piece.properties.school_zone_speed_override);
    const outside = pieces.filter(piece => !piece.properties.school_zone_speed_override);

    expect(new Set(pieces.map(piece => piece.id)).size).toBe(pieces.length);
    expect(outside).toHaveLength(2);
    expect(overridden).toHaveLength(1);
    expect(overridden[0].properties).toMatchObject({
      speed_limit: 20,
      source_speed_limit: 35,
      speed_limit_source: 'Test source',
      school_zone_speed_override: true,
    });
    expect(outside.every(piece => piece.properties.speed_limit === 35 && piece.properties.source_speed_limit === 35)).toBe(true);

    const categories = speedLimitCategories(pieces);
    expect(categories.map(category => category.label)).toContain('20 mph · school-zone assumption');
    expect(speedLimitColor(20, categories)).not.toBe(speedLimitColor(20, categories, true));
  });

  it('unions overlapping school buffers and expands the override at each selected distance', () => {
    const feature = {
      type: 'Feature' as const,
      properties: { speed_limit: 30 },
      geometry: { type: 'LineString' as const, coordinates: [[-0.02, 0], [0.02, 0]] },
    };
    const centers: SchoolBufferCenter[] = [[-0.001, 0], [0, 0], [0.001, 0]];
    const overlappingPieces = applySchoolZoneSpeedAssumption([feature], centers, 500);
    expect(overlappingPieces).toHaveLength(3);
    const lengths = [500, 1000, 1320].map(distance => {
      const overridden = applySchoolZoneSpeedAssumption([feature], centers, distance)
        .filter(piece => piece.properties.school_zone_speed_override);
      return overridden.reduce((total, piece) => {
        if (piece.geometry.type !== 'LineString') throw new Error('Expected split line geometry.');
        const [start, end] = piece.geometry.coordinates;
        return total + Math.abs(end[0] - start[0]);
      }, 0);
    });

    expect(lengths[0]).toBeGreaterThan(0);
    expect(lengths[1]).toBeGreaterThan(lengths[0]);
    expect(lengths[2]).toBeGreaterThan(lengths[1]);
  });

  it('retains a county source zero as unspecified and keeps its provenance and road name', () => {
    const feature = normalizeCountySpeedFeature({
      type: 'Feature',
      id: 12,
      properties: { FID: 12, speedlim: 0, st_name: 'MAIN ST' },
      geometry,
    });
    expect(feature.properties).toMatchObject({
      speed_limit: 0,
      speed_limit_source: 'Laramie County GIS Cooperative · LC_Maintained',
      road_name: 'MAIN ST',
    });
    expect(speedLimitColor(feature.properties?.speed_limit, speedLimitCategories([feature]))).toBe(speedLimitCategories([feature])[0].color);
  });
});
