# Cheyenne School Zone Safety

Phase 3 WebGIS dashboard for the University of Wyoming GIST 5200 project in collaboration with WYDOT. Built with React, TypeScript, Vite, Leaflet, and Apache ECharts.

## Run locally

Use Node.js 22.12+ and Python 3. Install dependencies with `npm ci`, then run `npm run dev` and open `http://127.0.0.1:5173`. The research preview reads the existing neighboring Phase 2 exports and school workbook **in memory**. When the posted speed-limit layer is enabled, it also queries the Laramie County GIS Cooperative `LC_Maintained` service for road features in the map context bounds; an internet connection is required. Source data is not copied into this repository. Phase 2 is read-only.

On this Windows workstation, double-click `start-dashboard.cmd`. Keep its terminal window open. It finds installed Node.js or the checksum-verified portable runtime directly, starts the local server, and opens `http://127.0.0.1:5173/map` in your browser once the server is listening. It does not require a global npm installation. If the temporary runtime is removed, install Node.js 22.12+; no system-wide configuration was changed. `start-dashboard.cmd --no-open` starts the same server without opening a browser, for automated checks.

The dashboard needs that running server; opening `index.html` directly or visiting the address after closing the server window will not load the application. Startup errors remain visible in the launcher window.

Default source locations, relative to this repository:

- `../dashboard_build/dashboard_build/dashboard`
- `../wydot_phase2/cheyenne-school-zone-safety/5200draft_Donovan/Cheyenne_Schools_Listing.xlsx`

Override these with `PHASE2_DASHBOARD_DIR`, `PHASE2_SCHOOLS_FILE`, and optionally `PYTHON_COMMAND` in an ignored `.env.local`. These are server-only variables; never prefix them with `VITE_`.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Loopback-only research preview using actual local sources |
| `npm run dev:public` | Public experience with all source datasets withheld |
| `npm run build` | Type check, build, and production release audit |
| `npm run preview` | Serve the production output on port 4173 |
| `npm test` | Counting, time, query, access-boundary, and export checks |
| `npm run test:e2e` | Browser checks after building; uses system Chrome on Windows |
| `npm run audit:data` | Validate the audited source baseline without writing crash records |

Browser tests can use `BROWSER_EXECUTABLE` for a Chromium executable. Automated QA substitutes test tiles to avoid bulk requests to OpenStreetMap. Screenshots, traces, and test output are ignored because they can contain research data.

## Upload GeoJSON

On **Analytics**, select **Upload** and choose one or more `.geojson` or `.json` files. The **Data** menu lists uploaded layers with on/off switches, removal, and a source selector. The same switches appear in **Map ? Layers**. Enabled layers drive both pages; turning every uploaded layer off leaves the uploaded workspace empty. Choose **Project data** or clear the uploads to return to the original school-safety dataset.

Uploads are read in browser memory only. They are never sent to the server, saved to local storage, copied into the repository, or bundled into a deployment. They persist across page navigation in the current tab and clear on refresh. Uploads also work in the production build with no neighboring Phase 2 folders or Python installation. The original research preview still requires its documented source files and Python.

Supports FeatureCollections or single Features containing WGS 84 longitude/latitude points, lines, polygons, multipart geometries, and GeometryCollections. Null geometry is retained for charts and reported as unmapped. Explicit projected CRS/coordinates and structurally invalid geometries are rejected; the importer does not reproject coordinates or certify polygon topology. Limits: 10 MB/file, 30 MB and 50,000 features across up to 12 layers; up to 250,000 coordinate positions per file.

Uploaded charts describe **features**, without assuming they are crashes or applying the Phase 2 school calendar. They show counts by enabled layer, a selected category, recorded calendar month, and a numeric distribution. **Filters** lets users select the actual fields and filter category values/dates. Numeric strings are not silently converted, and missing values are not treated as zero. Dates use an ISO YYYY-MM-DD prefix, without timezone conversion. Overlapping files may repeat the same records; these feature counts do not claim unique crashes. The map-area query uses bounding-box overlap for lines/polygons. CSV/PNG exports reflect the uploaded selection and its interpretation.

**Reset** clears filters while retaining layer switches, chosen fields, files, and the map's zoom/position. Use the map's Fit control explicitly to change its extent.

## Data release boundary

The development middleware is enabled only by explicit `research` mode. It rejects non-loopback connections, foreign origins, and cross-site requests; responses use `Cache-Control: no-store`. No research endpoints exist in production. Do not tunnel, proxy, or expose this server to a network. Local browser access displays crash records already available to the project team; it is not protection for a shared computer.

The production build includes **no project source datasets**, including schools or infrastructure, until their redistribution terms have been reviewed. Users can independently load their own GeoJSON into the browser-only workspace. It displays unavailable states instead of fabricated data. Public asset paths are allowlisted by the release audit. There is no deployment configuration, automatic commit, or publishing step. A future approved release requires an explicit manifest/schema implementation, not a client-side permission toggle.

CSV exports contain filtered **aggregate counts**, never crash records. PNG exports include the chart title, unique-crash count, selected scope, and a short count-interpretation note. Institutional branding and review-status watermarks are omitted. Exports from the research preview are research artifacts and are not cleared for redistribution.

## Analysis scope

The interactive overview uses the existing school-linked export only. Its baseline is provisional: 11,510 school relationships, 10,457 unique crashes, 39 schools with workbook coordinates. Distances in the original export are rounded. Default filters select complete years 2016–2025 and a 1,000-ft radius. All-school totals deduplicate crash IDs; school comparisons retain every qualifying relationship. Missing involvement remains unknown. Local date and clock values are preserved without timezone conversion.

See [audit](docs/audit.md), [data dictionary](docs/data-dictionary.md), [methodology](docs/methodology.md), [publication review](docs/publication-review.md), and [implementation status](docs/implementation.md).
