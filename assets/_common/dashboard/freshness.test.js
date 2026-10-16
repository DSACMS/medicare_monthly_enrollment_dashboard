import formatFreshnessInfo from './freshness';

describe('formatFreshnessInfo', () => {
  test('describes the generated date for opt-in Parquet data', () => {
    expect(formatFreshnessInfo({ source: 'parquet', freshness: '2026-09-04T01:21:29+00:00' })).toBe(
      'Data source: downloaded data, generated 2026-09-04.',
    );
  });

  test('identifies CMS data without implying a generation date', () => {
    expect(formatFreshnessInfo({ source: 'cms-api', freshness: null })).toBe(
      'Data source: CMS API.',
    );
  });

  test('does not render unavailable metadata', () => {
    expect(formatFreshnessInfo()).toBeNull();
  });
});
