import { z } from 'zod';

export const schoolLevelSchema = z.enum(['Elementary', 'Middle', 'High school', 'Other']);
export type SchoolLevel = z.infer<typeof schoolLevelSchema>;
export const severitySchema = z.enum(['fatal', 'serious', 'minor', 'possible', 'pdo', 'unknown']);
export type Severity = z.infer<typeof severitySchema>;
export const timeWindowSchema = z.enum(['Arrival', 'Dismissal', 'Other school-day hours', 'Not a school day']);
export type TimeWindow = z.infer<typeof timeWindowSchema>;
export const schoolSchema = z.object({
  id: z.string(), name: z.string(), level: schoolLevelSchema, address: z.string(),
  lat: z.number().min(40).max(43), lon: z.number().min(-107).max(-103), hasLinkedRecords: z.boolean(),
});
export type School = z.infer<typeof schoolSchema>;
export const crashSchema = z.object({
  id: z.string(), year: z.number().int(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  month: z.number().int().min(1).max(12), weekday: z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']),
  hhmm: z.number().int().min(0).max(2359).refine(n => n % 100 < 60), hour: z.number().int().min(0).max(23),
  severity: severitySchema, pedestrian: z.boolean().nullable(), cyclist: z.boolean().nullable(),
  schoolDay: z.boolean(), lon: z.number().min(-107).max(-103), lat: z.number().min(40).max(43),
});
export type Crash = z.infer<typeof crashSchema>;
export const linkSchema = z.object({ crashId: z.string(), schoolId: z.string(), distanceFt: z.number().nonnegative(), window: timeWindowSchema });
export type CrashSchoolLink = z.infer<typeof linkSchema>;
export const scalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export type TableRow = Record<string, z.infer<typeof scalarSchema>>;
export const researchDatasetSchema = z.object({
  schemaVersion: z.literal(1), mode: z.literal('local-research'),
  schools: z.array(schoolSchema), crashes: z.array(crashSchema), links: z.array(linkSchema),
  infrastructure: z.array(z.record(z.string(), scalarSchema)),
  metadata: z.object({
    firstYear: z.number(), lastYear: z.number(), completeThrough: z.number(), latestDate: z.string(),
    sourcePairCount: z.number(), sourceUniqueCount: z.number(), baselineStatus: z.literal('provisional'),
  }),
});
export type ResearchDataset = z.infer<typeof researchDatasetSchema>;
export type Bounds = { south: number; west: number; north: number; east: number };
export type SeverityGroup = 'fatal-serious' | 'minor-possible' | 'pdo' | 'unknown';
export type TimeFilter = 'all' | 'arrival' | 'dismissal' | 'early' | 'morning' | 'afternoon' | 'night';
export type Filters = {
  schoolId: string; level: SchoolLevel | 'all'; bufferFt: 500 | 1000 | 1320;
  startYear: number; endYear: number; severities: SeverityGroup[];
  involvement: 'all' | 'ped-bike' | 'pedestrian' | 'cyclist' | 'unknown';
  schoolDays: boolean; time: TimeFilter; bounds: Bounds | null;
};
export type MatchedCrash = { crash: Crash; links: CrashSchoolLink[] };
export type SchoolCount = { school: School; crashes: number; fatalSerious: number; pedBike: number };
export const SEVERITY_GROUPS: { id: SeverityGroup; label: string; color: string }[] = [
  { id: 'fatal-serious', label: 'Fatal or serious injury', color: '#9c3d35' },
  { id: 'minor-possible', label: 'Minor or possible injury', color: '#d88c50' },
  { id: 'pdo', label: 'Property damage only', color: '#31857b' },
  { id: 'unknown', label: 'Unknown severity', color: '#919b9a' },
];
export const SEVERITY_LABELS: Record<Severity, string> = {
  fatal: 'Fatal injury', serious: 'Suspected serious injury', minor: 'Suspected minor injury',
  possible: 'Possible injury', pdo: 'Property damage only', unknown: 'Unknown severity',
};
export const SCHOOL_LEVELS: SchoolLevel[] = ['Elementary', 'Middle', 'High school', 'Other'];
export const TIME_LABELS: Record<TimeFilter, string> = {
  all: 'All hours', arrival: 'Arrival · 07:00–09:00*', dismissal: 'Dismissal · 14:30–16:30*',
  early: 'Early morning · 00:00–06:00', morning: 'Morning · 06:01–12:00',
  afternoon: 'Afternoon · 12:01–18:00', night: 'Night · 18:01–23:59',
};
