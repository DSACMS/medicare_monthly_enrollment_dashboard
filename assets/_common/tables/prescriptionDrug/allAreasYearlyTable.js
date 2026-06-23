import renderTable from '../renderTable';
import requestDataset from '../../../../src/router';

const formatNumber = (value) => value.toLocaleString();
const round = (value) => Math.round(value);

const columns = [
  { label: 'Year', value: (row) => row.year },
  { label: 'TOTAL', value: (row) => formatNumber(row.drugTotal) },
  { label: 'PDP', value: (row) => formatNumber(row.pdpCount) },
  { label: 'MAPD', value: (row) => formatNumber(row.mapdCount) },
  { label: 'PDP %', value: (row) => `${round(row.pdpPercent)}%` },
  { label: 'MAPD %', value: (row) => `${round(row.mapdPercent)}%` },
];

async function renderNationalYearlyDrugTable(host) {
  const yearly = await requestDataset('nationalEnrollment', { type: 'yearly' });
  renderTable(host, columns, yearly);
}

export default renderNationalYearlyDrugTable;
