# Methodology and invariants

## Source cleaning retained

Phase 2 deduplicates `reportid` / `INTCRASHID`, removes invalid/zero coordinates, and excludes locations within 25 ft of `(753850, 238950)` in EPSG:3736. This rule is not a blanket removal of repeated locations. The inspected export contains no crashes within that exclusion radius.

The original inputs are unavailable in this checkout; Phase 3 consumes the existing cleaned export and does not claim to rerun original cleaning. Its adapter validates types, local clock values, unique school relationships, consistent attributes for repeated crash IDs, and school roster references. No input files are changed.

## Counting and filters

1. Apply crash-level year, severity, involvement, assumed school-day, clock-block, and optional rectangle filters.
2. Retain school relationships satisfying selected school/level, buffer distance, and source arrival/dismissal category.
3. Deduplicate by crash ID for global counts, map points, year/hour/severity charts, and heatmaps.
4. Count each unique qualifying crash for each qualifying school in the comparison table. Those school totals overlap and are not additive.

Default period is complete years 2016–2025. All statistics on the overview refer to school-linked records only. 2026 can be selected but remains explicitly incomplete. Unknown involvement is not interpreted as false.

Distances use the original rounded `dist_ft`; Phase 3 does not pretend to recover unrounded distances. Display circles use the US survey foot conversion to meters. Leaflet circles are context graphics, not a new regulatory zone dataset or exact reproduction of the projected R buffer at sub-foot precision.

## Local time and school assumptions

Dates and HHMM values are preserved as stored local readings. No `new Date(source_timestamp)` conversion is used. The four original time blocks are 00:00–06:00, 06:01–12:00, 12:01–18:00, and 18:01–23:59.

Assumed school days are weekdays in August 20–May 25, without holiday removal. Assumed arrival/dismissal ranges are 07:00–09:00 and 14:30–16:30 inclusive. Per-relationship classifications from the export are used. Verified bell schedules are not supplied.

## Map context

The local adapter clips display road segments to longitude/latitude `[-105.12, 41.02, -104.60, 41.28]` using segment intersection. This visualization context box is not the city boundary or analytical study area. AADT is filtered to the chosen observation year before display. No historical traffic exposure is invented.

The rectangle tool filters actual local research point coordinates. It does not infer counts outside the available school-linked export. In a future aggregate public release, query tools must operate only at the approved aggregate resolution.

## Fixed Phase 2 inference

Hotspots: 1,000-ft grid; Getis–Ord Gi*; queen neighbors with self; two-sided normal p-values; Benjamini–Hochberg adjustment. Five populations: all 1994–2025, all 2016–2025, fatal/serious 1994–2025, ped/bike 2016–2025, school-day 2016–2025. Selecting filters does not recompute these results.

School trends: Poisson annual counts, BH-adjusted p-values; complete periods 1994–2025 and 2016–2025. Zone/city density: exact Poisson comparisons by area, not traffic/pedestrian exposure. Conditions and crossing proximity retain their original populations and incomplete infrastructure coverage. All are exploratory associations.

Speed exposure results are withheld because every supplied per-million-vehicle-mile rate is missing and traffic-year matching/road extent need reconciliation. No causal claim or measured crash speed is inferred.

## Exports

CSV contains aggregate dimensions (overall/year/hour/severity/school), filter context, research status, and coverage caveats. It contains no crash IDs, exact coordinates, incident dates, or minute times. Cells are escaped and spreadsheet formulas neutralized. PNG contains chart data, research status, context, and interpretation caveats. Both are local research artifacts pending redistribution review.
