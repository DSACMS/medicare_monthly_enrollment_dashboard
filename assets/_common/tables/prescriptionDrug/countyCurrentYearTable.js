import { renderTable } from "../renderTable.js";
import { requestDataset } from "../../../src/router.js";

const formatNumber = (value) => value.toLocaleString();
const round = (value) => Math.round(value);

const columns = [
  { label: "County", value: (row) => row.county },
  { label: "TOTAL", value: (row) => formatNumber(row.drugTotal) },
  { label: "PDP", value: (row) => formatNumber(row.pdpCount) },
  { label: "MAPD", value: (row) => formatNumber(row.mapdCount) },
  { label: "PDP %", value: (row) => `${round(row.pdpPercent)}%` },
  { label: "MAPD %", value: (row) => `${round(row.mapdPercent)}%` },
];

export async function renderCountyCurrentYearDrugTable(host, state) {
  const data = await requestDataset("countyEnrollment", { state });
  data.sort((a, b) => a.county.localeCompare(b.county));
  renderTable(host, columns, data);
}
