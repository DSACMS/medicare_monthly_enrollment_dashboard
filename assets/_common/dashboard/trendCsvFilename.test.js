/* eslint-env jest */
import { trendCsvFilename } from './shared';

describe('trendCsvFilename', () => {
  const base = { activeTrendType: 'hospital', activeTrendRange: 'yearly' };

  it('uses "national" when no area is selected', () => {
    expect(trendCsvFilename({ ...base, trendScope: 'national', trendArea: null })).toBe(
      'enrollment-trend-hospital-yearly-national.csv',
    );
  });

  it('includes the state abbreviation for a state selection', () => {
    const trendArea = { state: 'CA', stateName: 'California' };
    expect(
      trendCsvFilename({ ...base, activeTrendRange: 'monthly', trendScope: 'state', trendArea }),
    ).toBe('enrollment-trend-hospital-monthly-CA.csv');
  });

  it('includes the state and county for a county selection', () => {
    const trendArea = { state: 'CA', stateName: 'California', county: 'Los Angeles' };
    expect(trendCsvFilename({ ...base, trendScope: 'county', trendArea })).toBe(
      'enrollment-trend-hospital-yearly-CA-los-angeles.csv',
    );
  });

  it('strips characters that are unsafe in file names', () => {
    const trendArea = { state: 'AK', county: "Prince of Wales-Hyder (C'A)" };
    expect(
      trendCsvFilename({ ...base, activeTrendType: 'drug', trendScope: 'county', trendArea }),
    ).toBe('enrollment-trend-drug-yearly-AK-prince-of-wales-hyder-c-a.csv');
  });
});
