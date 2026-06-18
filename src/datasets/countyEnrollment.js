import { cmsGet } from "../api/cmsClient.js";

const monthOrder = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
};

export async function fetchCountiesForState(options = {}) {
  const state = options.state;

  if (!state) {
    throw new Error("fetchCountiesForState requires options.state (e.g. 'NY')");
  }

  const columns = [
    "BENE_STATE_ABRVTN",
    "BENE_STATE_DESC",
    "BENE_COUNTY_DESC",
    "BENE_FIPS_CD",
    "YEAR",
    "MONTH",
    "TOT_BENES",
    "ORGNL_MDCR_BENES",
    "MA_AND_OTH_BENES",
    "PRSCRPTN_DRUG_TOT_BENES",
    "PRSCRPTN_DRUG_PDP_BENES",
    "PRSCRPTN_DRUG_MAPD_BENES",
  ];

  const queryParams = new URLSearchParams({
    "filter[BENE_GEO_LVL]": "County",
    "filter[BENE_STATE_ABRVTN]": state,
    "sort[YEAR]": "DESC",
    "sort[MONTH]": "DESC",
    column: columns.join(","),
    size: "5000",
  });

  const rawData = await cmsGet(queryParams);
  const num = (val) => parseInt(val, 10) || 0;

  const rows = rawData
    .map((row) => {
      const total = num(row.TOT_BENES);
      const ffs = num(row.ORGNL_MDCR_BENES);
      const ma = num(row.MA_AND_OTH_BENES);
      const drugTotal = num(row.PRSCRPTN_DRUG_TOT_BENES);
      const pdp = num(row.PRSCRPTN_DRUG_PDP_BENES);
      const mapd = num(row.PRSCRPTN_DRUG_MAPD_BENES);

      return {
        state: row.BENE_STATE_ABRVTN,
        stateName: row.BENE_STATE_DESC,
        county: row.BENE_COUNTY_DESC,
        fips: row.BENE_FIPS_CD,
        year: row.YEAR,
        month: row.MONTH,
        totalEnrollees: total,
        ffsCount: ffs,
        maCount: ma,
        ffsPercent: total > 0 ? parseFloat(((ffs / total) * 100).toFixed(2)) : 0,
        maPercent: total > 0 ? parseFloat(((ma / total) * 100).toFixed(2)) : 0,
        drugTotal,
        pdpCount: pdp,
        mapdCount: mapd,
        pdpPercent: drugTotal > 0 ? parseFloat(((pdp / drugTotal) * 100).toFixed(2)) : 0,
        mapdPercent: drugTotal > 0 ? parseFloat(((mapd / drugTotal) * 100).toFixed(2)) : 0,
      };
    })
    .filter((row) => row.month !== "Year");

  const latestYear = rows.reduce((max, row) => (row.year > max ? row.year : max), "0");
  const inYear = rows.filter((row) => row.year === latestYear);
  const latestMonth = inYear.reduce(
    (max, row) => (monthOrder[row.month] > monthOrder[max] ? row.month : max),
    inYear[0]?.month
  );

  return inYear.filter((row) => row.month === latestMonth);
}
