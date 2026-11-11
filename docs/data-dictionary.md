# Data dictionary

All source data remains outside this repository. The local adapter creates typed, in-memory data; production contains none of these records.

## Interactive crash export

Original fields: `crash_id`, `School`, `level`, `dist_ft`, `year`, `date`, `month`, `day_of_week`, `hhmm`, `hour`, `severity`, `sev_group`, `pedestrian`, `cyclist`, `ped_or_bike`, `school_day`, `window`, `lon`, `lat`.

- `crash_id`: repeated across schools; used for global deduplication. Not exported in CSV.
- `dist_ft`: rounded straight-line distance in US survey feet. Threshold-edge membership is provisional.
- `date`, `hhmm`, `hour`: local date and clock readings; never parsed as a timezone-converting JavaScript timestamp.
- `severity`: fatal, suspected serious, suspected minor, possible injury, property damage only, unknown. Display groups combine fatal/serious and minor/possible.
- `pedestrian`, `cyclist`: `Yes`, `No`, `NA`; normalized to `true`, `false`, `null`. Combined involvement is true if either is true and unknown if both are missing, preserving Phase 2 behavior.
- `school_day`: assumed weekday/school-year indicator.
- `window`: Arrival, Dismissal, Other school-day hours, Not a school day. Retained on each school relationship.
- `lon`, `lat`: WGS84 degrees. Not included in aggregate exports.

The adapter separates these into one `Crash` per ID, `CrashSchoolLink` records, and a workbook-derived `School` roster. School IDs are deterministic normalized names; source IDs remain local research values.

## Schools

Workbook columns: `School`, `School Level`, `Address`, `City`, `Latitude`, `Longitude`. Cheyenne rows are deduplicated case-insensitively. Display levels: Elementary, Middle, High school, Other. `hasLinkedRecords` only indicates whether any relationship exists in the supplied export; it does not establish spatial coverage, operating status, or absence of crashes.

## Infrastructure and context

| Source | Principal fields |
| --- | --- |
| School infrastructure | `School`, `crosswalks`, `pedestrian_signals`, `sidewalk_segments`, `sidewalk_gaps_flagged`, `speed_limit_min`, `speed_limit_max`, `aadt_max`, `any_state_route_data` |
| Crosswalks | `location`, `marked`, `material`, `median`, `length_ft`, `area_sqft`, `routeid`, `uniqueid`, `recordedat`; endpoint coordinates/elevations, mile measures, shape area/length |
| Signals | `elevation`, `latitude`, `location`, `longitude`, `milemeasure`, `recordedat`, `routeid`, `uniqueid` |
| Sidewalks | `location`, `width_ft`, `length_ft`, `gaps`, `sidewalkgap`, `sidewalkseparation`, `lighting`, `material`, `connectstofacility`, `protrusions`, survey/provenance/endpoints |
| Speed limits | WYDOT state-route export: `speed_limit`, `speed_limit_type`, `speed_limit_status`, `route`, `from_rm`, `to_rm`, `side`, `sl_direction`, `installed_date`, `m10_date`, `acceptance_type`, `comments`, `district`, `id`, `Shape_Length`. Laramie County GIS Cooperative `LC_Maintained` FeatureServer layer 0: nullable integer `speedlim`, `st_name`, `FID`, and line geometry. |
| AADT | `aadt_volume`, `truck_aadt`, `traffic_year`, `route`, `from_rm`, `to_rm`, `Shape_Length` |
| Road class | `fsystemnumeric`, `fsystemtext`, `fsystemcomments`, `fsystemdate`, `routeid`, `beginpoint`, `endpoint`, `fromdate`, `todate`, `dataitem`, `eventid`, `globalid`, `stateid`, `Shape_Length` |
| Hotspots | `cell`, `n`, `gi_z`, `p_adj`, `hotspot`, `near_school`, `nearest_school`, `dist_school_ft` |

Numeric functional-class codes are preferred over mixed text codes. Zero inventory counts are not confirmed absence. AADT is vehicles/day for the displayed observation year; it is not pedestrian volume. Posted speed is not measured crash speed. The combined speed-limit view retains each source on its feature and has incomplete coverage; the county service extent is county-wide, not a complete city-street inventory. Its `speedlim=0` values are shown as unspecified, not as 0 mph, and null values remain unknown. The service reports its data last edited on April 14, 2022. The raw CrashPoints inventory has `speedinvolved`; it is an involvement flag and is not in the interactive export.

When the 500-ft, 1,000-ft, or 1/4-mile proximity filter is selected, displayed school buffers are used to split speed-limit linework. Sections inside any displayed school buffer are rendered as 20 mph for analysis only; this is not a verified school-zone restriction or posted sign. The original source value is retained separately and shown in the popup. Overlapping buffers are combined, and portions outside the buffers retain their source value.

## Missing or unverified attributes

Measured travel/impact speeds, verified bell schedules and holiday calendars, school opening/closing dates, enrollment and pedestrian/bicycle exposure, complete city street facility coverage, authoritative regulatory school zones, and release permissions are not supplied. The 20 mph buffer value is an explicit analysis assumption, not authoritative speed-limit data. School bus/hit-and-run fields exist in the older extract but are absent from the current interactive CrashPoints export. Detailed raw weather/lighting/road attributes exist in the saved source inventory; only fixed aggregated condition tables are supplied for this dashboard.
