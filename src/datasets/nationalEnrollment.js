import { cmsGet } from '../api/cmsClient.js';

const monthOrder = {
  'January': 1, 'February': 2, 'March': 3, 'April': 4, 'May': 5, 'June': 6,
  'July': 7, 'August': 8, 'September': 9, 'October': 10, 'November': 11, 'December': 12
};

export async function fetchNationalData(options) {
  const type = options.type || 'monthly';

  const queryParams = new URLSearchParams({
    'filter[BENE_GEO_LVL]': 'National',
    'sort[YEAR]': 'DESC',
    'sort[MONTH]': 'DESC',
    'size': '100'
  });

  const rawData = await cmsGet(queryParams);
  const num = (val) => parseInt(val, 10) || 0;

  const parsedRows = rawData.map(row => {
    const total = num(row.TOT_BENES);
    const ffs = num(row.ORGNL_MDCR_BENES);
    const ma = num(row.MA_AND_OTH_BENES);

    return {
      year: row.YEAR,
      month: row.MONTH,
      totalEnrollees: total,
      ffsCount: ffs,
      maCount: ma,
      ffsPercent: total > 0 ? parseFloat(((ffs / total) * 100).toFixed(2)) : 0,
      maPercent: total > 0 ? parseFloat(((ma / total) * 100).toFixed(2)) : 0
    };
  });

  if (type === 'yearly') {
    const yearlyMap = {};

    parsedRows.forEach(row => {
      if (!yearlyMap[row.year]) {
        yearlyMap[row.year] = { totalEnrollees: 0, ffsCount: 0, maCount: 0, count: 0 };
      }
      yearlyMap[row.year].totalEnrollees += row.totalEnrollees;
      yearlyMap[row.year].ffsCount += row.ffsCount;
      yearlyMap[row.year].maCount += row.maCount;
      yearlyMap[row.year].count += 1;
    });

    return Object.keys(yearlyMap).map(year => {
      const agg = yearlyMap[year];
      const avgTotal = Math.round(agg.totalEnrollees / agg.count);
      const avgFfs = Math.round(agg.ffsCount / agg.count);
      const avgMa = Math.round(agg.maCount / agg.count);

      return {
        year,
        totalEnrollees: avgTotal,
        ffsCount: avgFfs,
        maCount: avgMa,
        ffsPercent: avgTotal > 0 ? parseFloat(((avgFfs / avgTotal) * 100).toFixed(2)) : 0,
        maPercent: avgTotal > 0 ? parseFloat(((avgMa / avgTotal) * 100).toFixed(2)) : 0
      };
    }).sort((a, b) => b.year - a.year);
  }

  if (type === 'monthly') {
    return parsedRows
      .filter(row => row.month !== 'Year')
      .sort((a, b) => {
        if (b.year !== a.year) return parseInt(b.year, 10) - parseInt(a.year, 10);
        return monthOrder[b.month] - monthOrder[a.month];
      })
      .slice(0, 12);
  }
}
