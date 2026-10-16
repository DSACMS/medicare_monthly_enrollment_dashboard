/** @jest-environment jsdom */

import ParquetDataSource, { ParquetSourceUnavailableError } from './ParquetDataSource';

describe('ParquetDataSource', () => {
  test('has the expected sourceName', () => {
    expect(ParquetDataSource.sourceName).toBe('parquet');
  });

  test('initialize requires explicit localStorage opt-in', async () => {
    const source = new ParquetDataSource();
    await expect(source.initialize()).rejects.toBeInstanceOf(ParquetSourceUnavailableError);
  });

  test('fetch throws ParquetSourceUnavailableError before initialization succeeds', async () => {
    const source = new ParquetDataSource();
    await expect(source.fetch('nationalEnrollment', {})).rejects.toBeInstanceOf(
      ParquetSourceUnavailableError,
    );
  });

  test('metadata reflects an uninitialized source', () => {
    const source = new ParquetDataSource();
    expect(source.getMetadata()).toEqual({
      source: 'parquet',
      datasetVersion: null,
      freshness: null,
    });
  });

  test('returns national data with the CMS API output shape', async () => {
    const client = {
      initialize: jest.fn(async () => {}),
      registerFileBuffer: jest.fn(async () => {}),
      query: jest.fn(async () => [
        {
          year: '2024',
          month: 'January',
          TOT_BENES: 100,
          ORGNL_MDCR_BENES: 60,
          MA_AND_OTH_BENES: 40,
          PRSCRPTN_DRUG_TOT_BENES: 90,
          PRSCRPTN_DRUG_PDP_BENES: 50,
          PRSCRPTN_DRUG_MAPD_BENES: 40,
        },
      ]),
    };
    const source = new ParquetDataSource({
      client,
      storage: { 'use-parquet': '1' },
      cache: {
        loadManifest: jest.fn(async () => ({ files: { summary: { path: 'v1/summary.parquet' } } })),
        loadFile: jest.fn(async () => new ArrayBuffer(1)),
      },
    });

    await source.initialize();
    await expect(source.fetch('nationalEnrollment', { type: 'monthly' })).resolves.toEqual([
      {
        year: '2024',
        month: 'January',
        totalEnrollees: 100,
        omCount: 60,
        maCount: 40,
        omPercent: 60,
        maPercent: 40,
        drugTotal: 90,
        pdpCount: 50,
        mapdCount: 40,
        pdpPercent: 55.56,
        mapdPercent: 44.44,
      },
    ]);
    expect(client.registerFileBuffer).toHaveBeenCalledWith(
      'national-summary.parquet',
      expect.any(ArrayBuffer),
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("read_parquet('national-summary.parquet')"),
    );
  });

  test('rejects unsupported services after initialization', async () => {
    const source = new ParquetDataSource({
      client: { initialize: jest.fn(async () => {}), registerFileBuffer: jest.fn(async () => {}) },
      storage: { 'use-parquet': '1' },
      cache: {
        loadManifest: jest.fn(async () => ({ files: { summary: { path: 'v1/summary.parquet' } } })),
        loadFile: jest.fn(async () => new ArrayBuffer(1)),
      },
    });

    await source.initialize();
    await expect(source.fetch('countyEnrollment', { state: 'ND' })).rejects.toBeInstanceOf(
      ParquetSourceUnavailableError,
    );
  });

  test('returns state summary and trend shapes matching the CMS source', async () => {
    const rows = [
      {
        state_abbr: 'ND',
        state_name: 'North Dakota',
        year: '2024',
        month: 'Year',
        TOT_BENES: 800,
        ORGNL_MDCR_BENES: 500,
        MA_AND_OTH_BENES: 300,
        PRSCRPTN_DRUG_TOT_BENES: 700,
        PRSCRPTN_DRUG_PDP_BENES: 400,
        PRSCRPTN_DRUG_MAPD_BENES: 300,
      },
      {
        state_abbr: 'ND',
        state_name: 'North Dakota',
        year: '2024',
        month: 'January',
        TOT_BENES: 810,
        ORGNL_MDCR_BENES: 505,
        MA_AND_OTH_BENES: 305,
        PRSCRPTN_DRUG_TOT_BENES: 710,
        PRSCRPTN_DRUG_PDP_BENES: 405,
        PRSCRPTN_DRUG_MAPD_BENES: 305,
      },
    ];
    const source = new ParquetDataSource({
      client: {
        initialize: jest.fn(async () => {}),
        registerFileBuffer: jest.fn(async () => {}),
        query: jest.fn(async () => rows),
      },
      storage: { 'use-parquet': '1' },
      cache: {
        loadManifest: jest.fn(async () => ({ files: { summary: { path: 'v1/summary.parquet' } } })),
        loadFile: jest.fn(async () => new ArrayBuffer(1)),
      },
    });

    await source.initialize();
    await expect(source.fetch('allStates', { year: '2024', month: 'January' })).resolves.toEqual([
      expect.objectContaining({ state: 'ND', stateName: 'North Dakota', totalEnrollees: 800 }),
      expect.objectContaining({ state: 'ND', stateName: 'North Dakota', totalEnrollees: 810 }),
    ]);
    await expect(source.fetch('stateEnrollment', { state: 'ND' })).resolves.toEqual({
      yearly: [expect.objectContaining({ month: 'Year', totalEnrollees: 800 })],
      monthly: [expect.objectContaining({ month: 'January', totalEnrollees: 810 })],
    });
  });

  test('returns county summary and trend shapes from a state partition', async () => {
    const rows = [
      {
        state_abbr: 'ND',
        state_name: 'North Dakota',
        county_name: 'Griggs County',
        fips: '38035',
        year: '2024',
        month: 'Year',
        TOT_BENES: 690,
        ORGNL_MDCR_BENES: 450,
        MA_AND_OTH_BENES: 240,
        PRSCRPTN_DRUG_TOT_BENES: 600,
        PRSCRPTN_DRUG_PDP_BENES: 400,
        PRSCRPTN_DRUG_MAPD_BENES: 200,
      },
      {
        state_abbr: 'ND',
        state_name: 'North Dakota',
        county_name: 'Griggs County',
        fips: '38035',
        year: '2024',
        month: 'January',
        TOT_BENES: 700,
        ORGNL_MDCR_BENES: 455,
        MA_AND_OTH_BENES: 245,
        PRSCRPTN_DRUG_TOT_BENES: 610,
        PRSCRPTN_DRUG_PDP_BENES: 405,
        PRSCRPTN_DRUG_MAPD_BENES: 205,
      },
    ];
    const client = {
      initialize: jest.fn(async () => {}),
      registerFileBuffer: jest.fn(async () => {}),
      query: jest.fn(async (sql) => (sql.includes("month <> 'Year'") ? [rows[1]] : rows)),
    };
    const source = new ParquetDataSource({
      client,
      storage: { 'use-parquet': '1' },
      cache: {
        loadManifest: jest.fn(async () => ({
          files: {
            summary: { path: 'v1/summary.parquet' },
            counties: { ND: { path: 'v1/counties/ND.parquet', size_bytes: 1 } },
          },
        })),
        loadFile: jest.fn(async () => new ArrayBuffer(1)),
      },
    });

    await source.initialize();
    await expect(source.fetch('countyEnrollment', { state: 'ND' })).resolves.toEqual([
      expect.objectContaining({ county: 'Griggs County', fips: '38035', totalEnrollees: 700 }),
    ]);
    await expect(
      source.fetch('countyTrend', { state: 'ND', county: 'Griggs County' }),
    ).resolves.toEqual({
      yearly: [expect.objectContaining({ month: 'Year', totalEnrollees: 690 })],
      monthly: [expect.objectContaining({ month: 'January', totalEnrollees: 700 })],
    });
    expect(client.registerFileBuffer).toHaveBeenCalledWith(
      'county-ND.parquet',
      expect.any(ArrayBuffer),
    );
  });
});
