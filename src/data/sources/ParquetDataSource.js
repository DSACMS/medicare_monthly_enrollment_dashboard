/**
 * Data source that queries preprocessed Parquet files with DuckDB-Wasm.
 *
 * This opt-in implementation currently supports national enrollment only.
 * Unsupported services throw so DataManager can use CmsApiDataSource.
 *
 * See docs/adr/0001-parquet-duckdb-webmcp-architecture.md for the design.
 */

/* eslint-disable max-classes-per-file */

import DuckDbClient from '../duckdb/DuckDbClient';
import { selectDuckDbBundle } from '../duckdb/bundleSelector';
import ParquetCache from '../ParquetCache';
import { parseEnrollmentFields, sortDescByPeriod } from '../../utils';

const SUMMARY_FILE_NAME = 'national-summary.parquet';
const ENROLLMENT_COLUMNS =
  'year, month, TOT_BENES, ORGNL_MDCR_BENES, MA_AND_OTH_BENES, PRSCRPTN_DRUG_TOT_BENES, PRSCRPTN_DRUG_PDP_BENES, PRSCRPTN_DRUG_MAPD_BENES';

function parseStateRow(row) {
  return {
    state: row.state_abbr,
    stateName: row.state_name,
    year: String(row.year),
    month: row.month,
    ...parseEnrollmentFields(row),
  };
}

function parseCountyRow(row) {
  return {
    state: row.state_abbr,
    stateName: row.state_name,
    county: row.county_name,
    fips: row.fips,
    year: String(row.year),
    month: row.month,
    ...parseEnrollmentFields(row),
  };
}

function sqlString(value) {
  return String(value).replace(/'/g, "''");
}

export class ParquetSourceUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ParquetSourceUnavailableError';
  }
}

export default class ParquetDataSource {
  static get sourceName() {
    return 'parquet';
  }

  constructor({
    manifestUrl = 'data/v1/manifest.json',
    assetBaseUrl = 'assets/duckdb',
    client = null,
    fetchFn = globalThis.fetch,
    storage = globalThis.localStorage,
    cache = null,
  } = {}) {
    this.manifestUrl = manifestUrl;
    this.assetBaseUrl = assetBaseUrl;
    this.client = client;
    this.fetchFn = fetchFn;
    this.storage = storage;
    this.cache = cache || new ParquetCache({ fetchFn });
    this.countyFiles = new Set();
    this.manifest = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    if (!this.isOptedIn()) {
      throw new ParquetSourceUnavailableError(
        "Parquet data is disabled; set localStorage['use-parquet'] to '1' to opt in.",
      );
    }
    try {
      this.manifest = await this.cache.loadManifest(this.manifestUrl);
    } catch {
      throw new ParquetSourceUnavailableError('Unable to load the Parquet data manifest.');
    }
    if (!this.manifest?.files?.summary?.path) {
      throw new ParquetSourceUnavailableError('The Parquet data manifest has no summary file.');
    }

    this.client ||= new DuckDbClient({
      bundle: selectDuckDbBundle({ assetBaseUrl: this.assetBaseUrl }),
    });
    await this.client.initialize();
    try {
      const summaryBytes = await this.cache.loadFile(this.summaryUrl(), this.manifest);
      await this.client.registerFileBuffer(SUMMARY_FILE_NAME, summaryBytes);
    } catch {
      throw new ParquetSourceUnavailableError('Unable to load the Parquet national summary.');
    }
    this.initialized = true;
  }

  async fetch(serviceName, options = {}) {
    if (!this.initialized) {
      throw new ParquetSourceUnavailableError(
        'ParquetDataSource.fetch called before initialization.',
      );
    }
    if (serviceName === 'nationalEnrollment') return this.fetchNationalEnrollment(options);
    if (serviceName === 'allStates') return this.fetchAllStates(options);
    if (serviceName === 'stateEnrollment') return this.fetchStateEnrollment(options);
    if (serviceName === 'countyEnrollment') return this.fetchCountyEnrollment(options);
    if (serviceName === 'countyTrend') return this.fetchCountyTrend(options);
    throw new ParquetSourceUnavailableError(`ParquetDataSource does not support '${serviceName}'.`);
  }

  async fetchNationalEnrollment(options) {
    const rows = await this.client.query(
      `SELECT ${ENROLLMENT_COLUMNS} FROM read_parquet('${SUMMARY_FILE_NAME}') WHERE geo_level = 'National' ORDER BY CAST(year AS INTEGER) DESC, month_ordinal DESC`,
    );
    const parsedRows = rows.map((row) => ({
      year: String(row.year),
      month: row.month,
      ...parseEnrollmentFields(row),
    }));
    if (options.type === 'yearly')
      return sortDescByPeriod(parsedRows.filter((row) => row.month === 'Year'));
    if (!options.type || options.type === 'monthly') {
      return sortDescByPeriod(parsedRows.filter((row) => row.month !== 'Year')).slice(0, 12);
    }
    return parsedRows;
  }

