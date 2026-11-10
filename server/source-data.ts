import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import type { FeatureCollection } from 'geojson';
import { researchDatasetSchema, type Crash, type CrashSchoolLink, type ResearchDataset, type School, type Severity, type TableRow } from '../src/domain/types';
import { clipRoadFeatures } from './geometry';

const execute = promisify(execFile);
export type SourceOptions = { dashboardDir: string; schoolFile: string; pythonCommand: string; projectDir: string };
export function sourceOptions(env: Record<string, string> = {}, projectDir = process.cwd()): SourceOptions {
  return {
    dashboardDir: path.resolve(projectDir, env.PHASE2_DASHBOARD_DIR || process.env.PHASE2_DASHBOARD_DIR || '../dashboard_build/dashboard_build/dashboard'),
    schoolFile: path.resolve(projectDir, env.PHASE2_SCHOOLS_FILE || process.env.PHASE2_SCHOOLS_FILE || '../wydot_phase2/cheyenne-school-zone-safety/5200draft_Donovan/Cheyenne_Schools_Listing.xlsx'),
    pythonCommand: env.PYTHON_COMMAND || process.env.PYTHON_COMMAND || 'python', projectDir,
  };
}
export const parseCsv = (text: string): Record<string, string>[] => parse(text, { columns: true, bom: true, skip_empty_lines: true, trim: true });
const readCsv = async (directory: string, filename: string) => parseCsv(await readFile(path.join(directory, filename), 'utf8'));
const flag = (value: string) => value === 'Yes' ? true : value === 'No' ? false : null;
export const schoolId = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const SEVERITIES: Record<string, Severity> = {
  'FATAL INJURY': 'fatal', 'SUSPECTED SERIOUS INJURY': 'serious', 'SUSPECTED MINOR INJURY': 'minor',
  'POSSIBLE INJURY': 'possible', 'PROPERTY DAMAGE ONLY': 'pdo', UNKNOWN: 'unknown',
};
const rawSchoolsSchema = z.array(z.object({ name: z.string(), rawLevel: z.string(), address: z.string(), lat: z.number(), lon: z.number() }));

