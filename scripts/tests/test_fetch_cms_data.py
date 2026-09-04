"""Tests for scripts/fetch_cms_data.py.

Covers the Phase 1 acceptance criteria:

- schema drift (missing columns, unknown month, bogus geo level)
- pagination across multiple fixture pages
- duplicate detection
- suppression vs missing vs reported-zero distinctions
- period parsing
- FIPS padding
- deterministic byte-level output for identical input
- row-count reconciliation with the manifest
- atomic writes leave no stray tmp files behind
- retry policy: transient 5xx retries then succeeds
- retry policy: exhausted retries raise ApiFetchError
- TopoJSON vendoring calls the right URLs and writes real bytes
"""

from __future__ import annotations

import copy
import hashlib
import io
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq
import pytest
import requests
import responses

from scripts import fetch_cms_data as etl

FIXTURES = Path(__file__).parent / "fixtures"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _source_from(fixtures_subdir: str):
    root = FIXTURES / fixtures_subdir

    def _source(level: str):
        return list(etl.iter_fixture_rows(root, level))

    return _source


def _run(tmp_path: Path, fixtures_subdir: str, **kwargs) -> etl.EtlOutputs:
    return etl.run_etl(
        tmp_path,
        source_rows=_source_from(fixtures_subdir),
        generated_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        **kwargs,
    )


# ---------------------------------------------------------------------------
# Normalization
# ---------------------------------------------------------------------------


