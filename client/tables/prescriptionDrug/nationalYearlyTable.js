const BASE = "https://data.cms.gov/data-api/v1/dataset/d7fabe1e-d19b-4333-9eff-e80e0643f2fd/data";
const toInt = (value) => parseInt(value, 10) || 0;
const toPercent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const formatNumber = (value) => value.toLocaleString();

const columns = [
  { label: "Year", value: (row) => row.year },
  { label: "TOTAL", value: (row) => formatNumber(row.total) },
  { label: "PDP", value: (row) => formatNumber(row.pdp) },
  { label: "MAPD", value: (row) => formatNumber(row.mapd) },
  { label: "PDP %", value: (row) => `${row.pdpPercent}%` },
  { label: "MAPD %", value: (row) => `${row.mapdPercent}%` },
];

export async function renderNationalYearlyDrugTable(host) {
  const response = await fetch(`${BASE}?${new URLSearchParams({
    "filter[BENE_GEO_LVL]": "National",
    "filter[MONTH]": "Year",
    size: "50",
    column: "YEAR,PRSCRPTN_DRUG_TOT_BENES,PRSCRPTN_DRUG_PDP_BENES,PRSCRPTN_DRUG_MAPD_BENES",
  })}`);
  const rawRows = await response.json();

  const data = rawRows
    .map((row) => {
      const total = toInt(row.PRSCRPTN_DRUG_TOT_BENES);
      const pdp = toInt(row.PRSCRPTN_DRUG_PDP_BENES);
      const mapd = toInt(row.PRSCRPTN_DRUG_MAPD_BENES);
      return {
        year: row.YEAR,
        total,
        pdp,
        mapd,
        pdpPercent: toPercent(pdp, total),
        mapdPercent: toPercent(mapd, total),
      };
    })
    .sort((a, b) => a.year - b.year);

  const table = d3.select(host).html("").append("table");
  table.append("thead").append("tr").selectAll("th").data(columns).enter().append("th").text((col) => col.label);
  table.append("tbody").selectAll("tr").data(data).enter().append("tr")
    .selectAll("td").data((row) => columns.map((col) => col.value(row))).enter().append("td").text((cell) => cell);
}
