import cmsGet from '../api/cmsClient.js';

const monthOrder = {
  'January': 1, 'February': 2, 'March': 3, 'April': 4, 'May': 5, 'June': 6,
  'July': 7, 'August': 8, 'September': 9, 'October': 10, 'November': 11, 'December': 12
};

async function fetchNationalData(options) {
  const type = options.type || 'monthly';

  const queryParams = new URLSearchParams({
    'filter[BENE_GEO_LVL]': 'National',
    'sort[YEAR]': 'DESC',
    'sort[MONTH]': 'DESC',
    'size': '100',
    ...(type === 'yearly' && { 'filter[MONTH]': 'Year' })
  });

  const rawData = await cmsGet(queryParams);
  const num = (val) => parseInt(val, 10) || 0;

  const parsedRows = rawData.map(row => {
    const total = num(row.TOT_BENES);
    const ffs = num(row.ORGNL_MDCR_BENES);
    const ma = num(row.MA_AND_OTH_BENES);

    // Extract new Prescription Drug raw numbers
    const drugTotal = num(row.PRSCRPTN_DRUG_TOT_BENES);
    const pdp = num(row.PRSCRPTN_DRUG_PDP_BENES);
    const mapd = num(row.PRSCRPTN_DRUG_MAPD_BENES);

    return {
      year: row.YEAR,
      month: row.MONTH,
      totalEnrollees: total,
      ffsCount: ffs,
      maCount: ma,
      ffsPercent: total > 0 ? parseFloat(((ffs / total) * 100).toFixed(2)) : 0,
      maPercent: total > 0 ? parseFloat(((ma / total) * 100).toFixed(2)) : 0,

      // Add clean Drug metrics to the mapped objects
      drugTotal,
      pdpCount: pdp,
      mapdCount: mapd,
      pdpPercent: drugTotal > 0 ? parseFloat(((pdp / drugTotal) * 100).toFixed(2)) : 0,
      mapdPercent: drugTotal > 0 ? parseFloat(((mapd / drugTotal) * 100).toFixed(2)) : 0
    };
  });

  if (type === 'yearly') {
    return parsedRows.sort((a, b) => b.year - a.year);
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

  return parsedRows;
}

export default fetchNationalData;