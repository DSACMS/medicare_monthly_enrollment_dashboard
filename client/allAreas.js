import { renderTable } from './tables/renderTable.js';
import {
  renderHospitalYearlyLineChart,
  renderHospitalMonthlyLineChart,
  renderHospitalYearlyStackedBarChart,
  renderHospitalMonthlyStackedBarChart,
  renderDrugYearlyLineChart,
  renderDrugMonthlyLineChart,
  renderDrugYearlyStackedBarChart,
  renderDrugMonthlyStackedBarChart,
} from './charts/index.js';

const formatNum = d3.format(",");

const columns = [
  { label: "Year", value: (d) => d.year },
  { label: "Total Enrollees", value: (d) => formatNum(d.totalEnrollees) },
  {
    label: "Fee-For-Service (FFS)",
    value: (d) => `${formatNum(d.ffsCount)} (${d.ffsPercent}%)`,
  },
  {
    label: "Medicare Advantage (MA)",
    value: (d) => `${formatNum(d.maCount)} (${d.maPercent}%)`,
  },
  { label: "Part D Total", value: (d) => formatNum(d.drugTotal) },
  {
    label: "Standalone PDP",
    value: (d) => `${formatNum(d.pdpCount)} (${d.pdpPercent}%)`,
  },
  {
    label: "MA-PD Bundled",
    value: (d) => `${formatNum(d.mapdCount)} (${d.mapdPercent}%)`,
  },
];

async function init() {
  try {
    const national = await fetch('/client/data/national.json').then(r => r.json());
    const { yearly, monthly } = national;

    renderTable('#medicare-table', columns, yearly);

    renderHospitalYearlyLineChart('#national-hospital-yearly-line', yearly);
    renderHospitalYearlyStackedBarChart('#national-hospital-yearly-bar', yearly);
    renderDrugYearlyLineChart('#national-drug-yearly-line', yearly);
    renderDrugYearlyStackedBarChart('#national-drug-yearly-bar', yearly);

    renderHospitalMonthlyLineChart('#national-hospital-monthly-line', monthly);
    renderHospitalMonthlyStackedBarChart('#national-hospital-monthly-bar', monthly);
    renderDrugMonthlyLineChart('#national-drug-monthly-line', monthly);
    renderDrugMonthlyStackedBarChart('#national-drug-monthly-bar', monthly);
  } catch (error) {
    console.error('Failed to load national data:', error.message);
  }
}

init();
