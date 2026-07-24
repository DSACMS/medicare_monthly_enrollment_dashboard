import cmsGet from '../api/cmsClient';
import { monthOrder, getPercent } from '../utils/helpers'

const COUNTY_COLUMNS = [
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

const num = (val) => parseInt(val, 10) || 0;

function parseCountyRow(row) {
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
    mapdPercent: getPercent(num(row.PRSCRPTN_DRUG_MAPD_BENES), drugTotal),
  };
}

async function fetchCountiesForState(options = {}) {
  const { state } = options;

  if (!state) {
    throw new Error('fetchCountiesForState requires options.state (e.g. \'NY\')');
  }

  const queryParams = new URLSearchParams({
    'filter[BENE_GEO_LVL]': 'County',
    'filter[BENE_STATE_ABRVTN]': state,
    'sort[YEAR]': 'DESC',
    'sort[MONTH]': 'DESC',
    column: COUNTY_COLUMNS.join(','),
    size: '5000',
  });

  const rawData = await cmsGet(queryParams);
  const data = rawData.filter((row) => row.MONTH !== 'Year');

  const latestYear = data[0].YEAR;
  const latestMonth = data[0].MONTH;

  return data
    .filter((row) => row.YEAR === latestYear && row.MONTH === latestMonth)
    .map(parseCountyRow);
}

export async function fetchCountyEnrollment(options = {}) {
  const { state, county } = options;
  const type = options.type || 'monthly';

  if (!state || !county) {
    throw new Error('fetchCountyEnrollment requires options.state and options.county (e.g. { state: \'NY\', county: \'Kings\' })');
  }

  const queryParams = new URLSearchParams({
    'filter[BENE_GEO_LVL]': 'County',
    'filter[BENE_STATE_ABRVTN]': state,
    'filter[BENE_COUNTY_DESC]': county,
    'sort[YEAR]': 'DESC',
    'sort[MONTH]': 'DESC',
    column: COUNTY_COLUMNS.join(','),
    size: '600',
  });

  const rawData = await cmsGet(queryParams);
  const parsedRows = rawData.map(parseCountyRow);

  if (type === 'yearly') {
    return parsedRows
      .filter((row) => row.month === 'Year')
      .sort((a, b) => b.year - a.year);
  }

  if (type === 'monthly') {
    return parsedRows
      .filter((row) => row.month !== 'Year')
      .sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return monthOrder[b.month] - monthOrder[a.month];
      })
      .slice(0, 12);
  }

  return parsedRows;
}

export default fetchCountiesForState;
