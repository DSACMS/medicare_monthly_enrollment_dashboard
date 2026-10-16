# ADR-0001: Parquet + DuckDB-Wasm + WebMCP with CMS API fallback

- **Status:** Accepted
- **Date:** 2026-09-03
- **Deciders:** Repository maintainers
- **Related work:** Phase 0 modernization plan.

## Context

The dashboard is a static Eleventy site deployed to GitHub Pages. Every
runtime request today goes to the CMS Provider Data Catalog dataset
`d7fabe1e-d19b-4333-9eff-e80e0643f2fd` (Medicare Monthly Enrollment) via
[src/api/cmsClient.js](../../src/api/cmsClient.js), driven by the dataset
modules in [src/datasets/](../../src/datasets/).

### Baseline measurements

Rows are returned as JSON objects with 62+ columns (~46 numeric fields per row).
Sampled with `curl` against the live API on 2026-09-03:

| Query                                                | Rows   | Uncompressed JSON |
| ---------------------------------------------------- | ------ | ----------------- |
| `BENE_GEO_LVL=National` (all periods, latest 100)    | 100    | ~330 KB           |
| `BENE_GEO_LVL=State&YEAR=2013&MONTH=Year`            | 58     | ~190 KB           |
| `BENE_GEO_LVL=County&YEAR=2023&MONTH=July`           | 3,278  | ~5.3 MB           |

Full historical scope, based on the schema and observed cardinality:

- **National:** 1 row × (12 monthly + 1 yearly) × ~13 years ≈ ~170 rows.
- **State / territory:** ~58 rows × 13 periods × ~13 years ≈ ~9,800 rows.
- **County:** ~3,300 rows × 13 periods × ~13 years ≈ ~558,000 rows.

Every drill-in today re-fetches ~5 MB of county JSON per state × period even
though the dashboard reads at most a dozen columns from it. State-level trend
requests re-fetch all state history per state.

The application also uses [assets/_common/labels.js](../../assets/_common/labels.js)
as the single source of truth for the visible metrics. The only raw fields the
hospital and prescription-drug views actually consume are:

- **Geo:** `BENE_GEO_LVL`, `BENE_STATE_ABRVTN`, `BENE_STATE_DESC`,
  `BENE_COUNTY_DESC`, `BENE_FIPS_CD`.
- **Period:** `YEAR`, `MONTH`.
- **Hospital / medical:** `TOT_BENES`, `ORGNL_MDCR_BENES`, `MA_AND_OTH_BENES`.
- **Prescription drug:** `PRSCRPTN_DRUG_TOT_BENES`, `PRSCRPTN_DRUG_PDP_BENES`,
  `PRSCRPTN_DRUG_MAPD_BENES`.

Everything else in the CMS row (age, race, sex, dual-eligibility bands, ESRD,
Part A/B counts) is not used by any current view and does not need to ship.

### Constraints

- Static Pages hosting only. No server runtime, no paid service, no React,
  no Vite.
- Must retain the existing WCAG 2.2 AA, keyboard, screen-reader, reflow and
  forced-colors support.
- Must continue to work in browsers without WebMCP, service workers or
  WebAssembly.
- Cannot expose arbitrary SQL to any agent surface.

## Decision

Modernize the data layer around three coordinated changes without touching
the working dashboard architecture (event bus, render pipeline, URL sync,
accessibility surface).

1. **Preprocess CMS data into versioned Zstandard-compressed Apache Parquet
   files** at build time and publish them as part of the Pages artifact under
   a stable path (`/data/vX/…`).
2. **Query the Parquet files locally in the browser with DuckDB-Wasm.**
   The dataset modules gain a Parquet-first read path; if DuckDB-Wasm or the
   Parquet fetch fails for any reason, they transparently fall back to the
   existing CMS API implementation.
3. **Expose a small, typed WebMCP tool surface** that lets agents drive the
   dashboard (change dashboard type, state, county, trend range) and run
   pre-defined analytical queries (e.g. `getStateTrend`, `getCountyBreakdown`).
   Agents never see raw SQL and can only reach the fields already surfaced
   to sighted users.

## Consequences

### Positive

- **Bandwidth and latency.** Column-projected Parquet with Zstd routinely
  compresses this dataset 8-12× vs JSON; a full county history for one
  state should fit in tens to low hundreds of KB. The single national/state
  summary is expected to be well under 1 MB.
- **Cache friendliness.** Files are content-addressable via manifest hashes,
  so Cloudflare/Pages CDN and browser HTTP cache both do the right thing.
- **Offline / flaky-network robustness.** After the first visit, subsequent
  navigations can run entirely against the local browser cache.
- **Reproducibility and provenance.** The manifest records dataset ID,
  fetch time, schema version, row counts, file sizes and SHA-256 hashes.
- **Accessibility unchanged.** The Parquet path only replaces the fetch
  layer; the render tree, ARIA, focus management and tests stay as-is.

### Negative / trade-offs

- Adds an ETL responsibility to CI. Failures during the ETL job must not
  publish partial data; the site keeps the previous artifact until a full,
  validated build lands.
- DuckDB-Wasm adds ~5 MB of Wasm to the first-visit cost. This is loaded
  lazily and cached; browsers without Wasm skip it entirely.
- Two data paths (Parquet + CMS API) means two behaviours to keep in sync.
  We accept this: the CMS API path is the reference implementation and the
  Parquet path must return equivalent JS objects.

## Alternatives considered

### Embedded MCP server instead of WebMCP

Rejected. An embedded MCP server would require a server runtime the Pages
hosting model does not support, and would give agents a network-side surface
that we cannot easily scope to the same data the visible dashboard already
exposes. WebMCP runs the tool surface *in* the same browser tab as the user,
which naturally inherits the same origin, cache and consent model.

### Commit the generated Parquet into `main`

Rejected. Parquet is generated output; committing it makes review noisy,
inflates the repo, and couples ETL cadence to human-merge cadence. Building
Parquet in CI and publishing it as part of the Pages deployment artifact
keeps `main` clean and gives us a natural failure gate: if the ETL job fails,
the deploy does not happen and the previous published artifact stays live.

### Expose arbitrary SQL to agents

Rejected. Even read-only SQL over Parquet is an unbounded surface. Users of
the WebMCP tools should get the same guarantees as users of the visible
dashboard: the fields, filters and aggregations they can request are the
fields, filters and aggregations the dashboard already renders. If a new
analytical need appears, the answer is to add a typed tool for it, not to
open the SQL door.

### Skip the CMS API fallback

Rejected. Browsers without `WebAssembly`, without service workers, or that
fail to load DuckDB-Wasm (corporate CSP, aggressive privacy tooling, older
mobile) must still see the dashboard. The CMS API path is already working,
already accessible and already covered by tests, so the cost of keeping it
is small compared to the cost of losing those users.

## Rollout plan

- **Phase 0 (this ADR).** No visible behaviour change.
- **Phase 1.** Land the Python ETL, its tests, and vendored TopoJSON in
  `scripts/` and `data/vendor/`. Nothing on the runtime path changes.
- **Phase 2.** Wire ETL + manifest generation into GitHub Actions and
  publish Parquet as part of the Pages artifact.
- **Phase 3.** Add a Parquet + DuckDB-Wasm reader behind the same dataset
  interface `src/router.js` already uses; keep the CMS API implementation
  as fallback.
- **Phase 4.** Add the WebMCP tool surface.
- **Phase 5.** Verify no regressions against the existing accessibility
  and keyboard test suites, record the new baseline.
