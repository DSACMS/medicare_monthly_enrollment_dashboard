/** @jest-environment jsdom */

import CmsApiDataSource, { SERVICE_REGISTRY } from './CmsApiDataSource';

jest.mock('../../datasets/nationalEnrollment', () => ({
  __esModule: true,
  default: jest.fn(async (opts) => ({ svc: 'nationalEnrollment', opts })),
}));
jest.mock('../../datasets/countyEnrollment', () => ({
  __esModule: true,
  default: jest.fn(async (opts) => ({ svc: 'countyEnrollment', opts })),
  fetchCountyEnrollment: jest.fn(async (opts) => ({ svc: 'countyTrend', opts })),
}));
jest.mock('../../datasets/stateEnrollment', () => ({
  __esModule: true,
  fetchAllStates: jest.fn(async (opts) => ({ svc: 'allStates', opts })),
  fetchStateEnrollment: jest.fn(async (opts) => ({ svc: 'stateEnrollment', opts })),
}));

describe('CmsApiDataSource', () => {
  const source = new CmsApiDataSource();

  test('has the expected sourceName', () => {
    expect(CmsApiDataSource.sourceName).toBe('cms-api');
  });

  test('registers every service the dashboard uses', () => {
    expect(Object.keys(SERVICE_REGISTRY).sort()).toEqual(
      [
        'allStates',
        'countyEnrollment',
        'countyTrend',
        'nationalEnrollment',
        'stateEnrollment',
      ].sort(),
    );
  });

  test('initialize is a no-op', async () => {
    await expect(source.initialize()).resolves.toBeUndefined();
  });

  test.each([
    ['nationalEnrollment', { type: 'yearly' }],
    ['countyEnrollment', { state: 'SD' }],
    ['countyTrend', { state: 'SD', county: 'Minnehaha County' }],
    ['allStates', { year: '2024', month: 'January' }],
    ['stateEnrollment', { state: 'SD' }],
  ])('fetches %s via the registered function', async (svc, opts) => {
    await expect(source.fetch(svc, opts)).resolves.toEqual({ svc, opts });
  });

  test('throws a descriptive error for unknown service', async () => {
    await expect(source.fetch('bogus', {})).rejects.toThrow(/unknown service 'bogus'/);
  });

  test('metadata identifies the source', () => {
    expect(source.getMetadata()).toEqual({
      source: 'cms-api',
      datasetVersion: null,
      freshness: null,
    });
  });
});
