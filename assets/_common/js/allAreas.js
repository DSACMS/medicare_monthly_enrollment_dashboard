import * as d3 from 'd3';
import requestDataset from '../../../src/router';
import renderTable from '../tables/renderTable';
import { getCssVar, sortMonthlyAscending } from '../charts/utils';
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
  { label: 'Prescription Drug Enrollment Total', value: (d) => formatNum(d.drugTotal) },
  {
    label: 'Stand-Alone Prescription Drug Plans (PDP)',
    value: (d) => `${formatNum(d.pdpCount)} (${d.pdpPercent}%)`,
  },
  {
    label: 'Medicare Advantage Prescription Drug Plans (MAPD)',
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

    // Config for the swappable card at #medicare-enrollment-pie, keyed by
    // the button's data-dashboard-type
    const pieCardConfigs = {
      hospital: {
        data: [
          { name: 'FFS', value: currentYear.ffsPercent },
          { name: 'MA', value: currentYear.maPercent },
        ],
        total: currentYear.totalEnrollees,
        options: {
          colors: [
            getCssVar('--pie-medicare-ffs-color', '#961d56'),
            getCssVar('--pie-medicare-ma-color', '#7928c9'),
          ],
          title: `Medicare enrollment by program type, ${currentYear.year}`,
          tableColumns: [
            { label: 'Program', value: (d) => d.name },
            { label: 'Percent of total', value: (d) => `${Math.round(d.value)}%` },
          ],
        },
        legend: [
          { swatchClass: 'pie-legend__swatch--ma', label: 'Medicare Advantage (MA)' },
          { swatchClass: 'pie-legend__swatch--ffs', label: 'Fee-For-Service (FFS)' },
        ],
      },
      drug: {
        data: [
          { name: 'PDP', value: currentYear.pdpPercent },
          { name: 'MAPD', value: currentYear.mapdPercent },
        ],
        total: currentYear.drugTotal,
        options: {
          colors: [
            getCssVar('--pie-drug-pdp-color', '#89cc9e'),
            getCssVar('--pie-drug-mapd-color', '#009ad0'),
          ],
          title: `Medicare Prescription Drug enrollment by plan type, ${currentYear.year}`,
          tableColumns: [
            { label: 'Plan type', value: (d) => d.name },
            { label: 'Percent of total', value: (d) => `${Math.round(d.value)}%` },
          ],
        },
        legend: [
          { swatchClass: 'pie-legend__swatch--mapd', label: 'Medicare Advantage Prescription Drug Plans (MAPD)' },
          { swatchClass: 'pie-legend__swatch--pdp', label: 'Stand-Alone Prescription Drug Plans (PDP)' },
        ],
      },
    };

    const mapPanels = Array.from(document.querySelectorAll('.dashboard-map-panel'));

    const setMapPanelVisibility = (type) => {
      mapPanels.forEach((panel) => {
        const isActive = panel.dataset.mapDashboardType === type;
        panel.classList.toggle('is-active', isActive);
        panel.hidden = !isActive;
        panel.setAttribute('aria-hidden', String(!isActive));
      });
    };

    const renderEnrollmentPieCard = (type) => {
      const config = pieCardConfigs[type];
      if (!config) {
        console.warn(`renderEnrollmentPieCard: unknown dashboard type "${type}"`);
        return;
      }

      renderPieChart('#medicare-enrollment-pie', config.data, config.total, config.options);

      const legendList = d3.select('#medicare-enrollment-pie-legend');
      legendList.html('');
      config.legend.forEach((item) => {
        const li = legendList.append('li').attr('class', 'pie-legend__item');
        li.append('span').attr('class', `pie-legend__swatch ${item.swatchClass}`);
        li.append('span').text(item.label);
      });

      document.querySelectorAll('.dashboard-type-button').forEach((btn) => {
        btn.classList.toggle('usa-button--active', btn.dataset.dashboardType === type);
      });
    };

    setMapPanelVisibility('hospital');
    renderEnrollmentPieCard('hospital');

    document.addEventListener('dashboard:typechange', (event) => {
      const { type } = event.detail || {};
      if (type) {
        setMapPanelVisibility(type);
      }
    });

    document.querySelectorAll('.dashboard-type-button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const { dashboardType } = btn.dataset;
        renderEnrollmentPieCard(dashboardType);
        // Lets future features (state maps, tables, etc.) react to the
        // dataset swap without this handler needing to know about them.
        document.dispatchEvent(new CustomEvent('dashboard:typechange', { detail: { type: dashboardType } }));
      });
    });

    const latestMonth = sortMonthlyAscending(monthly).at(-1);
    d3.select('#medicare-enrollment-pie-legend-label')
      .text(`*Total Enrollment as of ${latestMonth.month} ${latestMonth.year}`);
    d3.select('#dashboard-title-date')
      .text(`${latestMonth.month} ${latestMonth.year}`);

    renderPieChart(
      '#drug-enrollment-pie',
      pieCardConfigs.drug.data,
      pieCardConfigs.drug.total,
      pieCardConfigs.drug.options,
    );

    const loadStateMap = async () => {
      const recentRows = await requestDataset('stateEnrollment', { state: 'NY', type: 'monthly' });
      const latest = recentRows[0];
      const allStates = await requestDataset('allStates', {
        year: latest.year,
        month: latest.month,
      });

      renderStateMap('#medicare-enrollment-state-map', allStates, {
        title: 'Medicare Advantage enrollment by state',
        comboBoxSelector: '#medicare-state-selector',
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
        comboBoxSelector: '#drug-state-selector',
      });
    };

    await loadStateMap();
  } catch (error) {
    throw new Error(`Failed to load national data: ${error.message}`);
  }
}

init();
