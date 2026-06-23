import * as d3 from 'd3';
import requestDataset from '../../../src/router';
import renderTable from '../tables/renderTable';
import {
  renderHospitalYearlyLineChart,
  renderHospitalMonthlyLineChart,
  renderHospitalYearlyStackedBarChart,
  renderHospitalMonthlyStackedBarChart,
  renderDrugYearlyLineChart,
  renderDrugMonthlyLineChart,
  renderDrugYearlyStackedBarChart,
  renderDrugMonthlyStackedBarChart,
  renderPieChart
} from '../charts/index';

const formatNum = d3.format(',');

const columns = [
  { label: 'Year', value: (d) => d.year },
  { label: 'Total Enrollees', value: (d) => formatNum(d.totalEnrollees) },
  {
    label: 'Fee-For-Service (FFS)',
    value: (d) => `${formatNum(d.ffsCount)} (${d.ffsPercent}%)`,
  },
  {
    label: 'Medicare Advantage (MA)',
    value: (d) => `${formatNum(d.maCount)} (${d.maPercent}%)`,
  },
  { label: 'Part D Total', value: (d) => formatNum(d.drugTotal) },
  {
    label: 'Standalone PDP',
    value: (d) => `${formatNum(d.pdpCount)} (${d.pdpPercent}%)`,
  },
  {
    label: 'MA-PD Bundled',
    value: (d) => `${formatNum(d.mapdCount)} (${d.mapdPercent}%)`,
  },
];

async function init() {
  try {
    const [yearly, monthly] = await Promise.all([
      requestDataset('nationalEnrollment', { type: 'yearly' }),
      requestDataset('nationalEnrollment', { type: 'monthly' }),
    ]);

    renderTable('#medicare-table', columns, yearly);

    renderHospitalYearlyLineChart('#national-hospital-yearly-line', yearly);
    renderHospitalYearlyStackedBarChart('#national-hospital-yearly-bar', yearly);
    renderDrugYearlyLineChart('#national-drug-yearly-line', yearly);
    renderDrugYearlyStackedBarChart('#national-drug-yearly-bar', yearly);

    renderHospitalMonthlyLineChart('#national-hospital-monthly-line', monthly);
    renderHospitalMonthlyStackedBarChart('#national-hospital-monthly-bar', monthly);
    renderDrugMonthlyLineChart('#national-drug-monthly-line', monthly);
    renderDrugMonthlyStackedBarChart('#national-drug-monthly-bar', monthly);

    // IMPORTANT: keep MA/MA-PD as the SECOND item in each array below.
    // pieChart.js renders index 1 on the left side of the donut (both the
    // arc and its label). If you reorder these or add a third Medicare
    // program type, double-check pieChart.js's xPosition logic still does
    // what you expect.
    //
    // currentYear assumes `yearly` is sorted newest-first
    const currentYear = yearly[0];
 
    const medicareEnrollmentPieData = [
      { name: 'FFS', value: currentYear.ffsPercent },
      { name: 'MA', value: currentYear.maPercent }, 
    ];
    renderPieChart('#medicare-enrollment-pie', medicareEnrollmentPieData, currentYear.totalEnrollees, {
      colors: ['#961d56', '#7928c9'],
      title: `Medicare enrollment by program type, ${currentYear.year}`,
      tableColumns: [
        { label: 'Program', value: (d) => d.name },
        { label: 'Percent of total', value: (d) => `${Math.round(d.value)}%` },
      ],
    });
 
    const drugEnrollmentPieData = [
      { name: 'PDP', value: currentYear.pdpPercent },
      { name: 'MA-PD', value: currentYear.mapdPercent },
    ];
    renderPieChart('#drug-enrollment-pie', drugEnrollmentPieData, currentYear.drugTotal, {
      colors: ['#89cc9e', '#009ad0'],
      title: `Medicare Part D enrollment by plan type, ${currentYear.year}`,
      tableColumns: [
        { label: 'Plan type', value: (d) => d.name },
        { label: 'Percent of total', value: (d) => `${Math.round(d.value)}%` },
      ],
    });

  } catch (error) {
    console.error('Failed to load national data:', error.message);
  }
}

init();
