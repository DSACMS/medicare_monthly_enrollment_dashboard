import { requestDataset } from "../../../src/router.js";
import { renderTable } from "../renderTable.js";

const formatNumber = (value) => value.toLocaleString();
const round = (value) => Math.round(value);

const columns = [
  { label: "Year", value: (row) => row.year },
  { label: "Month", value: (row) => row.month },
  { label: "TOTAL", value: (row) => formatNumber(row.drugTotal) },
  { label: "PDP", value: (row) => formatNumber(row.pdpCount) },
  { label: "MAPD", value: (row) => formatNumber(row.mapdCount) },
  { label: "PDP %", value: (row) => `${round(row.pdpPercent)}%` },
  { label: "MAPD %", value: (row) => `${round(row.mapdPercent)}%` },
];

export async function renderNationalMonthlyDrugTable(host) {
  const data = await requestDataset("nationalEnrollment", { type: "monthly" });
  data.reverse();
  renderTable(host, columns, data);
}
