"""CMS Medicare Monthly Enrollment ETL.

Fetches the CMS Provider Data Catalog dataset
``d7fabe1e-d19b-4333-9eff-e80e0643f2fd``, normalizes and validates rows,
and writes deterministic Zstandard-compressed Parquet artifacts plus a
manifest suitable for publishing to the Pages ``/data/`` directory.

Phase 1 responsibilities (see ``docs/adr/0001-*``):

- Paginate until the API returns no further rows.
- Fail rather than silently publish incomplete data.
- Preserve FIPS as strings.
- Distinguish reported zero, suppressed ``*`` and missing values.
- Sort deterministically.
- Write files atomically.
- Emit one summary file for national + state history.
- Partition county history by state.
- Emit a manifest with schema version, provenance, latest period, row counts,
  file sizes and SHA-256 hashes.
- Vendor state + county TopoJSON used by the map.

This module does not touch any runtime dashboard code. Runtime consumers
(Phase 3) read the emitted Parquet + manifest via a data-source abstraction.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import logging
import os
import random
import sys
import tempfile
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Iterable, Iterator, Mapping, Sequence

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import requests

log = logging.getLogger("fetch_cms_data")

# ---------------------------------------------------------------------------
# Constants — cross-referenced against the CMS dataset schema and the
# fields consumed by assets/_common/labels.js. Do not change without also
# updating the runtime label wiring and the ADR.
# ---------------------------------------------------------------------------

DATASET_ID = "d7fabe1e-d19b-4333-9eff-e80e0643f2fd"
API_BASE = "https://data.cms.gov/data-api/v1/dataset"
SCHEMA_VERSION = "1"

# Bumped independently of SCHEMA_VERSION when only the Parquet/manifest
# layout changes without breaking runtime consumers.
LAYOUT_VERSION = "v1"

DEFAULT_TIMEOUT_S = 60
DEFAULT_MAX_RETRIES = 5
DEFAULT_BACKOFF_BASE_S = 1.0
DEFAULT_BACKOFF_MAX_S = 30.0
DEFAULT_PAGE_SIZE = 5000

USER_AGENT = (
    "medicare-monthly-enrollment-dashboard-etl/1 "
    "(+https://github.com/DSACMS/medicare_monthly_enrollment_dashboard)"
)

GEO_LEVELS: tuple[str, ...] = ("National", "State", "County")

# The six numeric fields the dashboard actually surfaces. Only these need
# suppression tracking; the CMS row has dozens of others that we skip.
NUMERIC_COLUMNS: tuple[str, ...] = (
    "TOT_BENES",
    "ORGNL_MDCR_BENES",
    "MA_AND_OTH_BENES",
    "PRSCRPTN_DRUG_TOT_BENES",
    "PRSCRPTN_DRUG_PDP_BENES",
    "PRSCRPTN_DRUG_MAPD_BENES",
)

REQUIRED_COLUMNS: tuple[str, ...] = (
    "YEAR",
    "MONTH",
    "BENE_GEO_LVL",
    "BENE_STATE_ABRVTN",
    "BENE_STATE_DESC",
    "BENE_COUNTY_DESC",
    "BENE_FIPS_CD",
    *NUMERIC_COLUMNS,
)

# CMS returns MONTH as a full English month name for monthly rows and the
# literal string "Year" for the annual roll-up. We keep the raw string in
# the output for round-trip fidelity and derive a chronological sort key.
MONTH_ORDER: Mapping[str, int] = {
    "Year": 0,
    "January": 1,
    "February": 2,
    "March": 3,
    "April": 4,
    "May": 5,
    "June": 6,
    "July": 7,
    "August": 8,
    "September": 9,
    "October": 10,
    "November": 11,
    "December": 12,
}

SUPPRESSION_MARKER = "*"

# Vendored map topologies. jsDelivr's ``us-atlas@3`` covers 50 states + DC
# and (as of this dataset publisher) all five inhabited territories. See
# ADR-0001 for the derivation of these coordinates.
TOPOJSON_SOURCES: tuple[tuple[str, str], ...] = (
    (
        "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json",
        "states-10m.json",
    ),
    (
        "https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json",
        "counties-10m.json",
    ),
)


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------


class EtlError(RuntimeError):
    """Base class for ETL-visible failures."""


class SchemaDriftError(EtlError):
    """The CMS API response is missing a required column."""


class DuplicateRowError(EtlError):
    """The same (level, period, geography) tuple appeared more than once."""


class MissingPartitionError(EtlError):
    """No rows produced for a partition we were expecting to emit."""


class ApiFetchError(EtlError):
    """A CMS API call could not be completed after all retries."""


# ---------------------------------------------------------------------------
# HTTP + retry
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class RetryPolicy:
    max_retries: int = DEFAULT_MAX_RETRIES
    backoff_base_s: float = DEFAULT_BACKOFF_BASE_S
    backoff_max_s: float = DEFAULT_BACKOFF_MAX_S
    # Callable so tests can inject a deterministic no-op instead of real sleeps.
    sleep: Callable[[float], None] = time.sleep


RETRIABLE_STATUSES: frozenset[int] = frozenset({408, 425, 429, 500, 502, 503, 504})


def _backoff_delay(attempt: int, policy: RetryPolicy) -> float:
    """Full-jitter exponential backoff, capped."""
    exp = policy.backoff_base_s * (2 ** attempt)
    capped = min(exp, policy.backoff_max_s)
    return random.uniform(0, capped)


def _session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT, "Accept": "application/json"})
    return s


def _get_json(
    session: requests.Session,
    url: str,
    params: Mapping[str, str],
    *,
    timeout_s: float,
    policy: RetryPolicy,
) -> list[dict]:
    """GET ``url`` with retries. Returns the decoded JSON array."""
    last_exc: Exception | None = None
    for attempt in range(policy.max_retries + 1):
        try:
            resp = session.get(url, params=params, timeout=timeout_s)
        except requests.RequestException as exc:
            last_exc = exc
            if attempt == policy.max_retries:
                break
            policy.sleep(_backoff_delay(attempt, policy))
            continue

        if resp.status_code in RETRIABLE_STATUSES:
            last_exc = ApiFetchError(
                f"CMS API returned {resp.status_code} for {url}"
            )
            if attempt == policy.max_retries:
                break
            policy.sleep(_backoff_delay(attempt, policy))
            continue

        if not resp.ok:
            raise ApiFetchError(
                f"CMS API returned {resp.status_code} for {url}: {resp.text[:200]}"
            )

        try:
            data = resp.json()
        except ValueError as exc:
            raise ApiFetchError(f"CMS API returned non-JSON body: {exc}") from exc

        if not isinstance(data, list):
            raise ApiFetchError(
                f"CMS API returned {type(data).__name__} instead of a JSON array"
            )
        return data

    raise ApiFetchError(
        f"CMS API request to {url} exhausted retries ({policy.max_retries + 1} attempts)"
    ) from last_exc


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------


def iter_geo_level_rows(
    geo_level: str,
    *,
    session: requests.Session | None = None,
    page_size: int = DEFAULT_PAGE_SIZE,
    timeout_s: float = DEFAULT_TIMEOUT_S,
    policy: RetryPolicy | None = None,
    base_url: str = f"{API_BASE}/{DATASET_ID}/data",
) -> Iterator[dict]:
    """Yield every row for one geographic level, paginating to exhaustion.

    Stops when the API returns a partial page (< ``page_size`` rows) or an
    empty page — whichever comes first.
    """
    if geo_level not in GEO_LEVELS:
        raise ValueError(f"unknown geo_level {geo_level!r}")

    owned_session = session is None
    session = session or _session()
    policy = policy or RetryPolicy()

    offset = 0
    try:
        while True:
            page = _get_json(
                session,
                base_url,
                {
                    "filter[BENE_GEO_LVL]": geo_level,
                    "size": str(page_size),
                    "offset": str(offset),
                },
                timeout_s=timeout_s,
                policy=policy,
            )
            if not page:
                return
            yield from page
            if len(page) < page_size:
                return
            offset += len(page)
    finally:
        if owned_session:
            session.close()


def iter_fixture_rows(fixtures_dir: Path, geo_level: str) -> Iterator[dict]:
    """Yield rows for one geo level from a fixtures directory.

    Reads ``<geo_level.lower()>_page_*.json`` in sorted order so tests can
    exercise multi-page behaviour.
    """
    pattern = f"{geo_level.lower()}_page_*.json"
    files = sorted(fixtures_dir.glob(pattern))
    if not files:
        return
    for path in files:
        with path.open("r", encoding="utf-8") as fh:
            page = json.load(fh)
        if not isinstance(page, list):
            raise ApiFetchError(f"Fixture {path} is not a JSON array")
        yield from page


# ---------------------------------------------------------------------------
# Validation + normalization
# ---------------------------------------------------------------------------


def _validate_columns(row: Mapping[str, object], source: str) -> None:
    missing = [c for c in REQUIRED_COLUMNS if c not in row]
    if missing:
        raise SchemaDriftError(
            f"{source}: row missing required columns {missing}: keys were {sorted(row.keys())}"
        )


def _validate_geo_level(row: Mapping[str, object], source: str) -> None:
    level = row.get("BENE_GEO_LVL")
    if level not in GEO_LEVELS:
        raise SchemaDriftError(
            f"{source}: unexpected BENE_GEO_LVL {level!r} (accepted: {list(GEO_LEVELS)})"
        )


def _parse_month(month: str, *, source: str) -> tuple[str, int]:
    """Return (canonical month string, sort ordinal).

    Raises ``SchemaDriftError`` for unknown values.
    """
    if not isinstance(month, str):
        raise SchemaDriftError(f"{source}: MONTH is {type(month).__name__}, expected str")
    trimmed = month.strip()
    if trimmed not in MONTH_ORDER:
        raise SchemaDriftError(
            f"{source}: unknown MONTH value {trimmed!r} (accepted: {sorted(MONTH_ORDER)})"
        )
    return trimmed, MONTH_ORDER[trimmed]


def _normalize_fips(raw: str, *, geo_level: str) -> str:
    """Normalize a CMS FIPS string.

    National and State rows carry a blank/space FIPS; we canonicalize to
    empty string. County rows carry a 4- or 5-digit code that we left-pad
    to 5 characters.
    """
    if raw is None:
        return ""
    if not isinstance(raw, str):
        raise SchemaDriftError(
            f"BENE_FIPS_CD is {type(raw).__name__}, expected str"
        )
    stripped = raw.strip()
    if geo_level in ("National", "State"):
        return ""
    if not stripped:
        return ""
    if not stripped.isdigit():
        raise SchemaDriftError(
            f"County BENE_FIPS_CD {raw!r} is not numeric after stripping"
        )
    if len(stripped) > 5:
        raise SchemaDriftError(
            f"County BENE_FIPS_CD {raw!r} is longer than 5 digits"
        )
    return stripped.rjust(5, "0")


def _parse_numeric(raw: object) -> tuple[int | None, bool]:
    """Interpret a numeric CMS cell.

    Returns ``(value, suppressed)``:

    - present integer → ``(int, False)``
    - literal ``*``   → ``(None, True)`` (privacy-suppressed)
    - missing / null  → ``(None, False)`` (unavailable)
    """
    if raw is None:
        return None, False
    if isinstance(raw, int) and not isinstance(raw, bool):
        return raw, False
    if isinstance(raw, str):
        stripped = raw.strip()
        if stripped == "":
            return None, False
        if stripped == SUPPRESSION_MARKER:
            return None, True
        try:
            return int(stripped), False
        except ValueError as exc:
            raise SchemaDriftError(
                f"numeric field could not be parsed as int: {raw!r}"
            ) from exc
    raise SchemaDriftError(
        f"numeric field has unsupported type {type(raw).__name__}: {raw!r}"
    )


def normalize_row(row: Mapping[str, object], *, source: str = "row") -> dict:
    """Validate one raw CMS row and return a normalized dict.

    Raises :class:`SchemaDriftError` on any structural problem.
    """
    _validate_columns(row, source)
    _validate_geo_level(row, source)

    geo_level = str(row["BENE_GEO_LVL"])
    month, month_ord = _parse_month(str(row["MONTH"]), source=source)
    year = str(row["YEAR"]).strip()
    if not year.isdigit() or len(year) != 4:
        raise SchemaDriftError(f"{source}: YEAR must be a 4-digit string, got {row['YEAR']!r}")

    fips = _normalize_fips(str(row.get("BENE_FIPS_CD", "")), geo_level=geo_level)
    if geo_level == "County":
        state_abbr = str(row["BENE_STATE_ABRVTN"]).strip()
        # CMS's county FIPS should have its state's 2-digit FIPS as prefix;
        # we do not have the abbreviation-to-FIPS table here so we only
        # enforce basic shape. Length/digit checks above cover most drift.
        if not fips or len(fips) != 5:
            raise SchemaDriftError(
                f"{source}: county row for state {state_abbr} has invalid FIPS {fips!r}"
            )

    normalized: dict[str, object] = {
        "geo_level": geo_level,
        "year": year,
        "month": month,
        "month_ordinal": month_ord,
        "state_abbr": str(row["BENE_STATE_ABRVTN"]).strip() or "",
        "state_name": str(row["BENE_STATE_DESC"]).strip() or "",
        "county_name": str(row["BENE_COUNTY_DESC"]).strip() or "",
        "fips": fips,
    }

    suppressed_fields: list[str] = []
    for col in NUMERIC_COLUMNS:
        value, suppressed = _parse_numeric(row.get(col))
        normalized[col] = value
        if suppressed:
            suppressed_fields.append(col)
    normalized["suppressed_fields"] = ",".join(suppressed_fields)
    return normalized


# ---------------------------------------------------------------------------
# DataFrame + Parquet
# ---------------------------------------------------------------------------


# Column order for the emitted Parquet files. Fixed so byte-level output
# is deterministic across runs.
OUTPUT_COLUMNS: tuple[str, ...] = (
    "geo_level",
    "year",
    "month",
    "month_ordinal",
    "state_abbr",
    "state_name",
    "county_name",
    "fips",
    *NUMERIC_COLUMNS,
    "suppressed_fields",
)

# Explicit dtypes so pandas doesn't infer object-vs-int64 differently
# between runs with different row counts.
_STRING_COLUMNS: frozenset[str] = frozenset(
    {"geo_level", "year", "month", "state_abbr", "state_name", "county_name", "fips", "suppressed_fields"}
)


def _normalize_rows(
    rows: Iterable[Mapping[str, object]], *, source: str
) -> list[dict]:
    return [normalize_row(row, source=source) for row in rows]


def _sort_key(row: dict) -> tuple:
    return (
        row["geo_level"],
        row["year"],
        row["month_ordinal"],
        row["state_abbr"],
        row["fips"],
        row["county_name"],
    )


def _detect_duplicates(rows: Sequence[dict], *, source: str) -> None:
    seen: dict[tuple, int] = {}
    for i, row in enumerate(rows):
        key = (
            row["geo_level"],
            row["year"],
            row["month"],
            row["state_abbr"],
            row["fips"],
            row["county_name"],
        )
        if key in seen:
            raise DuplicateRowError(
                f"{source}: duplicate row for {key} at indexes {seen[key]} and {i}"
            )
        seen[key] = i


def _to_frame(rows: Sequence[dict]) -> pd.DataFrame:
    df = pd.DataFrame(rows, columns=list(OUTPUT_COLUMNS))
    for col in OUTPUT_COLUMNS:
        if col in _STRING_COLUMNS:
            df[col] = df[col].fillna("").astype("string")
        elif col == "month_ordinal":
            df[col] = df[col].astype("int16")
        else:
            df[col] = df[col].astype("Int64")
    return df


def write_parquet_atomic(df: pd.DataFrame, out_path: Path) -> None:
    """Write ``df`` to ``out_path`` as Zstandard-compressed Parquet, atomically."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    table = pa.Table.from_pandas(df, preserve_index=False)
    fd, tmp_path = tempfile.mkstemp(
        prefix=f".{out_path.name}.", suffix=".tmp", dir=str(out_path.parent)
    )
    os.close(fd)
    try:
        pq.write_table(
            table,
            tmp_path,
            compression="zstd",
            compression_level=9,
            # Sortedness metadata + created_by/version stamps are the main
            # sources of run-to-run byte drift. Fix the row group boundary
            # and skip statistics to keep output byte-stable for a given
            # pyarrow version.
            write_statistics=False,
            store_schema=True,
        )
        os.replace(tmp_path, out_path)
    except Exception:
        try:
            os.unlink(tmp_path)
        except FileNotFoundError:
            pass
        raise


