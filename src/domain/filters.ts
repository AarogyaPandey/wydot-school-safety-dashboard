import type { Filters, SeverityGroup } from './types';
import { SCHOOL_LEVELS, TIME_LABELS } from './types';

export const DEFAULT_FILTERS: Filters = {
  schoolId: 'all', level: 'all', bufferFt: 1000, startYear: 2016, endYear: 2025,
  severities: ['fatal-serious', 'minor-possible', 'pdo', 'unknown'],
  involvement: 'all', schoolDays: false, time: 'all', bounds: null,
};
const integer = (value: string | null, fallback: number, min: number, max: number) => {
  if (value === null || !/^\d+$/.test(value)) return fallback;
  return Math.min(max, Math.max(min, Number(value)));
};
export function parseFilters(search: string): Filters {
  const p = new URLSearchParams(search);
  const startYear = integer(p.get('from'), 2016, 1994, 2026);
  const endYear = integer(p.get('to'), 2025, 1994, 2026);
  const buffer = Number(p.get('buffer'));
  const severityValues = p.get('severity');
  const allowed = DEFAULT_FILTERS.severities;
  const severities = severityValues === null ? [...allowed] : [...new Set(severityValues.split(',').filter(s => allowed.includes(s as SeverityGroup)))] as SeverityGroup[];
  const boundsRaw = p.get('bounds')?.split(',').map(Number);
  const bounds = boundsRaw?.length === 4 && boundsRaw.every(Number.isFinite)
    && boundsRaw[0] >= -90 && boundsRaw[2] <= 90 && boundsRaw[1] >= -180 && boundsRaw[3] <= 180
    && boundsRaw[0] <= boundsRaw[2] && boundsRaw[1] <= boundsRaw[3]
    ? { south: boundsRaw[0], west: boundsRaw[1], north: boundsRaw[2], east: boundsRaw[3] } : null;
  return {
    schoolId: p.get('school') || 'all', level: SCHOOL_LEVELS.includes(p.get('level') as never) ? p.get('level') as Filters['level'] : 'all',
    bufferFt: [500, 1000, 1320].includes(buffer) ? buffer as Filters['bufferFt'] : 1000,
    startYear: Math.min(startYear, endYear), endYear: Math.max(startYear, endYear), severities,
    involvement: ['ped-bike', 'pedestrian', 'cyclist', 'unknown'].includes(p.get('involvement') || '') ? p.get('involvement') as Filters['involvement'] : 'all',
    schoolDays: p.get('days') === 'school', time: Object.hasOwn(TIME_LABELS, p.get('time') || '') ? p.get('time') as Filters['time'] : 'all', bounds,
  };
}
export function serializeFilters(filters: Filters): string {
  const p = new URLSearchParams();
  if (filters.schoolId !== 'all') p.set('school', filters.schoolId);
  if (filters.level !== 'all') p.set('level', filters.level);
  if (filters.bufferFt !== 1000) p.set('buffer', String(filters.bufferFt));
  if (filters.startYear !== 2016) p.set('from', String(filters.startYear));
  if (filters.endYear !== 2025) p.set('to', String(filters.endYear));
  if (filters.severities.length !== 4) p.set('severity', filters.severities.join(','));
  if (filters.involvement !== 'all') p.set('involvement', filters.involvement);
  if (filters.schoolDays) p.set('days', 'school');
  if (filters.time !== 'all') p.set('time', filters.time);
  if (filters.bounds) {
    const b = filters.bounds;
    p.set('bounds', [b.south, b.west, b.north, b.east].map(n => n.toFixed(6)).join(','));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}
export const formatClock = (hhmm: number) => `${String(Math.floor(hhmm / 100)).padStart(2, '0')}:${String(hhmm % 100).padStart(2, '0')}`;
export const formatDate = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1]} ${day}, ${year}`;
};
