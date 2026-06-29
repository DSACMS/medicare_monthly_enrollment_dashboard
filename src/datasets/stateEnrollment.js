import cmsGet from '../api/cmsClient';
import { monthOrder, getPercent } from '../utils/helpers'

// All 50 states for a single period — used for the All Areas map and country-by-state table
export async function fetchAllStates(options = {}) {
  const year = options.year || '2024';
  const month = options.month || 'Year';

  const queryParams = new URLSearchParams({
    'filter[BENE_GEO_LVL]': 'State',
    'filter[YEAR]': year,
    'filter[MONTH]': month,
    size: '60',
  });

  const rawData = await cmsGet(queryParams);
  const num = (val) => parseInt(val, 10) || 0;

  return rawData.map((row) => {
    const total = num(row.TOT_BENES);
    const drugTotal = num(row.PRSCRPTN_DRUG_TOT_BENES);

    return {
      state: row.BENE_STATE_ABRVTN,
      stateName: row.BENE_STATE_DESC,
      year,
      month,
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
  });
}

// Trend data for a single state — used for Counties View yearly and 12-month trend charts
export async function fetchStateEnrollment(options = {}) {
  const {state} = options; 
  const type = options.type || 'monthly';

  if (!state) {
    throw new Error('fetchCountiesForState requires options.state (e.g. \'NY\')');
  }

  const queryParams = new URLSearchParams({
    'filter[BENE_GEO_LVL]': 'State',
    'filter[BENE_STATE_ABRVTN]': state,
    'sort[YEAR]': 'DESC',
    'sort[MONTH]': 'DESC',
    size: '100',
  });

  const rawData = await cmsGet(queryParams);
  const num = (val) => parseInt(val, 10) || 0;

  const parsedRows = rawData.map((row) => {
    const total = num(row.TOT_BENES);
    const drugTotal = num(row.PRSCRPTN_DRUG_TOT_BENES);

    return {
      state: row.BENE_STATE_ABRVTN,
      stateName: row.BENE_STATE_DESC,
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
  });

  // yearly already calculates averages 
  if (type === 'yearly') {
      const yearlyRows = parsedRows.filter(row => row.month === 'Year');
      return yearlyRows.sort((a, b) => b.year - a.year);
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
