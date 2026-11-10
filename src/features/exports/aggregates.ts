import type { Filters, MatchedCrash, SchoolCount } from '../../domain/types';
import { SEVERITY_GROUPS } from '../../domain/types';
import { severityGroup, seriesByHour, seriesByYear } from '../../domain/selectors';

export function csvCell(value: string | number): string {
  const text = String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function buildAggregateCsv(matches: MatchedCrash[], schools: SchoolCount[], filters: Filters): string {
  const context = `LOCAL RESEARCH ONLY; redistribution not approved; provisional baseline; years ${filters.startYear}-${filters.endYear}; distance ${filters.bufferFt} ft; school ${filters.schoolId}; level ${filters.level}; severities ${filters.severities.join('|') || 'none'}; involvement ${filters.involvement}; time ${filters.time}; assumed school days ${filters.schoolDays}; area ${filters.bounds ? JSON.stringify(filters.bounds) : 'all'}; ${filters.endYear === 2026 ? '2026 incomplete; ' : ''}school counts overlap; no linked records require coverage review`;
  const rows: (string | number)[][] = [['status', context], ['dimension', 'category', 'unique_crashes', 'coverage_note']];
  rows.push(['all', 'Filtered crashes', matches.length, 'School-linked export only']);
  seriesByYear(matches, filters.startYear, filters.endYear).forEach(r => rows.push(['year', r.year, r.count, r.year === 2026 ? 'Incomplete year' : '']));
  seriesByHour(matches).forEach(r => rows.push(['local_hour', r.hour, r.count, 'Local wall-clock hour']));
  SEVERITY_GROUPS.forEach(s => rows.push(['severity', s.label, matches.filter(m => severityGroup(m.crash.severity) === s.id).length, '']));
  schools.forEach(s => rows.push(['school', s.school.name, s.crashes, s.school.hasLinkedRecords ? 'Overlapping school counts; not additive' : 'No linked records; study coverage unverified']));
  return '\uFEFF' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
}
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
