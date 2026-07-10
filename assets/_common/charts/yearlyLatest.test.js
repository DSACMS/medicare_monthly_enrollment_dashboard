/* eslint-env jest */
import mergeLatestMonthlyIntoYearly from './yearlyLatest';


describe('mergeLatestMonthlyIntoYearly', () => {
  it('prepends the latest monthly row when monthly year is newer than yearly year', () => {
    const yearly = [{ year: '2025', Enrollees: 100 }];
    const monthly = [{ year: '2026', Enrollees: 200 }];

    const result = mergeLatestMonthlyIntoYearly(yearly, monthly);

    expect(result).toEqual([
      { year: '2026', Enrollees: 200 },
      { year: '2025', Enrollees: 100 },
    ]);
  });

  it('returns yearly data when monthly year is not newer', () => {
    const yearly = [{ year: '2025', Enrollees: 100 }];
    const monthly = [{ year: '2025', Enrollees: 200 }];

    const result = mergeLatestMonthlyIntoYearly(yearly, monthly);

    expect(result).toEqual(yearly);
  });

  it('returns yearly data when monthly data is empty', () => {
    const yearly = [{ year: '2025', Enrollees: 100 }];
    const monthly = [];

    const result = mergeLatestMonthlyIntoYearly(yearly, monthly);

    expect(result).toEqual(yearly);
  });

  it('returns monthly data when yearly data is empty', () => {
    const yearly = [];
    const monthly = [{ year: '2026', Enrollees: 200 }];

    const result = mergeLatestMonthlyIntoYearly(yearly, monthly);

    expect(result).toEqual(monthly);
  });
});
