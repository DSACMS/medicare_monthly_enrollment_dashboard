const BASE = "https://data.cms.gov/data-api/v1/dataset/d7fabe1e-d19b-4333-9eff-e80e0643f2fd/data";
const monthOrder = { January:1,February:2,March:3,April:4,May:5,June:6,July:7,August:8,September:9,October:10,November:11,December:12 };
const toInt = (value) => parseInt(value, 10) || 0;
const toPercent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const formatNumber = (value) => value.toLocaleString();

const columns = [
  { label: "County", value: (row) => row.county },
  { label: "TOTAL", value: (row) => formatNumber(row.total) },
  { label: "PDP", value: (row) => formatNumber(row.pdp) },
  { label: "MAPD", value: (row) => formatNumber(row.mapd) },
  { label: "PDP %", value: (row) => `${row.pdpPercent}%` },
  { label: "MAPD %", value: (row) => `${row.mapdPercent}%` },
];

export async function renderCountyCurrentYearDrugTable(host, state) {
  const response = await fetch(`${BASE}?${new URLSearchParams({
    "filter[BENE_GEO_LVL]": "County",
    "filter[BENE_STATE_ABRVTN]": state,
    "sort[YEAR]": "DESC",
    "sort[MONTH]": "DESC",
    size: "3000",
    column: "BENE_COUNTY_DESC,BENE_STATE_DESC,YEAR,MONTH,PRSCRPTN_DRUG_TOT_BENES,PRSCRPTN_DRUG_PDP_BENES,PRSCRPTN_DRUG_MAPD_BENES",
  })}`);
  const rawRows = await response.json();

  const rows = rawRows
    .map((row) => {
      const total = toInt(row.PRSCRPTN_DRUG_TOT_BENES);
      const pdp = toInt(row.PRSCRPTN_DRUG_PDP_BENES);
      const mapd = toInt(row.PRSCRPTN_DRUG_MAPD_BENES);
      return {
        county: row.BENE_COUNTY_DESC,
        stateName: row.BENE_STATE_DESC,
        year: row.YEAR,
        month: row.MONTH,
        total,
        pdp,
        mapd,
        pdpPercent: toPercent(pdp, total),
        mapdPercent: toPercent(mapd, total),
      };
    })
    .filter((row) => row.month !== "Year");

  const latestYear = rows.reduce((max, row) => (row.year > max ? row.year : max), "0");
  const inYear = rows.filter((row) => row.year === latestYear);
  const latestMonth = inYear.reduce(
    (max, row) => (monthOrder[row.month] > monthOrder[max] ? row.month : max),
    inYear[0]?.month
  );
  const data = inYear
    .filter((row) => row.month === latestMonth)
    .sort((a, b) => a.county.localeCompare(b.county));

  const table = d3.select(host).html("").append("table");
  table.append("thead").append("tr").selectAll("th").data(columns).enter().append("th").text((col) => col.label);
  table.append("tbody").selectAll("tr").data(data).enter().append("tr")
    .selectAll("td").data((row) => columns.map((col) => col.value(row))).enter().append("td").text((cell) => cell);

  return data;
}
