import { renderTable } from "../renderTable.js";

const formatNumber = (value) => value.toLocaleString();
const round = (value) => Math.round(value);

const columns = [
  { label: "Year", value: (row) => row.year },
  { label: "TOTAL", value: (row) => formatNumber(row.drugTotal) },
  { label: "PDP", value: (row) => formatNumber(row.pdpCount) },
  { label: "MAPD", value: (row) => formatNumber(row.mapdCount) },
  { label: "PDP %", value: (row) => `${round(row.pdpPercent)}%` },
  { label: "MAPD %", value: (row) => `${round(row.mapdPercent)}%` },
];

export async function renderNationalYearlyDrugTable(host) {
  const response = await fetch(new URL("../../data/national.json", import.meta.url));
  const { yearly } = await response.json();
  yearly.sort((a, b) => a.year - b.year);
  renderTable(host, columns, yearly);
}