class TestNormalizeRow:
    def _base(self, **overrides):
        row = {
            "YEAR": "2024",
            "MONTH": "January",
            "BENE_GEO_LVL": "County",
            "BENE_STATE_ABRVTN": "SD",
            "BENE_STATE_DESC": "South Dakota",
            "BENE_COUNTY_DESC": "Aurora County",
            "BENE_FIPS_CD": "46003",
            "TOT_BENES": "800",
            "ORGNL_MDCR_BENES": "500",
            "MA_AND_OTH_BENES": "300",
            "PRSCRPTN_DRUG_TOT_BENES": "700",
            "PRSCRPTN_DRUG_PDP_BENES": "500",
            "PRSCRPTN_DRUG_MAPD_BENES": "200",
        }
        row.update(overrides)
        return row

    def test_basic_county_row(self):
        out = etl.normalize_row(self._base())
        assert out["fips"] == "46003"
        assert out["state_abbr"] == "SD"
        assert out["month"] == "January"
        assert out["month_ordinal"] == 1
        assert out["TOT_BENES"] == 800
        assert out["suppressed_fields"] == ""

    def test_missing_column_raises_schema_drift(self):
        row = self._base()
        del row["TOT_BENES"]
        with pytest.raises(etl.SchemaDriftError, match="TOT_BENES"):
            etl.normalize_row(row)

    def test_unexpected_geo_level_raises_schema_drift(self):
        with pytest.raises(etl.SchemaDriftError, match="BENE_GEO_LVL"):
            etl.normalize_row(self._base(BENE_GEO_LVL="Solar System"))

    def test_unknown_month_raises_schema_drift(self):
        with pytest.raises(etl.SchemaDriftError, match="MONTH"):
            etl.normalize_row(self._base(MONTH="Smarch"))

    def test_year_month_special_value(self):
        row = self._base(MONTH="Year")
        out = etl.normalize_row(row)
        assert out["month"] == "Year"
        assert out["month_ordinal"] == 0

    def test_national_fips_normalizes_to_empty(self):
        row = self._base(BENE_GEO_LVL="National", BENE_STATE_ABRVTN="US",
                         BENE_STATE_DESC="National", BENE_FIPS_CD="     ")
        assert etl.normalize_row(row)["fips"] == ""

    def test_state_fips_normalizes_to_empty(self):
        # For state rows CMS sometimes carries a 2-digit code; ETL still
        # normalizes state-level FIPS to empty because the runtime code
        # keys states by BENE_STATE_ABRVTN, not FIPS.
        row = self._base(BENE_GEO_LVL="State", BENE_COUNTY_DESC="Total",
                         BENE_FIPS_CD="46")
        assert etl.normalize_row(row)["fips"] == ""

    def test_county_fips_left_padded(self):
        # CMS occasionally strips the leading zero on Alabama codes
        row = self._base(BENE_STATE_ABRVTN="AL", BENE_STATE_DESC="Alabama",
                         BENE_COUNTY_DESC="Autauga County", BENE_FIPS_CD="1001")
        assert etl.normalize_row(row)["fips"] == "01001"

    def test_county_fips_already_padded_is_unchanged(self):
        assert etl.normalize_row(self._base())["fips"] == "46003"

    def test_county_fips_wrong_length_raises(self):
        with pytest.raises(etl.SchemaDriftError, match="longer than 5"):
            etl.normalize_row(self._base(BENE_FIPS_CD="460030"))

    def test_county_fips_non_numeric_raises(self):
        with pytest.raises(etl.SchemaDriftError, match="not numeric"):
            etl.normalize_row(self._base(BENE_FIPS_CD="ABCDE"))

    def test_suppression_marker_recorded_and_null(self):
        row = self._base(ORGNL_MDCR_BENES="*", PRSCRPTN_DRUG_PDP_BENES="*")
        out = etl.normalize_row(row)
        assert out["ORGNL_MDCR_BENES"] is None
        assert out["PRSCRPTN_DRUG_PDP_BENES"] is None
        assert set(out["suppressed_fields"].split(",")) == {
            "ORGNL_MDCR_BENES",
            "PRSCRPTN_DRUG_PDP_BENES",
        }

    def test_missing_value_is_null_and_not_suppressed(self):
        row = self._base(PRSCRPTN_DRUG_TOT_BENES=None,
                         PRSCRPTN_DRUG_PDP_BENES=None,
                         PRSCRPTN_DRUG_MAPD_BENES=None)
        out = etl.normalize_row(row)
        assert out["PRSCRPTN_DRUG_TOT_BENES"] is None
        assert out["suppressed_fields"] == ""

    def test_reported_zero_stays_zero(self):
        row = self._base(TOT_BENES="0", ORGNL_MDCR_BENES="0",
                         MA_AND_OTH_BENES="0")
        out = etl.normalize_row(row)
        assert out["TOT_BENES"] == 0
        assert out["ORGNL_MDCR_BENES"] == 0
        assert out["MA_AND_OTH_BENES"] == 0
        assert out["suppressed_fields"] == ""


# ---------------------------------------------------------------------------
# Pagination via fixture directory
# ---------------------------------------------------------------------------


class TestFixturePagination:
    def test_yields_rows_across_pages(self):
        rows = list(etl.iter_fixture_rows(FIXTURES / "basic", "County"))
        # basic/county_page_001 has 2 rows, county_page_002 has 1 row
        assert len(rows) == 3
        state_codes = [r["BENE_STATE_ABRVTN"] for r in rows]
        assert state_codes == ["SD", "SD", "CA"]

    def test_empty_directory_yields_nothing(self, tmp_path):
        assert list(etl.iter_fixture_rows(tmp_path, "County")) == []


# ---------------------------------------------------------------------------
# End-to-end pipeline
# ---------------------------------------------------------------------------


