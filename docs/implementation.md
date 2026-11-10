# Phase 3 implementation

## Implemented

- Existing repository retained; React + TypeScript + Vite setup, compatible locked dependencies.
- Three responsive pages: Map, Analytics, About; shared URL-backed filters persist during navigation.
- Local research adapter reads original Phase 2 exports/workbook without mutation or copies.
- All workbook schools mapped directly; no trilateration. No-linked-record schools carry coverage guidance.
- School/address search, distance/severity/involvement/time/calendar/year filters, local area selection, year playback, feature popups, layer controls, legend, scale, expanded map, one-year AADT display.
- All five fixed hotspot populations; infrastructure and correctly clipped road display.
- Unique-crash KPIs and charts by year, hour, severity, weekday/hour; school comparison charts/tables with overlap counting corrected.
- Fixed conditions, trends, density, and crossing-proximity tables explicitly labeled as independent of filters.
- Aggregate CSV and annotated PNG exports. No crash-row export.
- Methodology, source provenance, caveats, assumed bell times, local-time handling, and incomplete-year guidance.
- Data-withheld production mode and a build release audit.
- Unit tests, real-input baseline audit, and browser tests; verification results are recorded below.

## Deliberately unresolved

Source-data permissions, geodatabase reruns, original-run count reconciliation, unrounded threshold classification, school operating/coverage history, verified school calendars, historical AADT matching, and exposure-adjusted speed analysis require additional source information or owner review. Public aggregate release and hosting remain pending. No simulated statistics, source records, or fictitious external API endpoints are substituted for missing inputs.

## Project organization

`src/app`: shared state and routing. `src/pages`: page compositions. `src/domain`: data schemas/counting/filter rules. `src/features/map`: lazy context layers. `src/features/analytics`: modular ECharts and fixed results. `src/features/exports`: aggregate/CSV safety. `server`: development-only source access and clipping. `scripts`: read-only validation and production audit. `tests`: isolated synthetic fixtures and browser verification. `docs`: provenance, methodology, release review.

## Executed verification

- TypeScript and production build: passed.
- Release audit: passed; 14 output files, no source datasets, research endpoints, or server imports in the production output.
- Unit tests: 16 passed across counting/overlap, unknown flags, time boundaries, filters, exports, access control, clipping, and CSV parsing.
- Read-only real-input audit: passed for 39 schools, 10,457 unique crashes, 11,510 relationships, the September 4 school-linked cutoff, and 5,163 unique / 5,330 overlapping school counts at the existing rounded 1,000-ft threshold.
- Chrome browser checks: six passed, covering real local sources, shared filters and fast consecutive changes, search, chart rendering, CSV/PNG downloads, uncovered schools, partial 2026, AADT year selection, mobile layout, private-route rejection, production data withholding, spatial queries, and playback.
- Desktop and mobile renderings inspected visually; labels enlarged and legend placement adjusted for smaller viewports.
- Dependency audit following patched parser/test-runner installation: zero reported vulnerabilities. Unused testing dependencies subsequently removed without adding packages.
- Original Phase 2 Git working tree remains unchanged; no repository initialized, no commits or deployments made.

Browser QA uses substituted test tiles to avoid automated map-area requests to OpenStreetMap. It verifies Leaflet interaction and attribution but does not certify live external tile availability. Research screenshots/test artifacts stay ignored. Data provenance and release-permission issues remain as documented above.

## Windows launcher repair

The original launcher could report Node.js missing even when the portable executable existed: its `where node` lookup failed on this workstation. The repaired launcher resolves an executable directly and starts `scripts/start-local.mjs` without depending on global npm discovery. The helper fixes the project working directory, starts only the loopback research server, and opens `/map` after startup. `--no-open` supports automated checks. Windows batch line endings are preserved by `.gitattributes`.

The repaired launcher was exercised directly with Node absent from the command path. Map, Analytics, and About each returned HTTP 200, and the actual local dataset loaded. The six Chrome checks were rerun successfully with the Windows web server started through this launcher instead of bypassing it with `npm run dev`. TypeScript and the production release audit also passed. Phase 2 remains unchanged.

## Compact map layout

- Map fills the viewport below a 56-pixel header (52 pixels on mobile), with no page heading, introduction, KPI-card row, or site footer consuming map space.
- Filters are closed by default on every screen size. The shared nonmodal drawer floats over the map or Analytics; it can be toggled, closed, or dismissed with Escape. Closing returns focus to the filter button. Opening it does not resize the map or charts.
- Navigation is right-aligned. Preview badges and the university/partner header lockup are removed. Project collaborators and provenance remain in About.
- Map controls and school symbols are smaller. A compact crash count, optional legend, and floating timeline retain the existing functions. OpenStreetMap attribution remains on the map.
- Analytics uses the full width, the same filter drawer, compact KPIs, plain chart titles, and on-demand explanatory notes. Decorative About-page introductions and closing slogans are removed.
- Data access, release withholding, source records, counting rules, time handling, and export provenance are unchanged.

Verification: 16 unit tests and seven Chrome checks passed, including viewport dimensions on desktop/mobile, unchanged map dimensions while filters are open, right-aligned navigation, drawer focus/Escape behavior, shared filtering, source coverage, playback, layers, queries, and exports. Production build and release audit passed. Desktop/mobile screenshots were inspected locally using substituted QA map tiles.


## Interface polish

- Uses a restrained Wyoming-inspired brown/gold palette on warm neutral surfaces. Segoe UI is the primary local font; Helvetica Neue and Arial provide fallbacks. Controls, Leaflet content, charts, and exported PNGs use the same sans-serif family without an external font request.
- Layers now includes Streets (OpenStreetMap), Topographic (USGS), and Aerial (USGS/USDA). Selection survives page navigation within the browser session and preserves crash filters and map position. Basemap selection is available even when research datasets are withheld. USGS tiles have a native maximum zoom of 16 and are enlarged up to 19. Attribution changes with the active provider. No tiles are prefetched or stored by the application.
- Basemap references: [USGS service list](https://www.usgs.gov/faqs/what-are-base-map-services-or-urls-used-national-map), [USGS usage terms](https://www.usgs.gov/faqs/what-are-terms-uselicensing-map-services-and-data-national-map), [Topo metadata](https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer?f=pjson), [Imagery metadata](https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer?f=pjson). Both live service metadata and one Cheyenne tile per service were checked successfully. Imagery is dated, not a record of crash-time conditions.
- Each page has one Reset control outside the filter drawer: beside the map crash count and beside Analytics' Map link. Both restore shared filter defaults. Map Reset also stops playback/area selection and fits the school locations. It retains the chosen basemap and layer visibility.
- Expanded charts have a visible Lucide X close control, a dismissible backdrop, keyboard focus containment, Escape support, and focus restoration. Chart information and the map legend dismiss on outside pointer interaction, focus leaving the disclosure, or Escape. The Layers panel also dismisses on outside click or Escape. School markers now render the Lucide School icon.
- PNG exports retain a title, unique-crash count, readable filter context (including partial 2026 when selected), and a concise count-interpretation note. Institutional footer text and research-review watermarks have been removed at the user's request. Export filenames still identify research artifacts; CSV provenance remains. These presentation changes do not grant redistribution permission or change the withheld production data policy.

Verification: all 16 unit tests passed. The seven existing browser checks passed, and the two new basemap/reset and chart-control/export checks passed after correcting a test synchronization issue and chart focus restoration. Desktop/mobile layouts and an actual exported PNG were inspected. Browser QA substitutes map tiles; live USGS availability was checked separately. Production build and release audit passed; Phase 2 remains unchanged.
