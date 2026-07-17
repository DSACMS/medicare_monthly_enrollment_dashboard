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
  renderEnrollmentHero,
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

    // Config for the swappable card at #medicare-enrollment-hero, keyed by
    // the button's data-dashboard-type
    const pieCardConfigs = {
      hospital: {
        data: [
          { name: 'FFS', label: 'Fee-For-Service (FFS)', value: currentYear.ffsPercent },
          { name: 'MA', label: 'Medicare Advantage (MA)', value: currentYear.maPercent },
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
      },
      drug: {
        data: [
          { name: 'PDP', label: 'Stand-Alone Prescription Drug Plans (PDP)', value: currentYear.pdpPercent },
          { name: 'MAPD', label: 'Medicare Advantage Prescription Drug Plans (MAPD)', value: currentYear.mapdPercent },
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

    const renderEnrollmentHeroCard = (type) => {
      const config = pieCardConfigs[type];
      if (!config) {
        console.warn(`renderEnrollmentHeroCard: unknown dashboard type "${type}"`);
        return;
      }

      renderEnrollmentHero('#medicare-enrollment-hero', config.data, config.total, config.options);

      document.querySelectorAll('.dashboard-type-button').forEach((btn) => {
        btn.setAttribute('aria-pressed', String(btn.dataset.dashboardType === type));
      });
    };

    setMapPanelVisibility('hospital');
    renderEnrollmentHeroCard('hospital');

    document.querySelectorAll('.dashboard-type-button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const { dashboardType } = btn.dataset;
        renderEnrollmentHeroCard(dashboardType);
        // Lets future features (state maps, tables, etc.) react to the
        // dataset swap without this handler needing to know about them.
        document.dispatchEvent(new CustomEvent('dashboard:typechange', { detail: { type: dashboardType } }));
      });
    });

    const latestMonth = sortMonthlyAscending(monthly).at(-1);
    d3.select('#medicare-enrollment-hero-footnote')
      .text(`*Total Enrollment as of ${latestMonth.month} ${latestMonth.year}`);
    d3.select('#dashboard-title-date')
      .text(`${latestMonth.month} ${latestMonth.year}`);

    renderPieChart(
      '#drug-enrollment-pie',
      pieCardConfigs.drug.data,
      pieCardConfigs.drug.total,
      pieCardConfigs.drug.options,
    );

    const roundPct = (v) => `${Math.round(v)}%`;

    const compactNum = (n) => {
      const value = Number(n) || 0;
      if (value >= 1e6) return `${(value / 1e6).toFixed(value >= 1e7 ? 1 : 2)}M`;
      if (value >= 1e3) return `${(value / 1e3).toFixed(value >= 1e4 ? 0 : 1)}K`;
      return formatNum(value);
    };

    const countCol = (label, getter) => ({
      label,
      value: (d) => compactNum(getter(d)),
      title: (d) => formatNum(getter(d)),
    });

    const hospitalAreaColumns = [
      { label: 'State', value: (d) => d.stateName },
      countCol('TOTAL', (d) => d.totalEnrollees),
      countCol('FFS', (d) => d.ffsCount),
      countCol('MA', (d) => d.maCount),
      { label: 'FFS %', value: (d) => roundPct(d.ffsPercent) },
      { label: 'MA %', value: (d) => roundPct(d.maPercent) },
    ];

    const drugAreaColumns = [
      { label: 'State', value: (d) => d.stateName },
      countCol('TOTAL', (d) => d.drugTotal),
      countCol('PDP', (d) => d.pdpCount),
      countCol('MAPD', (d) => d.mapdCount),
      { label: 'PDP %', value: (d) => roundPct(d.pdpPercent) },
      { label: 'MAPD %', value: (d) => roundPct(d.mapdPercent) },
    ];

    const hospitalCountyColumns = [
      { label: 'County', value: (d) => d.county },
      countCol('TOTAL', (d) => d.totalEnrollees),
      countCol('FFS', (d) => d.ffsCount),
      countCol('MA', (d) => d.maCount),
      { label: 'FFS %', value: (d) => roundPct(d.ffsPercent) },
      { label: 'MA %', value: (d) => roundPct(d.maPercent) },
    ];

    const drugCountyColumns = [
      { label: 'County', value: (d) => d.county },
      countCol('TOTAL', (d) => d.drugTotal),
      countCol('PDP', (d) => d.pdpCount),
      countCol('MAPD', (d) => d.mapdCount),
      { label: 'PDP %', value: (d) => roundPct(d.pdpPercent) },
      { label: 'MAPD %', value: (d) => roundPct(d.mapdPercent) },
    ];

    let allStatesRows = [];
    let selectedState = null;
    let activeDashboardType = 'hospital';

    const areaColumnsFor = (type) => (type === 'drug' ? drugAreaColumns : hospitalAreaColumns);
    const countyColumnsFor = (type) => (type === 'drug' ? drugCountyColumns : hospitalCountyColumns);
    const rowTotal = (type, d) => (type === 'drug' ? d.drugTotal : d.totalEnrollees);

    const updateScrollAffordance = (scrollEl) => {
      const wrap = scrollEl?.closest('.data-grid-scroll-wrap');
      if (!wrap) return;

      const { scrollWidth, clientWidth, scrollLeft } = scrollEl;
      const canScrollX = scrollWidth > clientWidth + 1;

      wrap.classList.toggle('is-scrollable-x', canScrollX);
      wrap.classList.toggle('is-at-start', scrollLeft <= 1);
      wrap.classList.toggle('is-at-end', scrollLeft + clientWidth >= scrollWidth - 2);

      if (canScrollX) {
        scrollEl.setAttribute('aria-description', 'Scroll horizontally to see more columns.');
      } else {
        scrollEl.removeAttribute('aria-description');
      }
    };

    const bindScrollAffordance = (scrollEl) => {
      if (!scrollEl) return;
      if (scrollEl.dataset.scrollBound === 'true') {
        updateScrollAffordance(scrollEl);
        return;
      }

      scrollEl.dataset.scrollBound = 'true';
      scrollEl.addEventListener('scroll', () => updateScrollAffordance(scrollEl), { passive: true });
      window.addEventListener('resize', () => updateScrollAffordance(scrollEl));
      updateScrollAffordance(scrollEl);
    };

    const renderAllAreasGrid = (type = activeDashboardType) => {
      const host = document.querySelector('#all-areas-table');
      if (!host || !allStatesRows.length) return;

      const rows = [...allStatesRows]
        .filter((d) => rowTotal(type, d) > 0)
        .sort((a, b) => a.stateName.localeCompare(b.stateName));

      renderTable('#all-areas-table', areaColumnsFor(type), rows);
      requestAnimationFrame(() => bindScrollAffordance(host));
    };

    const renderCountyGrid = async (stateAbbr, stateName, type = activeDashboardType) => {
      const host = document.querySelector('#county-table');
      const titleEl = document.querySelector('#county-grid-title');
      if (!host) return;

      if (!stateAbbr) {
        if (titleEl) titleEl.textContent = 'Select a state';
        host.innerHTML = '<p class="data-grid-placeholder">Select a state on the map or from the dropdown to view county enrollment.</p>';
        updateScrollAffordance(host);
        return;
      }

      if (titleEl) titleEl.textContent = stateName || stateAbbr;
      host.innerHTML = '<p class="data-grid-placeholder">Loading counties…</p>';

      try {
        const counties = await requestDataset('countyEnrollment', { state: stateAbbr });
        const rows = counties
          .filter((d) => rowTotal(type, d) > 0)
          .sort((a, b) => a.county.localeCompare(b.county));

        renderTable('#county-table', countyColumnsFor(type), rows);
        requestAnimationFrame(() => bindScrollAffordance(host));
      } catch {
        host.innerHTML = '<p class="data-grid-placeholder" role="alert">County data could not be loaded.</p>';
      }
    };

    const loadStateMap = async () => {
      const recentRows = await requestDataset('stateEnrollment', { state: 'NY', type: 'monthly' });
      const latest = recentRows[0];
      allStatesRows = await requestDataset('allStates', {
        year: latest.year,
        month: latest.month,
      });

      renderAllAreasGrid('hospital');

      renderStateMap('#medicare-enrollment-state-map', allStatesRows, {
        title: 'Medicare Advantage enrollment by state',
        comboBoxSelector: '#medicare-state-selector',
      });

      renderStateMap('#medicare-mapd-state-map', allStatesRows, {
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

    document.addEventListener('dashboard:typechange', (event) => {
      const { type } = event.detail || {};
      if (!type) return;
      activeDashboardType = type;
      setMapPanelVisibility(type);
      renderAllAreasGrid(type);
      if (selectedState) {
        renderCountyGrid(selectedState.state, selectedState.stateName, type);
      }
    });

    document.addEventListener('dashboard:statechange', (event) => {
      const { state, stateName } = event.detail || {};
      if (!state) return;
      selectedState = { state, stateName };
      renderCountyGrid(state, stateName, activeDashboardType);
    });

    await loadStateMap();
  } catch (error) {
    throw new Error(`Failed to load national data: ${error.message}`);
  }
}

init();