class TestRunEtl:
    def test_basic_pipeline_produces_manifest_and_files(self, tmp_path):
        out = _run(tmp_path, "basic")
        assert out.manifest_path.exists()
        assert out.summary_path.exists()
        assert set(out.county_paths) == {"SD", "CA"}
        manifest = json.loads(out.manifest_path.read_text())
        assert manifest["schema_version"] == etl.SCHEMA_VERSION
        assert manifest["layout_version"] == etl.LAYOUT_VERSION
        assert manifest["source"]["dataset_id"] == etl.DATASET_ID
        # Latest period should be the monthly one, not the annual "Year" row.
        assert manifest["latest_period"] == {"year": "2024", "month": "January"}

    def test_row_counts_reconcile_with_manifest(self, tmp_path):
        out = _run(tmp_path, "basic")
        manifest = json.loads(out.manifest_path.read_text())

        summary_rows_read = len(pq.read_table(out.summary_path))
        county_rows_read = sum(
            len(pq.read_table(p)) for p in out.county_paths.values()
        )

        assert manifest["row_counts"]["summary"] == summary_rows_read
        assert manifest["row_counts"]["counties_total"] == county_rows_read
        assert (
            manifest["row_counts"]["total"]
            == summary_rows_read + county_rows_read
        )
        assert manifest["files"]["summary"]["rows"] == summary_rows_read

    def test_files_are_sha256_hashed_and_size_recorded(self, tmp_path):
        out = _run(tmp_path, "basic")
        manifest = json.loads(out.manifest_path.read_text())
        entry = manifest["files"]["summary"]
        expected_hash = hashlib.sha256(out.summary_path.read_bytes()).hexdigest()
        assert entry["sha256"] == expected_hash
        assert entry["size_bytes"] == out.summary_path.stat().st_size

    def test_county_partitions_are_state_scoped(self, tmp_path):
        out = _run(tmp_path, "basic")
        sd_rows = pq.read_table(out.county_paths["SD"]).to_pandas()
        assert set(sd_rows["state_abbr"]) == {"SD"}
        assert set(sd_rows["fips"]) == {"46003", "46099"}
        ca_rows = pq.read_table(out.county_paths["CA"]).to_pandas()
        assert set(ca_rows["state_abbr"]) == {"CA"}

    def test_deterministic_output_same_bytes_same_input(self, tmp_path):
        out_a = _run(tmp_path / "a", "basic")
        out_b = _run(tmp_path / "b", "basic")
        assert out_a.summary_path.read_bytes() == out_b.summary_path.read_bytes()
        for state, path_a in out_a.county_paths.items():
            path_b = out_b.county_paths[state]
            assert path_a.read_bytes() == path_b.read_bytes()

    def test_suppression_flows_through_to_parquet(self, tmp_path):
        # Suppressed fixture has no national or state, so pipeline needs
        # county-only. The basic national/state files are still required by
        # run_etl in principle, so we compose a mixed source:
        def source(level: str):
            if level in ("National", "State"):
                return list(etl.iter_fixture_rows(FIXTURES / "basic", level))
            return list(etl.iter_fixture_rows(FIXTURES / "suppressed", level))

        outputs = etl.run_etl(
            tmp_path,
            source_rows=source,
            generated_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        )
        ak_table = pq.read_table(outputs.county_paths["AK"]).to_pandas()
        aleutians = ak_table[ak_table["fips"] == "02013"].iloc[0]
        # * -> NULL + recorded in suppressed_fields
        assert pd.isna(aleutians["ORGNL_MDCR_BENES"])
        assert "ORGNL_MDCR_BENES" in aleutians["suppressed_fields"].split(",")
        # explicit null -> NULL and NOT recorded as suppressed
        kalawao = ak_table[ak_table["fips"] == "15005"].iloc[0]
        assert pd.isna(kalawao["PRSCRPTN_DRUG_TOT_BENES"])
        assert kalawao["suppressed_fields"] == ""
        # reported zero is preserved
        assert kalawao["TOT_BENES"] == 0

    def test_duplicate_rows_raise(self, tmp_path):
        base_rows = list(etl.iter_fixture_rows(FIXTURES / "basic", "County"))
        duplicated = base_rows + [copy.deepcopy(base_rows[0])]

        def source(level: str):
            if level == "County":
                return duplicated
            return list(etl.iter_fixture_rows(FIXTURES / "basic", level))

        with pytest.raises(etl.DuplicateRowError):
            etl.run_etl(
                tmp_path,
                source_rows=source,
                generated_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            )

    def test_completely_empty_input_raises(self, tmp_path):
        with pytest.raises(etl.MissingPartitionError):
            etl.run_etl(
                tmp_path,
                source_rows=lambda level: [],
                generated_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            )

    def test_no_stray_tmp_files_after_success(self, tmp_path):
        out = _run(tmp_path, "basic")
        stray = list(tmp_path.rglob("*.tmp"))
        assert not stray
        # And the manifest is real JSON with a trailing newline.
        text = out.manifest_path.read_text()
        assert text.endswith("\n")
        json.loads(text)

    def test_malformed_month_fixture_raises(self, tmp_path):
        def source(level: str):
            if level == "County":
                return list(etl.iter_fixture_rows(FIXTURES / "malformed_month", level))
            return list(etl.iter_fixture_rows(FIXTURES / "basic", level))

        with pytest.raises(etl.SchemaDriftError, match="MONTH"):
            etl.run_etl(
                tmp_path,
                source_rows=source,
                generated_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            )

    def test_malformed_missing_columns_fixture_raises(self, tmp_path):
        def source(level: str):
            if level == "County":
                return list(etl.iter_fixture_rows(FIXTURES / "malformed_missing_columns", level))
            return list(etl.iter_fixture_rows(FIXTURES / "basic", level))

        with pytest.raises(etl.SchemaDriftError):
            etl.run_etl(
                tmp_path,
                source_rows=source,
                generated_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            )