export async function loadResearchDataset(options: SourceOptions): Promise<ResearchDataset> {
  const [schoolResult, rows, infrastructure] = await Promise.all([
    execute(options.pythonCommand, ['-B', path.join(options.projectDir, 'scripts/read-schools.py'), options.schoolFile], { windowsHide: true, maxBuffer: 1024 * 1024 }),
    readCsv(options.dashboardDir, 'dashboard_crashes.csv'),
    readCsv(options.dashboardDir, 'school_infrastructure.csv'),
  ]);
  const rawSchools = rawSchoolsSchema.parse(JSON.parse(schoolResult.stdout));
  const linkedNames = new Set(rows.map(r => r.School.trim().toLowerCase()));
  const schools: School[] = rawSchools.map<School>(s => ({
    id: schoolId(s.name), name: s.name, address: s.address, lat: s.lat, lon: s.lon,
    level: s.rawLevel.includes('ELEM') ? 'Elementary' : /MIDDLE|JUNIOR/.test(s.rawLevel) ? 'Middle' : s.rawLevel.includes('HIGH') ? 'High school' : 'Other',
    hasLinkedRecords: linkedNames.has(s.name.trim().toLowerCase()),
  })).sort((a, b) => a.name.localeCompare(b.name));
  if (new Set(schools.map(s => s.id)).size !== schools.length) throw new Error('School identifiers collide.');
  const ids = new Set(schools.map(s => s.id));
  const crashes = new Map<string, Crash>(), links: CrashSchoolLink[] = [], pairKeys = new Set<string>();
  for (const row of rows) {
    const id = row.crash_id, sid = schoolId(row.School);
    if (!ids.has(sid)) throw new Error('A crash-school relationship has no workbook school.');
    const key = `${id}:${sid}`;
    if (pairKeys.has(key)) throw new Error('Duplicate crash-school pair.');
    pairKeys.add(key);
    if (!Object.hasOwn(SEVERITIES, row.severity)) throw new Error('Unrecognized severity value.');
    const candidate = {
      id, year: Number(row.year), date: row.date, month: Number(row.month), weekday: row.day_of_week,
      hhmm: Number(row.hhmm), hour: Number(row.hour), severity: SEVERITIES[row.severity],
      pedestrian: flag(row.pedestrian), cyclist: flag(row.cyclist), schoolDay: row.school_day === 'TRUE',
      lon: Number(row.lon), lat: Number(row.lat),
    } as Crash;
    const existing = crashes.get(id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(candidate)) throw new Error('Conflicting attributes for one crash ID.');
    if (!existing) crashes.set(id, candidate);
    links.push({ crashId: id, schoolId: sid, distanceFt: Number(row.dist_ft), window: row.window as CrashSchoolLink['window'] });
  }
  const unique = [...crashes.values()];
  const years = unique.map(c => c.year);
  const latestDate = unique.reduce((max, c) => c.date > max ? c.date : max, '');
  return researchDatasetSchema.parse({
    schemaVersion: 1, mode: 'local-research', schools, crashes: unique, links,
    infrastructure: infrastructure.map(r => Object.fromEntries(Object.entries(r).map(([key, value]) => [key, value === 'NA' || value === '' ? null : value === 'TRUE' ? true : value === 'FALSE' ? false : key === 'School' ? value : Number(value)]))),
    metadata: { firstYear: Math.min(...years), lastYear: Math.max(...years), completeThrough: 2025, latestDate, sourcePairCount: rows.length, sourceUniqueCount: crashes.size, baselineStatus: 'provisional' },
  });
}
export const LAYER_FILES = {
  crosswalks: 'crosswalks.geojson', sidewalks: 'sidewalks.geojson', signals: 'pedestrian_signals.geojson',
  speed: 'speedlimits.geojson', aadt: 'aadt.geojson', roads: 'functionalclassifications.geojson',
  'hot-all-recent': 'hotspots_all_2016_2025.geojson', 'hot-all-history': 'hotspots_all_1994_2025.geojson',
  'hot-serious': 'hotspots_fatal_serious_all.geojson', 'hot-ped-bike': 'hotspots_ped_bike_2016_2025.geojson',
  'hot-school-day': 'hotspots_school_day_2016_2025.geojson',
} as const;
export type LayerKey = keyof typeof LAYER_FILES;
export async function loadLayer(options: SourceOptions, key: LayerKey, trafficYear = 2025): Promise<FeatureCollection> {
  let data = JSON.parse(await readFile(path.join(options.dashboardDir, LAYER_FILES[key]), 'utf8')) as FeatureCollection;
  if (key === 'aadt') data = { ...data, features: data.features.filter(f => Number(f.properties?.traffic_year) === trafficYear) };
  if (key === 'aadt' || key === 'roads' || key === 'speed') data = clipRoadFeatures(data);
  return data;
}
export const ANALYSIS_FILES = {
  trends: 'school_trends.csv', density: 'zone_vs_city_density.csv', conditions: 'conditions_mix.csv',
  timing: 'conditions_space_time_by_school.csv', intersections: 'top_intersections_near_schools.csv',
  speedRates: 'speed_rates.csv', speedModels: 'speed_models.csv', pedestrian: 'ped_facility_comparison.csv',
} as const;
export async function loadAnalysis(options: SourceOptions): Promise<Record<keyof typeof ANALYSIS_FILES, TableRow[]>> {
  const entries = await Promise.all(Object.entries(ANALYSIS_FILES).map(async ([key, filename]) => {
    const rows = await readCsv(options.dashboardDir, filename);
    return [key, rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v === 'NA' || v === '' ? null : /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(v) ? Number(v) : v])))] as const;
  }));
  return Object.fromEntries(entries) as Record<keyof typeof ANALYSIS_FILES, TableRow[]>;
}
