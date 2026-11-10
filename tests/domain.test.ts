import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS, formatClock, formatDate, parseFilters, serializeFilters } from '../src/domain/filters';
import { selectMatches, selectSchoolCounts, seriesByHour, seriesByYear, summarize } from '../src/domain/selectors';
import { crashSchema } from '../src/domain/types';
import { fixtureDataset } from './fixtures/research';
import { buildAggregateCsv, csvCell } from '../src/features/exports/aggregates';

describe('crash accounting', () => {
  it('counts a shared crash once globally and once for EACH qualifying school', () => {
    const matches = selectMatches(fixtureDataset, DEFAULT_FILTERS);
    expect(matches).toHaveLength(2);
    expect(summarize(matches)).toMatchObject({ total: 2, fatalSerious: 1, pedBike: 1 });
    const schools = selectSchoolCounts(fixtureDataset, matches, DEFAULT_FILTERS);
    expect(schools.find(s => s.school.id === 'fixture-west')?.crashes).toBe(2);
    expect(schools.find(s => s.school.id === 'fixture-east')?.crashes).toBe(1);
    expect(schools.reduce((n, s) => n + s.crashes, 0)).toBe(3);
  });
  it('uses the qualifying relationship rather than an arbitrary nearest-school assignment', () => {
    const matches = selectMatches(fixtureDataset, { ...DEFAULT_FILTERS, schoolId: 'fixture-east' });
    expect(matches).toHaveLength(1);
    expect(matches[0].links.map(l => l.schoolId)).toEqual(['fixture-east']);
  });
  it('honors distance edges, level, involvement, severity, and map bounds together', () => {
    expect(selectMatches(fixtureDataset, { ...DEFAULT_FILTERS, bufferFt: 500 })).toHaveLength(1);
    expect(selectMatches(fixtureDataset, { ...DEFAULT_FILTERS, level: 'Middle', bufferFt: 500 })).toHaveLength(0);
    expect(selectMatches(fixtureDataset, { ...DEFAULT_FILTERS, involvement: 'ped-bike', severities: ['fatal-serious'] })).toHaveLength(1);
    expect(selectMatches(fixtureDataset, { ...DEFAULT_FILTERS, bounds: { south: 41.139, north: 41.141, west: -104.8005, east: -104.7995 } })).toHaveLength(1);
    expect(selectMatches(fixtureDataset, { ...DEFAULT_FILTERS, severities: [] })).toHaveLength(0);
  });
  it('keeps unknown flags separate from known non-involvement', () => {
    const historical = { ...DEFAULT_FILTERS, startYear: 2010, endYear: 2025 };
    const all = selectMatches(fixtureDataset, historical);
    expect(summarize(all).unknownInvolvement).toBe(1);
    expect(selectMatches(fixtureDataset, { ...historical, involvement: 'unknown' })).toHaveLength(1);
    expect(selectMatches(fixtureDataset, { ...historical, involvement: 'ped-bike' })).toHaveLength(1);
  });
  it('excludes incomplete 2026 by default and only includes it when selected', () => {
    expect(selectMatches(fixtureDataset, DEFAULT_FILTERS).some(m => m.crash.year === 2026)).toBe(false);
    expect(selectMatches(fixtureDataset, { ...DEFAULT_FILTERS, endYear: 2026 })).toHaveLength(3);
  });
  it('preserves unverified school coverage instead of dropping schools without links', () => {
    const schools = selectSchoolCounts(fixtureDataset, selectMatches(fixtureDataset, DEFAULT_FILTERS), DEFAULT_FILTERS);
    expect(schools.find(r => r.school.id === 'fixture-uncovered')).toMatchObject({ crashes: 0, school: { hasLinkedRecords: false } });
  });
});
describe('local dates, clock values, and boundary hours', () => {
  it('formats stored wall-clock values without timezone conversion', () => {
    expect(formatClock(5)).toBe('00:05'); expect(formatClock(700)).toBe('07:00'); expect(formatClock(1630)).toBe('16:30');
    expect(formatDate('2026-09-04')).toBe('Sep 4, 2026');
    expect(crashSchema.safeParse({ ...fixtureDataset.crashes[0], hhmm: 1260 }).success).toBe(false);
  });
  it('retains the Phase 2 06:00/06:01 and 12:00/12:01 block boundaries', () => {
    const data = { ...fixtureDataset, crashes: [{ ...fixtureDataset.crashes[0], hhmm: 600, hour: 6 }] };
    expect(selectMatches(data, { ...DEFAULT_FILTERS, time: 'early' })).toHaveLength(1);
    expect(selectMatches(data, { ...DEFAULT_FILTERS, time: 'morning' })).toHaveLength(0);
    data.crashes[0] = { ...data.crashes[0], hhmm: 601 };
    expect(selectMatches(data, { ...DEFAULT_FILTERS, time: 'morning' })).toHaveLength(1);
    data.crashes[0] = { ...data.crashes[0], hhmm: 1200, hour: 12 };
    expect(selectMatches(data, { ...DEFAULT_FILTERS, time: 'morning' })).toHaveLength(1);
    data.crashes[0] = { ...data.crashes[0], hhmm: 1201 };
    expect(selectMatches(data, { ...DEFAULT_FILTERS, time: 'afternoon' })).toHaveLength(1);
  });
  it('uses source bell classifications, including a 16:30 dismissal record', () => {
    const matches = selectMatches(fixtureDataset, { ...DEFAULT_FILTERS, time: 'dismissal' });
    expect(matches).toHaveLength(1); expect(matches[0].crash.hhmm).toBe(1630);
    expect(seriesByHour(matches)[16].count).toBe(1);
    expect(seriesByYear(matches, 2019, 2021)).toEqual([{ year: 2019, count: 0 }, { year: 2020, count: 1 }, { year: 2021, count: 0 }]);
  });
});
describe('shared URL filters and aggregate exports', () => {
  it('round-trips a view, including no selected severity and a map query', () => {
    const f = { ...DEFAULT_FILTERS, schoolId: 'fixture-west', severities: [], bounds: { south: 41.1, west: -104.9, north: 41.2, east: -104.7 } };
    expect(parseFilters(serializeFilters(f))).toEqual(f);
    expect(parseFilters('?from=2026&to=1994&buffer=999&time=bad&bounds=hello')).toMatchObject({ startYear: 1994, endYear: 2026, bufferFt: 1000, time: 'all', bounds: null });
  });
  it('exports contextual aggregates and no crash-level IDs, locations, dates, or times', () => {
    const matches = selectMatches(fixtureDataset, DEFAULT_FILTERS);
    const text = buildAggregateCsv(matches, selectSchoolCounts(fixtureDataset, matches, DEFAULT_FILTERS), DEFAULT_FILTERS);
    expect(text).toContain('LOCAL RESEARCH ONLY'); expect(text).toContain('redistribution not approved');
    expect(text).toContain('Fixture East School'); expect(text).toContain('No linked records; study coverage unverified');
    for (const c of fixtureDataset.crashes) { expect(text).not.toContain(c.id); expect(text).not.toContain(c.date); expect(text).not.toContain(String(c.lon)); }
    expect(csvCell('=SUM(1,2)')).toBe('"\'=SUM(1,2)"');
    expect(csvCell('a "quoted" name')).toBe('"a ""quoted"" name"');
  });
});
