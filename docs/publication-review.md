# Publication review — pending

Approval to build is not permission to redistribute supplied datasets. No datasets have been committed, uploaded, or deployed by this implementation.

## Current release policy

- Development research data is read in memory from existing neighboring files, through an allowlisted, loopback/same-origin Vite middleware.
- Private source paths are server-only environment settings. No raw datasets are stored under `src/` or `public/`.
- Production includes no source datasets. Its manifest is `withheld` with an empty dataset list; public pages display unavailable states.
- `npm run build` audits the public directory and generated artifacts. It rejects unreviewed public assets, source routes, server module imports, raw source filenames, and common embedded-record patterns. Automated artifact scanning supports but does not replace a manual release review.
- `.gitignore` excludes raw geospatial/tabular datasets, local settings, build artifacts, screenshots, and test reports. This is defense in depth, not permission or a substitute for inspecting staged changes.
- There are no authenticated-private hosting claims, client-side password gates, deployment scripts, new Git initialization, or automatic commits.

## Decisions required before public analytics

1. Record the original crash data agreement and obtain written WYDOT/project guidance on online redistribution and derived products.
2. Review the school workbook and each infrastructure dataset’s origin, license, attribution, and update requirements independently.
3. Approve release populations and denominators; reconcile saved run totals and source-data coverage.
4. Agree on spatial/time/severity resolution, small-cell rules, complementary suppression, and protection against differencing across filters and exports. No arbitrary numerical suppression threshold is assumed here.
5. Review hotspot cells: severe/rare outcomes and fine resolution can disclose sensitive events even without identifiers.
6. Produce approved aggregate assets offline, including separately deduplicated all-schools totals and permitted combined filters. School counts cannot be summed to form unique totals.
7. Implement the approved aggregate schema/client path and extend the release allowlist intentionally. Do not enable private records via a build flag.
8. Inspect generated artifacts, repository history, exported files, hosting configuration, and attribution before approving a concrete deployment.

If raw crash points are ever authorized for a private hosted deployment, use actual server-side access control and a separately reviewed data service. Do not expose or tunnel the local research Vite server.

WYDOT’s [crash data guidance](https://www.dot.state.wy.us/home/dot_safety/crash-data.html) offers public reports and additional-data requests; it does not provide a redistribution grant for this supplied extract. Basemap use follows the [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/); automated QA intercepts tiles rather than fetching map areas.