# ---------------------------------------------------------------------------
# Manifest
# ---------------------------------------------------------------------------


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _file_entry(out_dir: Path, path: Path, *, rows: int | None = None) -> dict:
    stat = path.stat()
    entry: dict[str, object] = {
        "path": str(path.relative_to(out_dir)).replace(os.sep, "/"),
        "size_bytes": stat.st_size,
        "sha256": _sha256(path),
    }
    if rows is not None:
        entry["rows"] = rows
    return entry


def _find_latest_period(summary: pd.DataFrame) -> dict[str, str]:
    if summary.empty:
        return {"year": "", "month": ""}
    monthly = summary[summary["month"] != "Year"]
    scope = monthly if not monthly.empty else summary
    idx = (
        scope["year"].astype(str) + "-" + scope["month_ordinal"].astype(int).astype(str).str.zfill(2)
    ).idxmax()
    return {"year": str(scope.at[idx, "year"]), "month": str(scope.at[idx, "month"])}


# ---------------------------------------------------------------------------
# TopoJSON vendoring
# ---------------------------------------------------------------------------


def vendor_topojson(
    dest_dir: Path,
    *,
    session: requests.Session | None = None,
    timeout_s: float = DEFAULT_TIMEOUT_S,
    policy: RetryPolicy | None = None,
    sources: Sequence[tuple[str, str]] = TOPOJSON_SOURCES,
) -> list[Path]:
    """Download and atomically write map topologies into ``dest_dir``."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    owned_session = session is None
    session = session or _session()
    policy = policy or RetryPolicy()
    written: list[Path] = []
    try:
        for url, filename in sources:
            body = _fetch_bytes(
                session, url, timeout_s=timeout_s, policy=policy,
            )
            out_path = dest_dir / filename
            fd, tmp = tempfile.mkstemp(prefix=f".{filename}.", suffix=".tmp", dir=str(dest_dir))
            try:
                with os.fdopen(fd, "wb") as fh:
                    fh.write(body)
                os.replace(tmp, out_path)
            except Exception:
                try:
                    os.unlink(tmp)
                except FileNotFoundError:
                    pass
                raise
            written.append(out_path)
    finally:
        if owned_session:
            session.close()
    return written


def _fetch_bytes(
    session: requests.Session,
    url: str,
    *,
    timeout_s: float,
    policy: RetryPolicy,
) -> bytes:
    """GET raw bytes with the same retry policy as JSON requests."""
    last_exc: Exception | None = None
    for attempt in range(policy.max_retries + 1):
        try:
            resp = session.get(url, timeout=timeout_s)
        except requests.RequestException as exc:
            last_exc = exc
            if attempt == policy.max_retries:
                break
            policy.sleep(_backoff_delay(attempt, policy))
            continue
        if resp.status_code in RETRIABLE_STATUSES:
            last_exc = ApiFetchError(f"{url} returned {resp.status_code}")
            if attempt == policy.max_retries:
                break
            policy.sleep(_backoff_delay(attempt, policy))
            continue
        if not resp.ok:
            raise ApiFetchError(f"{url} returned {resp.status_code}")
        return resp.content
    raise ApiFetchError(
        f"exhausted retries fetching {url} ({policy.max_retries + 1} attempts)"
    ) from last_exc


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class EtlOutputs:
    manifest_path: Path
    summary_path: Path
    county_paths: dict[str, Path]
    vendor_paths: list[Path]


def _collect_rows(
    source_rows: Callable[[str], Iterable[dict]],
) -> tuple[list[dict], list[dict], list[dict]]:
    """Materialize + normalize rows for all three geo levels."""
    national = _normalize_rows(source_rows("National"), source="National")
    state = _normalize_rows(source_rows("State"), source="State")
    county = _normalize_rows(source_rows("County"), source="County")
    return national, state, county


def run_etl(
    out_dir: Path,
    *,
    source_rows: Callable[[str], Iterable[dict]],
    vendor_dir: Path | None = None,
    vendor_paths: Sequence[Path] | None = None,
    generated_at: datetime | None = None,
    source_metadata: dict | None = None,
) -> EtlOutputs:
    """Run the full ETL end-to-end, writing artifacts under ``out_dir``.

    ``source_rows(level)`` yields raw CMS-shaped rows for one geographic
    level; production wires it to ``iter_geo_level_rows`` and tests wire
    it to ``iter_fixture_rows``.

    ``vendor_paths`` may pre-supply TopoJSON files that were vendored by a
    caller (so the manifest lists them without this function re-fetching).
    """
    national_rows, state_rows, county_rows = _collect_rows(source_rows)

    _detect_duplicates(national_rows, source="National")
    _detect_duplicates(state_rows, source="State")
    _detect_duplicates(county_rows, source="County")

    if not national_rows and not state_rows and not county_rows:
        raise MissingPartitionError("ETL produced zero rows across all geo levels")

    summary_rows = sorted(national_rows + state_rows, key=_sort_key)
    summary_df = _to_frame(summary_rows)
    summary_path = out_dir / LAYOUT_VERSION / "summary.parquet"
    write_parquet_atomic(summary_df, summary_path)

    counties_dir = out_dir / LAYOUT_VERSION / "counties"
    county_paths: dict[str, Path] = {}
    by_state: dict[str, list[dict]] = {}
    for row in county_rows:
        by_state.setdefault(row["state_abbr"], []).append(row)
    for state_abbr, rows in by_state.items():
        if not state_abbr:
            raise SchemaDriftError("County row without BENE_STATE_ABRVTN")
        rows_sorted = sorted(rows, key=_sort_key)
        df = _to_frame(rows_sorted)
        path = counties_dir / f"{state_abbr}.parquet"
        write_parquet_atomic(df, path)
        county_paths[state_abbr] = path

    manifest = _build_manifest(
        out_dir=out_dir,
        summary_df=summary_df,
        summary_path=summary_path,
        county_paths=county_paths,
        county_row_counts={s: len(rows) for s, rows in by_state.items()},
        vendor_paths=list(vendor_paths or []),
        generated_at=generated_at,
        source_metadata=source_metadata,
    )
    manifest_path = out_dir / LAYOUT_VERSION / "manifest.json"
    _write_manifest_atomic(manifest, manifest_path)

    return EtlOutputs(
        manifest_path=manifest_path,
        summary_path=summary_path,
        county_paths=county_paths,
        vendor_paths=list(vendor_paths or []),
    )


def _write_manifest_atomic(manifest: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(manifest, fh, indent=2, sort_keys=True)
            fh.write("\n")
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except FileNotFoundError:
            pass
        raise


def _build_manifest(
    *,
    out_dir: Path,
    summary_df: pd.DataFrame,
    summary_path: Path,
    county_paths: Mapping[str, Path],
    county_row_counts: Mapping[str, int],
    vendor_paths: Sequence[Path],
    generated_at: datetime | None,
    source_metadata: dict | None,
) -> dict:
    generated_at = generated_at or datetime.now(tz=timezone.utc)

    files: dict[str, dict] = {}
    files["summary"] = _file_entry(out_dir, summary_path, rows=len(summary_df))
    counties_manifest: dict[str, dict] = {}
    for state_abbr, path in sorted(county_paths.items()):
        counties_manifest[state_abbr] = _file_entry(
            out_dir, path, rows=county_row_counts.get(state_abbr, 0)
        )
    files["counties"] = counties_manifest

    vendor_manifest: dict[str, dict] = {}
    for path in sorted(vendor_paths):
        vendor_manifest[path.name] = _file_entry(out_dir, path)
    if vendor_manifest:
        files["vendor"] = vendor_manifest

    total_rows = len(summary_df) + sum(county_row_counts.values())

    return {
        "schema_version": SCHEMA_VERSION,
        "layout_version": LAYOUT_VERSION,
        "generated_at": generated_at.replace(microsecond=0).isoformat(),
        "source": source_metadata
        or {
            "dataset_id": DATASET_ID,
            "base_url": f"{API_BASE}/{DATASET_ID}/data",
        },
        "latest_period": _find_latest_period(summary_df),
        "row_counts": {
            "summary": len(summary_df),
            "counties_total": sum(county_row_counts.values()),
            "counties_by_state": dict(sorted(county_row_counts.items())),
            "total": total_rows,
        },
        "files": files,
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _cli_source_rows(
    fixtures_dir: Path | None,
    *,
    session: requests.Session,
    page_size: int,
    timeout_s: float,
    policy: RetryPolicy,
) -> Callable[[str], Iterable[dict]]:
    if fixtures_dir is not None:
        return lambda level: iter_fixture_rows(fixtures_dir, level)
    return lambda level: iter_geo_level_rows(
        level,
        session=session,
        page_size=page_size,
        timeout_s=timeout_s,
        policy=policy,
    )


def build_argparser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Fetch CMS Medicare Monthly Enrollment data into versioned Parquet."
    )
    p.add_argument(
        "--out",
        type=Path,
        default=Path("generated/data"),
        help="Output root; Parquet files land under <out>/%s/." % LAYOUT_VERSION,
    )
    p.add_argument(
        "--fixtures",
        type=Path,
        default=None,
        help="If set, read rows from this directory instead of the live CMS API.",
    )
    p.add_argument(
        "--vendor-topojson",
        action="store_true",
        help="Also download the state + county TopoJSON alongside Parquet.",
    )
    p.add_argument(
        "--only-levels",
        default=",".join(GEO_LEVELS),
        help=(
            "Comma-separated subset of geographic levels to fetch. Useful for "
            "quick live-contract smoke tests (e.g. --only-levels National)."
        ),
    )
    p.add_argument("--page-size", type=int, default=DEFAULT_PAGE_SIZE)
    p.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT_S)
    p.add_argument("--max-retries", type=int, default=DEFAULT_MAX_RETRIES)
    p.add_argument("--verbose", "-v", action="store_true")
    return p


def main(argv: Sequence[str] | None = None) -> int:
    args = build_argparser().parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    requested_levels = tuple(
        lvl.strip() for lvl in args.only_levels.split(",") if lvl.strip()
    )
    unknown = [lvl for lvl in requested_levels if lvl not in GEO_LEVELS]
    if unknown:
        log.error("Unknown --only-levels values: %s", unknown)
        return 2

    policy = RetryPolicy(max_retries=args.max_retries)
    session = _session()

    vendor_paths: list[Path] = []
    if args.vendor_topojson:
        vendor_dir = args.out / LAYOUT_VERSION / "vendor"
        vendor_paths = vendor_topojson(
            vendor_dir, session=session, timeout_s=args.timeout, policy=policy
        )

    base_source = _cli_source_rows(
        args.fixtures,
        session=session,
        page_size=args.page_size,
        timeout_s=args.timeout,
        policy=policy,
    )

    def source(level: str) -> Iterable[dict]:
        if level not in requested_levels:
            return []
        return base_source(level)

    try:
        outputs = run_etl(args.out, source_rows=source, vendor_paths=vendor_paths)
    except EtlError as exc:
        log.error("ETL failed: %s", exc)
        return 2
    finally:
        session.close()

    log.info("Wrote %s", outputs.manifest_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
