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
  renderPieChart,
  renderStateMap,
  mergeLatestMonthlyIntoYearly,
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

    const yearlyWithLatest = mergeLatestMonthlyIntoYearly(yearly, monthly);

    renderTable('#medicare-table', columns, yearlyWithLatest);

    renderHospitalYearlyLineChart('#national-hospital-yearly-line', yearlyWithLatest);
    renderHospitalYearlyStackedBarChart('#national-hospital-yearly-bar', yearlyWithLatest);
    renderDrugYearlyLineChart('#national-drug-yearly-line', yearlyWithLatest);
    renderDrugYearlyStackedBarChart('#national-drug-yearly-bar', yearlyWithLatest);

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
    // currentYear assumes `yearlyWithLatest` has the latest year appearing first.
    const currentYear = yearlyWithLatest[0];

    const medicareEnrollmentPieData = [
      { name: 'FFS', value: currentYear.ffsPercent },
      { name: 'MA', value: currentYear.maPercent },
    ];
    renderPieChart(
      '#medicare-enrollment-pie',
      medicareEnrollmentPieData,
      currentYear.totalEnrollees,
      {
        colors: ['#961d56', '#7928c9'],
        title: `Medicare enrollment by program type, ${currentYear.year}`,
        tableColumns: [
          { label: 'Program', value: (d) => d.name },
          { label: 'Percent of total', value: (d) => `${Math.round(d.value)}%` },
        ],
      },
    );

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

    const loadStateMap = async () => {
      const recentRows = await requestDataset('stateEnrollment', { state: 'NY', type: 'monthly' });
      const latest = recentRows[0];
      const allStates = await requestDataset('allStates', {
        year: latest.year,
        month: latest.month,
      });

      renderStateMap('#medicare-enrollment-state-map', allStates, {
        title: 'Medicare Advantage enrollment by state',
      });

      renderStateMap('#medicare-mapd-state-map', allStates, {
        metricLabel: 'MAPD',
        metricPercent: (d) => d.mapdPercent,
        metricCount: (d) => d.mapdCount,
        breakpoints: [21, 40, 60, 79],
        colors: ['#f4f1a3', '#75c3a3', '#3d8b6f', '#aac4e8', '#3a5fa0'],
        comparisonLabel: 'PDP',
        comparisonPercent: (d) => d.pdpPercent,
        comparisonCount: (d) => d.pdpCount,
      });
    };

    await loadStateMap();
  } catch (error) {
    throw new Error(`Failed to load national data: ${error.message}`);
  }
}

init();
