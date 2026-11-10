import type { Crash, Filters, MatchedCrash, ResearchDataset, SchoolCount, Severity, SeverityGroup } from './types';

export const severityGroup = (severity: Severity): SeverityGroup => severity === 'fatal' || severity === 'serious' ? 'fatal-serious' : severity === 'minor' || severity === 'possible' ? 'minor-possible' : severity;
export const isPedBike = (crash: Crash) => crash.pedestrian === true || crash.cyclist === true;
export const flagsUnknown = (crash: Crash) => crash.pedestrian === null && crash.cyclist === null;
export function withinBounds(crash: Pick<Crash, 'lat' | 'lon'>, bounds: Filters['bounds']) {
  return !bounds || crash.lat >= bounds.south && crash.lat <= bounds.north && crash.lon >= bounds.west && crash.lon <= bounds.east;
}
function matchesCrash(c: Crash, f: Filters) {
  if (c.year < f.startYear || c.year > f.endYear || !f.severities.includes(severityGroup(c.severity))) return false;
  if (f.schoolDays && !c.schoolDay || !withinBounds(c, f.bounds)) return false;
  if (f.involvement === 'ped-bike' && !isPedBike(c) || f.involvement === 'pedestrian' && c.pedestrian !== true
    || f.involvement === 'cyclist' && c.cyclist !== true || f.involvement === 'unknown' && !flagsUnknown(c)) return false;
  if (f.time === 'early') return c.hhmm <= 600;
  if (f.time === 'morning') return c.hhmm >= 601 && c.hhmm <= 1200;
  if (f.time === 'afternoon') return c.hhmm >= 1201 && c.hhmm <= 1800;
  if (f.time === 'night') return c.hhmm >= 1801;
  return true;
}
export function selectMatches(data: ResearchDataset, filters: Filters): MatchedCrash[] {
  const schools = new Map(data.schools.map(s => [s.id, s]));
  const crashes = new Map(data.crashes.filter(c => matchesCrash(c, filters)).map(c => [c.id, c]));
  const result = new Map<string, MatchedCrash>();
  for (const link of data.links) {
    const crash = crashes.get(link.crashId);
    const school = schools.get(link.schoolId);
    if (!crash || !school || link.distanceFt > filters.bufferFt) continue;
    if (filters.schoolId !== 'all' && link.schoolId !== filters.schoolId || filters.level !== 'all' && school.level !== filters.level) continue;
    if (filters.time === 'arrival' && link.window !== 'Arrival' || filters.time === 'dismissal' && link.window !== 'Dismissal') continue;
    const existing = result.get(crash.id);
    if (existing) existing.links.push(link);
    else result.set(crash.id, { crash, links: [link] });
  }
  return [...result.values()];
}
export function selectSchoolCounts(data: ResearchDataset, matches: MatchedCrash[], filters: Filters): SchoolCount[] {
  const result = new Map(data.schools.filter(s => (filters.schoolId === 'all' || filters.schoolId === s.id) && (filters.level === 'all' || filters.level === s.level))
    .map(school => [school.id, { school, crashes: 0, fatalSerious: 0, pedBike: 0 }]));
  for (const { crash, links } of matches) {
    for (const schoolId of new Set(links.map(l => l.schoolId))) {
      const row = result.get(schoolId);
      if (!row) continue;
      row.crashes++;
      if (severityGroup(crash.severity) === 'fatal-serious') row.fatalSerious++;
      if (isPedBike(crash)) row.pedBike++;
    }
  }
  return [...result.values()].sort((a, b) => b.crashes - a.crashes || a.school.name.localeCompare(b.school.name));
}
export function summarize(matches: MatchedCrash[]) {
  return {
    total: matches.length,
    fatalSerious: matches.filter(m => severityGroup(m.crash.severity) === 'fatal-serious').length,
    pedBike: matches.filter(m => isPedBike(m.crash)).length,
    unknownInvolvement: matches.filter(m => flagsUnknown(m.crash)).length,
    schoolDays: matches.filter(m => m.crash.schoolDay).length,
  };
}
export function seriesByYear(matches: MatchedCrash[], startYear: number, endYear: number) {
  const counts = new Map<number, number>();
  for (const { crash } of matches) counts.set(crash.year, (counts.get(crash.year) || 0) + 1);
  return Array.from({ length: endYear - startYear + 1 }, (_, i) => ({ year: startYear + i, count: counts.get(startYear + i) || 0 }));
}
export function seriesByHour(matches: MatchedCrash[]) {
  const counts = Array<number>(24).fill(0);
  for (const { crash } of matches) counts[crash.hour]++;
  return counts.map((count, hour) => ({ hour, count }));
}