# ---------------------------------------------------------------------------
# HTTP retry policy — never talks to a real network
# ---------------------------------------------------------------------------


class TestRetryPolicy:
    _URL = f"{etl.API_BASE}/{etl.DATASET_ID}/data"

    @responses.activate
    def test_transient_5xx_retries_then_succeeds(self):
        # First call returns 503, second call returns rows.
        responses.add(responses.GET, self._URL, status=503)
        responses.add(
            responses.GET,
            self._URL,
            json=[{"YEAR": "2024", "MONTH": "January", "BENE_GEO_LVL": "National",
                   "BENE_STATE_ABRVTN": "US", "BENE_STATE_DESC": "National",
                   "BENE_COUNTY_DESC": "Total", "BENE_FIPS_CD": "     ",
                   "TOT_BENES": "1", "ORGNL_MDCR_BENES": "1",
                   "MA_AND_OTH_BENES": "0", "PRSCRPTN_DRUG_TOT_BENES": "1",
                   "PRSCRPTN_DRUG_PDP_BENES": "1",
                   "PRSCRPTN_DRUG_MAPD_BENES": "0"}],
            status=200,
        )

        policy = etl.RetryPolicy(max_retries=3, sleep=lambda _s: None)
        rows = list(
            etl.iter_geo_level_rows(
                "National",
                page_size=100,
                policy=policy,
                base_url=self._URL,
            )
        )
        assert len(rows) == 1

    @responses.activate
    def test_exhausted_retries_raises_api_fetch_error(self):
        responses.add(responses.GET, self._URL, status=503)
        responses.add(responses.GET, self._URL, status=503)
        responses.add(responses.GET, self._URL, status=503)

        policy = etl.RetryPolicy(max_retries=2, sleep=lambda _s: None)
        with pytest.raises(etl.ApiFetchError):
            list(
                etl.iter_geo_level_rows(
                    "National",
                    page_size=100,
                    policy=policy,
                    base_url=self._URL,
                )
            )

    @responses.activate
    def test_non_retriable_status_raises_immediately(self):
        responses.add(responses.GET, self._URL, status=404, body="not found")
        policy = etl.RetryPolicy(max_retries=5, sleep=lambda _s: None)
        with pytest.raises(etl.ApiFetchError):
            list(
                etl.iter_geo_level_rows(
                    "National",
                    page_size=100,
                    policy=policy,
                    base_url=self._URL,
                )
            )
        # Only the first request was made, no retries on a 404.
        assert len(responses.calls) == 1

    @responses.activate
    def test_pagination_stops_on_short_page(self):
        # Two rows returned, page_size=5, so pagination halts after one call.
        rows = [
            {
                "YEAR": "2024", "MONTH": "January", "BENE_GEO_LVL": "National",
                "BENE_STATE_ABRVTN": "US", "BENE_STATE_DESC": "National",
                "BENE_COUNTY_DESC": "Total", "BENE_FIPS_CD": "     ",
                "TOT_BENES": str(i), "ORGNL_MDCR_BENES": "0",
                "MA_AND_OTH_BENES": "0", "PRSCRPTN_DRUG_TOT_BENES": "0",
                "PRSCRPTN_DRUG_PDP_BENES": "0",
                "PRSCRPTN_DRUG_MAPD_BENES": "0",
            }
            for i in range(2)
        ]
        responses.add(responses.GET, self._URL, json=rows, status=200)

        policy = etl.RetryPolicy(max_retries=0, sleep=lambda _s: None)
        got = list(
            etl.iter_geo_level_rows(
                "National", page_size=5, policy=policy, base_url=self._URL,
            )
        )
        assert len(got) == 2
        assert len(responses.calls) == 1

    @responses.activate
    def test_pagination_advances_offset_until_short_page(self):
        # Full page then empty page.
        full_page = [
            {
                "YEAR": "2024", "MONTH": "January", "BENE_GEO_LVL": "National",
                "BENE_STATE_ABRVTN": "US", "BENE_STATE_DESC": "National",
                "BENE_COUNTY_DESC": "Total", "BENE_FIPS_CD": "     ",
                "TOT_BENES": str(i), "ORGNL_MDCR_BENES": "0",
                "MA_AND_OTH_BENES": "0", "PRSCRPTN_DRUG_TOT_BENES": "0",
                "PRSCRPTN_DRUG_PDP_BENES": "0",
                "PRSCRPTN_DRUG_MAPD_BENES": "0",
            }
            for i in range(3)
        ]
        responses.add(responses.GET, self._URL, json=full_page, status=200)
        responses.add(responses.GET, self._URL, json=[], status=200)

        policy = etl.RetryPolicy(max_retries=0, sleep=lambda _s: None)
        got = list(
            etl.iter_geo_level_rows(
                "National", page_size=3, policy=policy, base_url=self._URL,
            )
        )
        assert len(got) == 3
        assert len(responses.calls) == 2
        assert responses.calls[1].request.url.endswith("offset=3")