  async fetchAllStates({ year, month } = {}) {
    if (!year || !month) {
      throw new Error('fetchAllStates requires options.year and options.month');
    }
    const rows = await this.client.query(
      `SELECT state_abbr, state_name, ${ENROLLMENT_COLUMNS} FROM read_parquet('${SUMMARY_FILE_NAME}') WHERE geo_level = 'State' AND year = '${sqlString(year)}' AND month = '${sqlString(month)}'`,
    );
    return rows.map(parseStateRow);
  }

  async fetchStateEnrollment({ state } = {}) {
    if (!state) {
      throw new Error("fetchStateEnrollment requires options.state (e.g. 'NY')");
    }
    const rows = await this.client.query(
      `SELECT state_abbr, state_name, ${ENROLLMENT_COLUMNS} FROM read_parquet('${SUMMARY_FILE_NAME}') WHERE geo_level = 'State' AND state_abbr = '${sqlString(state)}' ORDER BY CAST(year AS INTEGER) DESC, month_ordinal DESC`,
    );
    const parsedRows = rows.map(parseStateRow);
    return {
      yearly: sortDescByPeriod(parsedRows.filter((row) => row.month === 'Year')),
      monthly: sortDescByPeriod(parsedRows.filter((row) => row.month !== 'Year')).slice(0, 12),
    };
  }

  async fetchCountyEnrollment({ state, year, month } = {}) {
    if (!state) {
      throw new Error("fetchCountiesForState requires options.state (e.g. 'NY')");
    }
    const fileName = await this.loadCountyFile(state);
    const hasPeriod = Boolean(year && month);
    const periodFilter = hasPeriod
      ? ` AND year = '${sqlString(year)}' AND month = '${sqlString(month)}'`
      : '';
    const rows = await this.client.query(
      `SELECT state_abbr, state_name, county_name, fips, ${ENROLLMENT_COLUMNS} FROM read_parquet('${fileName}') WHERE month <> 'Year' AND county_name <> 'Unknown'${periodFilter} ORDER BY CAST(year AS INTEGER) DESC, month_ordinal DESC`,
    );
    const parsedRows = rows.map(parseCountyRow);
    if (hasPeriod) return parsedRows;
    const [latest] = sortDescByPeriod(parsedRows);
    return latest
      ? parsedRows.filter((row) => row.year === latest.year && row.month === latest.month)
      : [];
  }

  async fetchCountyTrend({ state, county } = {}) {
    if (!state || !county) {
      throw new Error(
        "fetchCountyEnrollment requires options.state and options.county (e.g. { state: 'NY', county: 'Kings' })",
      );
    }
    const fileName = await this.loadCountyFile(state);
    const rows = await this.client.query(
      `SELECT state_abbr, state_name, county_name, fips, ${ENROLLMENT_COLUMNS} FROM read_parquet('${fileName}') WHERE county_name = '${sqlString(county)}' ORDER BY CAST(year AS INTEGER) DESC, month_ordinal DESC`,
    );
    const parsedRows = rows.map(parseCountyRow);
    return {
      yearly: sortDescByPeriod(parsedRows.filter((row) => row.month === 'Year')),
      monthly: sortDescByPeriod(parsedRows.filter((row) => row.month !== 'Year')).slice(0, 12),
    };
  }

  async loadCountyFile(state) {
    const partition = this.manifest.files.counties?.[state];
    if (!partition) {
      throw new ParquetSourceUnavailableError(`No Parquet county partition for '${state}'.`);
    }
    const fileName = `county-${state}.parquet`;
    if (!this.countyFiles.has(fileName)) {
      const bytes = await this.cache.loadFile(`data/${partition.path}`, this.manifest, partition);
      await this.client.registerFileBuffer(fileName, bytes);
      this.countyFiles.add(fileName);
    }
    return fileName;
  }

  isOptedIn() {
    try {
      return this.storage?.['use-parquet'] === '1';
    } catch {
      return false;
    }
  }

  summaryUrl() {
    return `data/${this.manifest.files.summary.path}`;
  }

  getMetadata() {
    return {
      source: ParquetDataSource.sourceName,
      datasetVersion: this.manifest?.schema_version || null,
      freshness: this.manifest?.generated_at || null,
    };
  }
}
