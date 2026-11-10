# Phase 2 audit and Phase 3 baseline

Audit date: November 9, 2026. Phase 2 and the standalone dashboard folder were inspected read-only. No source analysis scripts were executed: several create data files, install packages, or rebuild artifacts.

## Locations

- Phase 2: `../wydot_phase2/cheyenne-school-zone-safety`
- Standalone dashboard and exports: `../dashboard_build/dashboard_build`
- Phase 3: this existing repository; no new repository or project copy was created.

The original geodatabase, local configuration, generated GeoPackages, and bell-time CSV are absent from this checkout. Original-source counts/CRSs below come from saved audit outputs; delivered-file counts were checked directly.

## Available inputs

| Input | Count | Geometry / CRS |
| --- | ---: | --- |
| Workbook Cheyenne roster | 39 | Coordinates; WGS84 lon/lat |
| Earlier school CSV | 35 rows; 34 normalized names | Coordinates; WGS84 |
| Dashboard crash–school pairs | 11,510 pairs; 10,457 unique crashes | Point coordinate columns; WGS84 |
| Crosswalks | 354 | MultiPolygon; CRS84 |
| Sidewalks | 554 | MultiPolygon; CRS84 |
| Pedestrian signals | 364 | Point; CRS84 |
| Speed limits | 94 | MultiLineString; CRS84 |
| AADT | 7,761; 1,839 unique geometries | MultiLineString; CRS84; 2021–2025 |
| Functional classifications | 1,797 | MultiLineString; CRS84 |
| Five hotspot files | 1,594 each | Polygon; CRS84 |
| Ped/bike crashes without nearby mapped crosswalk | 171 | Point; CRS84; restricted crash-level data |

All supplied GeoJSON geometries passed validity/null/empty checks. Original statewide CrashPoints inventory: 537,445 points, EPSG:3857. Original extract: 18,914 point rows / 16,091 unique IDs, EPSG:4326. Boundary: five MultiPolygons, EPSG:3736. Source infrastructure includes custom WYDOT Albers + NAVD88 feet and Z geometry; functional class ESRI:103978. Analysis flattens Z and uses EPSG:3736, US survey feet; exports use CRS84.

## Saved analysis tables

School summary/infrastructure: 39 each; school/year 1,287; school/hour 936; school/severity 134; trends and school/city density 78 each; study area/year/hour 792; zone/city density four; hotspot table 526. Conditions: mix 104, severity 48, road class 18, school-day hours 48, crossing distance six, school timing 29. Intersections 30; repeated locations 20. Speed rates five, severity ten, models 16. Pedestrian facility comparison six, junction eight, timing four.

## Material findings

1. The prep log reports 56,089 study-area crashes, while later year totals and the rendered report total 54,003. The current cleaning code contains default-coordinate removal absent from that prep log. The precise run lineage cannot be established without original inputs.
2. The current relationship export gives 5,163 distinct IDs at its rounded 1,000-ft threshold; earlier reports give 5,108. School counts at that threshold sum to 5,330 because zones overlap.
3. The old Python dashboard reconstructs school coordinates and omits three schools. The actual workbook has coordinates for all 39, including Gilchrist, Meadowlark Academy, and Prairie Wind. Their absent links require study-coverage review, not a claim of zero crashes.
4. The old all-schools table groups records after nearest-school deduplication and undercounts shared school relationships. Phase 3 separates unique global counting from per-school relationship counting.
5. Road files retain entire intersecting geometries, including far-away portions. Phase 3 clips display lines using actual segment intersections with a context box, without redefining the analytical study area.
6. AADT repeats geometry for observation years. Phase 3 displays one selected year; it does not infer historical traffic exposure.
7. All supplied per-million-vehicle-mile rates are missing. Speed exposure/model results require review and are withheld from dashboard interpretation.
8. Older ped/bike flags are unknown; some modern flags are missing too. Functional classifications include local roads and collectors despite some source comments describing state routes.
9. Statistical hotspots, trends, density, and extended tables are fixed analyses. They are labeled independently of interactive filters.
10. The standalone HTML, packed JSON, and rendered map reports embed crash records. None is cleared for publication by its mere existence in the project.

The source dashboard HTML embeds data identical to its approximately 5.3-MB packed JSON. No redistribution agreement was found in the supplied materials. [WYDOT crash-data guidance](https://www.dot.state.wy.us/home/dot_safety/crash-data.html) describes public reports and additional data requests; it is not a release license for this extract.

## Baseline policy

Phase 3 uses the delivered relationship export as a **provisional local exploration baseline**. It does not silently combine incompatible run totals, reconstruct absent citywide records, or recompute statistical inference from a partial population. `npm run audit:data` verifies this known baseline. Original-data reconciliation and redistribution review remain external prerequisites for a public analytical release.
