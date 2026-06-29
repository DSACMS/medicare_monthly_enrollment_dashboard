import cmsGet from '../api/cmsClient';
import { monthOrder, getPercent } from '../utils/helpers'

async function fetchNationalData(options = {}) {
  const type = options.type || 'monthly';

  const queryParams = new URLSearchParams({
    'filter[BENE_GEO_LVL]': 'National',
    'sort[YEAR]': 'DESC',
    'sort[MONTH]': 'DESC',
    'size': '100',
    ...(type === 'yearly' && { 'filter[MONTH]': 'Year' }) // spread operator unpacks this object into the outer one
  });

  const rawData = await cmsGet(queryParams); // returns an array of data objects 
  const num = (val) => parseInt(val, 10) || 0; // ,10 (demical) numbering system, this removes the string wrapper from numbers returned by the API

  const parsedRows = rawData.map(row => { // .map takes an array of objects and takes each index (row) and transforms it
    const total = num(row.TOT_BENES); 
    const drugTotal = num(row.PRSCRPTN_DRUG_TOT_BENES); 

    return {
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
  }); // parsed rows is now an array of objects containing year, month, medicare data 

  if (type === 'yearly') {
    return parsedRows.sort((a, b) => b.year - a.year); // if it returns a negative number put a before b, elif positive put b before a, else leave alone
  }

  if (type === 'monthly') {
    return parsedRows
      .filter(row => row.month !== 'Year') // remove yearly medicare data rows
      .sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year; // string subtraction coerces into nums, no need to use parseInt
        return monthOrder[b.month] - monthOrder[a.month];
      })
      .slice(0, 12); // inclusive, exclusive. only grabs the first 12 rows 
  }

  return parsedRows;
};

export default fetchNationalData;