import cmsGet from '../api/cmsClient';
import { getPercent } from '../utils/helpers'

async function fetchCountiesForState(options = {}) {
  const {state} = options;

  if (!state) {
    throw new Error('fetchCountiesForState requires options.state (e.g. \'NY\')');
  }

  const columns = [
    'BENE_STATE_ABRVTN',
    'BENE_STATE_DESC',
    'BENE_COUNTY_DESC',
    'BENE_FIPS_CD',
    'YEAR',
    'MONTH',
    'TOT_BENES',
    'ORGNL_MDCR_BENES',
    'MA_AND_OTH_BENES',
    'PRSCRPTN_DRUG_TOT_BENES',
    'PRSCRPTN_DRUG_PDP_BENES',
    'PRSCRPTN_DRUG_MAPD_BENES',
  ];

  const queryParams = new URLSearchParams({
    'filter[BENE_GEO_LVL]': 'County',
    'filter[BENE_STATE_ABRVTN]': state,
    'sort[YEAR]': 'DESC',
    'sort[MONTH]': 'DESC',
    column: columns.join(','),
    size: '5000',
  });

  const rawData = await cmsGet(queryParams);
  const data = rawData.filter((row) => row.MONTH !== 'Year'); // remove the year option from the array, filter keeps the rest of the data array in its original relative sorted position

  const latestYear = data[0].YEAR; // pull the most recent year since the query params are sorted descending
  const latestMonth = data[0].MONTH; // pull the most recent month since the query params are sorted descending

  const num = (val) => parseInt(val, 10) || 0;

  return data
    .filter((row) => row.YEAR === latestYear && row.MONTH === latestMonth) // 
    .map((row) => {
      const total = num(row.TOT_BENES);
      const drugTotal = num(row.PRSCRPTN_DRUG_TOT_BENES);

      return {
        state: row.BENE_STATE_ABRVTN,
        stateName: row.BENE_STATE_DESC,
        county: row.BENE_COUNTY_DESC,
        fips: row.BENE_FIPS_CD,
        year: row.YEAR,
        month: row.MONTH,
        totalEnrollees: total,
        ffsCount: num(row.ORGNL_MDCR_BENES), 
        maCount: num(row.MA_AND_OTH_BENES), 
        ffsPercent: getPercent(num(row.ORGNL_MDCR_BENES), total),
        maPercent: getPercent(num(row.MA_AND_OTH_BENES), total),
        drugTotal,
        pdpCount: num(row.PRSCRPTN_DRUG_PDP_BENES), 
        mapdCount: num(row.PRSCRPTN_DRUG_MAPD_BENES), 
        pdpPercent: getPercent(num(row.PRSCRPTN_DRUG_PDP_BENES), drugTotal),
        mapdPercent: getPercent(num(row.PRSCRPTN_DRUG_MAPD_BENES), drugTotal)
      };
    })
}

export default fetchCountiesForState;