# ---------------------------------------------------------------------------
# TopoJSON vendoring
# ---------------------------------------------------------------------------


class TestVendorTopojson:
    @responses.activate
    def test_writes_files_from_upstream(self, tmp_path):
        states_url = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json"
        counties_url = "https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json"
        responses.add(responses.GET, states_url, body=b"{\"type\":\"Topology\"}", status=200)
        responses.add(responses.GET, counties_url, body=b"{\"type\":\"Topology\"}", status=200)

        policy = etl.RetryPolicy(max_retries=1, sleep=lambda _s: None)
        written = etl.vendor_topojson(tmp_path, policy=policy)
        names = sorted(p.name for p in written)
        assert names == ["counties-10m.json", "states-10m.json"]
        for path in written:
            assert path.read_bytes() == b"{\"type\":\"Topology\"}"

    @responses.activate
    def test_exhausted_retries_raise(self, tmp_path):
        states_url = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json"
        responses.add(responses.GET, states_url, status=503)
        responses.add(responses.GET, states_url, status=503)
        policy = etl.RetryPolicy(max_retries=1, sleep=lambda _s: None)
        with pytest.raises(etl.ApiFetchError):
            etl.vendor_topojson(
                tmp_path,
                policy=policy,
                sources=((states_url, "states-10m.json"),),
            )
