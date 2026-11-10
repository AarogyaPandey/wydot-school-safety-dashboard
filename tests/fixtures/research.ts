import type { Crash, ResearchDataset } from '../../src/domain/types';

// Synthetic fixtures for arithmetic and boundary tests only. Never used by the application.
const base: Crash = { id: 'fixture-one', year: 2020, date: '2020-09-14', month: 9, weekday: 'Mon', hhmm: 800, hour: 8, severity: 'pdo', pedestrian: false, cyclist: false, schoolDay: true, lat: 41.14, lon: -104.8 };
export const fixtureDataset: ResearchDataset = {
  schemaVersion: 1, mode: 'local-research',
  schools: [
    { id: 'fixture-west', name: 'Fixture West School', level: 'Elementary', address: 'Test address west', lat: 41.14, lon: -104.8, hasLinkedRecords: true },
    { id: 'fixture-east', name: 'Fixture East School', level: 'Middle', address: 'Test address east', lat: 41.141, lon: -104.799, hasLinkedRecords: true },
    { id: 'fixture-uncovered', name: 'Fixture Uncovered School', level: 'Other', address: 'Unverified study coverage', lat: 41.23, lon: -105.07, hasLinkedRecords: false },
  ],
  crashes: [
    { ...base },
    { ...base, id: 'fixture-two', hhmm: 1630, hour: 16, severity: 'serious', pedestrian: true, lon: -104.801 },
    { ...base, id: 'fixture-historical', year: 2010, date: '2010-09-14', severity: 'unknown', pedestrian: null, cyclist: null },
    { ...base, id: 'fixture-partial', year: 2026, date: '2026-09-01' },
  ],
  links: [
    { crashId: 'fixture-one', schoolId: 'fixture-west', distanceFt: 500, window: 'Arrival' },
    { crashId: 'fixture-one', schoolId: 'fixture-east', distanceFt: 950, window: 'Arrival' },
    { crashId: 'fixture-two', schoolId: 'fixture-west', distanceFt: 1000, window: 'Dismissal' },
    { crashId: 'fixture-historical', schoolId: 'fixture-west', distanceFt: 400, window: 'Arrival' },
    { crashId: 'fixture-partial', schoolId: 'fixture-west', distanceFt: 400, window: 'Arrival' },
  ],
  infrastructure: [], metadata: { firstYear: 2010, lastYear: 2026, completeThrough: 2025, latestDate: '2026-09-01', sourcePairCount: 5, sourceUniqueCount: 4, baselineStatus: 'provisional' },
};
