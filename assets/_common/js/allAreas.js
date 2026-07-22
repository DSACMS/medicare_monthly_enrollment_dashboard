import * as d3 from 'd3';
import requestDataset from '../../../src/router';
import renderTable from '../tables/renderTable';
import usStates from '../../../_data/usStates.json';
import { getCssVar, sortMonthlyAscending, observeResize } from '../charts/utils';
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

// API's "State" geo level includes territories (e.g. Puerto Rico)
// Can't be handed off to the map -> grid/drawer render them disabled w/ warning label
const mappableStateNames = new Set(usStates);

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

    const barLegend = { legendSelector: '#national-trend-bar-legend' };
    const lineLegend = { legendSelector: '#national-trend-line-legend' };

    const nationalTrendRenderers = {
      hospital: {
        yearly: {
          line: () => renderHospitalYearlyLineChart('#national-trend-line', yearlyWithLatest, lineLegend),
          bar: () => renderHospitalYearlyStackedBarChart('#national-trend-bar', yearlyWithLatest, barLegend),
        },
        monthly: {
          line: () => renderHospitalMonthlyLineChart('#national-trend-line', monthly, lineLegend),
          bar: () => renderHospitalMonthlyStackedBarChart('#national-trend-bar', monthly, barLegend),
        },
      },
      drug: {
        yearly: {
          line: () => renderDrugYearlyLineChart('#national-trend-line', yearlyWithLatest, lineLegend),
          bar: () => renderDrugYearlyStackedBarChart('#national-trend-bar', yearlyWithLatest, barLegend),
        },
        monthly: {
          line: () => renderDrugMonthlyLineChart('#national-trend-line', monthly, lineLegend),
          bar: () => renderDrugMonthlyStackedBarChart('#national-trend-bar', monthly, barLegend),
        },
      },
    };

    let activeTrendType = 'hospital';
    let activeTrendRange = 'yearly';

    const renderNationalTrend = () => {
      const renderers = nationalTrendRenderers[activeTrendType][activeTrendRange];
      renderers.line();
      renderers.bar();
      d3.select('#national-trend-sub')
        .text(`National · ${activeTrendType === 'drug' ? 'Prescription Drug' : 'Hospital / Medical'}`);
    };

    const trendYears = yearlyWithLatest.map((d) => Number(d.year));
    const yearlyRangeTab = document.querySelector('#national-range-tabs [data-range="yearly"]');
    if (yearlyRangeTab && trendYears.length) {
      yearlyRangeTab.textContent = `${d3.min(trendYears)}–${d3.max(trendYears)}`;
    }

    const trendRangeTabs = document.querySelectorAll('#national-range-tabs .chart-range-tab');
    trendRangeTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        activeTrendRange = tab.dataset.range;
        trendRangeTabs.forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
        renderNationalTrend();
      });
    });

    document.addEventListener('dashboard:typechange', (event) => {
      const { type } = event.detail || {};
      if (!type) return;
      activeTrendType = type;
      renderNationalTrend();
    });

    renderNationalTrend();
    observeResize('#chartsView', renderNationalTrend);

    // IMPORTANT: keep MA/MA-PD SECOND in each array below — pieChart.js
    // renders index 1 on the donut's left side. currentYear assumes yearlyWithLatest's latest year is first.
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
      html: (d) => {
        const n = getter(d);
        return `<span class="num-full">${formatNum(n)}</span><span class="num-abbr">${compactNum(n)}</span>`;
      },
      sortValue: getter,
    });

    const stateNameColumn = {
      label: 'State',
      value: (d) => d.stateName,
      sortValue: (d) => d.stateName,
      html: (d) => (mappableStateNames.has(d.stateName)
        ? d.stateName
        : `${d.stateName} <span class="data-grid-unmappable-note" title="Not part of the state map — this area can't be selected."><svg class="data-grid-unmappable-note__icon" aria-hidden="true" focusable="false"><use xlink:href="#svg-warning"></use></svg>Not on map</span>`),
    };

    const hospitalAreaColumns = [
      stateNameColumn,
      countCol('TOTAL', (d) => d.totalEnrollees),
      countCol('FFS', (d) => d.ffsCount),
      countCol('MA', (d) => d.maCount),
      { label: 'FFS %', value: (d) => roundPct(d.ffsPercent), sortValue: (d) => d.ffsPercent },
      { label: 'MA %', value: (d) => roundPct(d.maPercent), sortValue: (d) => d.maPercent },
    ];

    const drugAreaColumns = [
      stateNameColumn,
      countCol('TOTAL', (d) => d.drugTotal),
      countCol('PDP', (d) => d.pdpCount),
      countCol('MAPD', (d) => d.mapdCount),
      { label: 'PDP %', value: (d) => roundPct(d.pdpPercent), sortValue: (d) => d.pdpPercent },
      { label: 'MAPD %', value: (d) => roundPct(d.mapdPercent), sortValue: (d) => d.mapdPercent },
    ];

    const hospitalCountyColumns = [
      { label: 'County', value: (d) => d.county, sortValue: (d) => d.county },
      countCol('TOTAL', (d) => d.totalEnrollees),
      countCol('FFS', (d) => d.ffsCount),
      countCol('MA', (d) => d.maCount),
      { label: 'FFS %', value: (d) => roundPct(d.ffsPercent), sortValue: (d) => d.ffsPercent },
      { label: 'MA %', value: (d) => roundPct(d.maPercent), sortValue: (d) => d.maPercent },
    ];

    const drugCountyColumns = [
      { label: 'County', value: (d) => d.county, sortValue: (d) => d.county },
      countCol('TOTAL', (d) => d.drugTotal),
      countCol('PDP', (d) => d.pdpCount),
      countCol('MAPD', (d) => d.mapdCount),
      { label: 'PDP %', value: (d) => roundPct(d.pdpPercent), sortValue: (d) => d.pdpPercent },
      { label: 'MAPD %', value: (d) => roundPct(d.mapdPercent), sortValue: (d) => d.mapdPercent },
    ];

    let allStatesRows = [];
    let selectedState = null;
    let selectedCounty = null;
    let currentCountyRows = [];
    let activeDashboardType = 'hospital';

    // Forward-declared: selectStateFromGrid (below) calls these, but they're
    // defined later once mapConfigs/renderCountyGrid etc. exist.
    let resetMapToNational;
    let clearSelectedState;

    // Forward-declared: each popup's mutual-exclusion hook needs to call the
    // others' close(), but they're only assigned once createPopup builds them.
    let closeDrawer;
    let closeCountyDrawer;
    let closeOverlay;
    let closeCountyOverlay;

    // Desktop grids' sort state, one per grid. index 0/'asc' matches each
    // grid's previous hardcoded default (name column, A→Z).
    let allAreasSort = { index: 0, direction: 'asc' };
    let countyGridSort = { index: 0, direction: 'asc' };

    const areaColumnsFor = (type) => (type === 'drug' ? drugAreaColumns : hospitalAreaColumns);
    const countyColumnsFor = (type) => (type === 'drug' ? drugCountyColumns : hospitalCountyColumns);
    const rowTotal = (type, d) => (type === 'drug' ? d.drugTotal : d.totalEnrollees);

    // Shared by the desktop grids and both mobile drawers (each keeps its
    // own {index, direction} state, but the comparator logic is identical).
    const sortRows = (rows, cols, sortState) => {
      const col = cols[sortState.index] || cols[0];
      const getSortValue = col.sortValue || col.value || (() => '');
      const dir = sortState.direction === 'desc' ? -1 : 1;

      return [...rows].sort((a, b) => {
        const av = getSortValue(a);
        const bv = getSortValue(b);
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
        return String(av).localeCompare(String(bv)) * dir;
      });
    };

    // Flips {index, direction} for a newly-clicked column (resets to
    // ascending on a column switch). Shared by both drawers and both grids.
    const toggleSort = (current, index) => (
      current.index === index
        ? { index, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { index, direction: 'asc' }
    );

    // Clicking the already-selected row again deselects it; a different
    // row swaps the map to that state, same as before.
    const selectStateFromGrid = (stateName) => {
      if (selectedState?.stateName === stateName) {
        clearSelectedState();
        resetMapToNational(activeDashboardType);
        return;
      }

      const selectorId = activeDashboardType === 'drug' ? '#drug-state-selector' : '#medicare-state-selector';
      const select = document.querySelector(selectorId);
      if (!select) return;
      select.value = stateName;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const mapConfigs = {
      hospital: {
        selector: '#medicare-enrollment-state-map',
        options: {
          title: 'Medicare Advantage enrollment by state',
          comboBoxSelector: '#medicare-state-selector',
          backButtonSelector: '#medicare-map-back',
        },
      },
      drug: {
        selector: '#medicare-mapd-state-map',
        options: {
          metricLabel: 'MAPD',
          metricPercent: (d) => d.mapdPercent,
          metricCount: (d) => d.mapdCount,
          breakpoints: [21, 40, 60, 79],
          colors: ['#f4f1a3', '#75c3a3', '#3d8b6f', '#aac4e8', '#3a5fa0'],
          comparisonLabel: 'PDP',
          comparisonPercent: (d) => d.pdpPercent,
          comparisonCount: (d) => d.pdpCount,
          comboBoxSelector: '#drug-state-selector',
          backButtonSelector: '#drug-map-back',
        },
      },
    };

    // Mirrors selectStateFromGrid's toggle behavior, reusing the existing
    // dashboard:countyselect event so the map/drawer/grid all stay in sync.
    const selectCountyFromGrid = (county) => {
      const config = mapConfigs[activeDashboardType];
      if (!config) return;
      document.dispatchEvent(new CustomEvent('dashboard:countyselect', {
        detail: { containerSelector: config.selector, county: selectedCounty === county ? null : county },
      }));
    };

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

      const cols = areaColumnsFor(type);
      const rows = sortRows(
        allStatesRows.filter((d) => rowTotal(type, d) > 0),
        cols,
        allAreasSort,
      );

      renderTable('#all-areas-table', cols, rows, {
        onRowClick: (row) => selectStateFromGrid(row.stateName),
        isRowSelectable: (row) => mappableStateNames.has(row.stateName),
        isRowSelected: (row) => selectedState?.stateName === row.stateName,
        sortState: allAreasSort,
        onSort: (index) => {
          allAreasSort = toggleSort(allAreasSort, index);
          renderAllAreasGrid(type);
        },
      });
      requestAnimationFrame(() => bindScrollAffordance(host));
    };

    // ---- Shared helpers for the mobile drawers + desktop expand overlays
    // (state and county grids use the same drawer/overlay/sort behavior). ----

    const getFocusableEls = (container) => Array.from(
      container.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])'),
    );

    const makeDrawerEls = (prefix) => ({
      trigger: document.querySelector(`#${prefix}-mobile-trigger`),
      triggerValue: document.querySelector(`#${prefix}-mobile-trigger-value`),
      triggerDot: document.querySelector(`#${prefix}-mobile-trigger-dot`),
      triggerClear: document.querySelector(`#${prefix}-mobile-trigger-clear`),
      overlay: document.querySelector(`#${prefix}-drawer-overlay`),
      panel: document.querySelector(`#${prefix}-drawer`),
      closeBtn: document.querySelector(`#${prefix}-drawer-close`),
      search: document.querySelector(`#${prefix}-drawer-search`),
      theadRow: document.querySelector(`#${prefix}-drawer-thead-row`),
      tbody: document.querySelector(`#${prefix}-drawer-tbody`),
    });

    const makeOverlayEls = (prefix) => ({
      trigger: document.querySelector(`#${prefix}-expand-trigger`),
      scrim: document.querySelector(`#${prefix}-overlay-scrim`),
      panel: document.querySelector(`#${prefix}-overlay`),
      body: document.querySelector(`#${prefix}-overlay-body`),
      closeBtn: document.querySelector(`#${prefix}-overlay-close`),
    });

    // Generic popup "chrome" shared by all 4 popups (2 drawers, 2 overlays).
    // Popup-specific behavior (render a list, reparent a DOM node) comes in via hooks.
    const createPopup = ({
      scrim, panel, trigger, isDisabled = () => false,
      bodyLockClass, focusOnOpen, onBeforeOpen, onOpen, onClose,
    }) => {
      let lastFocusedEl = null;
      let onKeydown;

      const isOpen = () => Boolean(panel?.classList.contains('is-open'));

      const close = () => {
        if (!isOpen()) return;
        onClose?.();
        scrim.classList.remove('is-open');
        panel.classList.remove('is-open');
        trigger?.setAttribute('aria-expanded', 'false');
        document.body.classList.remove(bodyLockClass);
        document.removeEventListener('keydown', onKeydown);
        (lastFocusedEl || trigger)?.focus();
      };

      onKeydown = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          close();
          return;
        }
        if (event.key !== 'Tab' || !panel) return;
        const focusable = getFocusableEls(panel);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      };

      const open = () => {
        if (!panel || !scrim || isDisabled()) return;
        onBeforeOpen?.();
        lastFocusedEl = document.activeElement;
        onOpen?.();
        scrim.classList.add('is-open');
        panel.classList.add('is-open');
        trigger?.setAttribute('aria-expanded', 'true');
        document.body.classList.add(bodyLockClass);
        document.addEventListener('keydown', onKeydown);
        focusOnOpen?.();
      };

      return { open, close, isOpen };
    };

    const renderSortableDrawerHead = (theadRow, cols, sortState, onSortClick) => {
      if (!theadRow) return;
      theadRow.innerHTML = '';

      cols.forEach((col, index) => {
        const th = document.createElement('th');
        th.scope = 'col';

        const isActive = sortState.index === index;
        let ariaSortValue = 'none';
        let arrow = '';
        if (isActive) {
          ariaSortValue = sortState.direction === 'asc' ? 'ascending' : 'descending';
          arrow = sortState.direction === 'asc' ? ' ▲' : ' ▼';
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'data-grid-drawer__sort-button';
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-sort', ariaSortValue);
        button.innerHTML = `${col.label}<span aria-hidden="true">${arrow}</span>`;
        button.addEventListener('click', () => onSortClick(index));

        th.appendChild(button);
        theadRow.appendChild(th);
      });
    };

    // isRowSelectable/badge default to "no restriction" (county's case);
    // the state grid overrides both (mappable-state check + abbreviation badge).
    const renderDrawerRows = (tbody, rows, cols, {
      emptyMessage, isRowSelectable = () => true, isRowSelected = () => false, badge, onSelectRow,
    }) => {
      if (!tbody) return;
      tbody.innerHTML = '';

      if (!rows.length) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.className = 'data-grid-drawer__empty';
        td.colSpan = cols.length;
        td.textContent = emptyMessage;
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }

      rows.forEach((row) => {
        const tr = document.createElement('tr');
        const selectable = isRowSelectable(row);
        tr.classList.toggle('is-selected', isRowSelected(row));

        cols.forEach((col, index) => {
          const td = document.createElement('td');
          const cellHtml = col.html ? col.html(row) : null;
          if (index === 0 && badge) {
            td.innerHTML = `${badge(row)}${cellHtml ?? col.value(row)}`;
          } else if (cellHtml != null) {
            td.innerHTML = cellHtml;
          } else {
            td.textContent = col.value(row);
          }
          tr.appendChild(td);
        });

        if (selectable) {
          tr.tabIndex = 0;
          tr.classList.add('is-clickable');

          const selectRow = () => onSelectRow(row);
          tr.addEventListener('click', selectRow);
          tr.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              selectRow();
            }
          });
        } else {
          tr.classList.add('is-unselectable');
        }

        tbody.appendChild(tr);
      });
    };

    const filterAndSortDrawerRows = (rows, cols, sortState, searchTerm, matchesSearch) => {
      const term = searchTerm.trim().toLowerCase();
      const filtered = term ? rows.filter((row) => matchesSearch(row, term)) : rows;
      return sortRows(filtered, cols, sortState);
    };

    // ---- State mobile drawer + desktop expand overlay ----

    const drawerEls = makeDrawerEls('all-areas');
    const overlayEls = makeOverlayEls('all-areas');

    let drawerSort = { index: 0, direction: 'asc' }; // State A→Z, matches desktop table's default
    let drawerSearchTerm = '';

    const updateDrawerTriggerValue = () => {
      if (!drawerEls.triggerValue) return;
      const isSelected = Boolean(selectedState);
      drawerEls.triggerValue.textContent = isSelected
        ? `${selectedState.stateName} · ${selectedState.state}`
        : 'No state selected';
      drawerEls.triggerValue.classList.toggle('is-selected', isSelected);
      drawerEls.triggerDot?.classList.toggle('is-selected', isSelected);
      if (drawerEls.triggerClear) drawerEls.triggerClear.hidden = !isSelected;
    };

    const renderDrawerList = (type = activeDashboardType) => {
      const cols = areaColumnsFor(type);
      const rows = filterAndSortDrawerRows(
        allStatesRows.filter((d) => rowTotal(type, d) > 0),
        cols,
        drawerSort,
        drawerSearchTerm,
        (row, term) => row.stateName.toLowerCase().includes(term),
      );

      renderSortableDrawerHead(drawerEls.theadRow, cols, drawerSort, (index) => {
        drawerSort = toggleSort(drawerSort, index);
        renderDrawerList(type);
      });
      renderDrawerRows(drawerEls.tbody, rows, cols, {
        emptyMessage: drawerSearchTerm ? `No states match "${drawerSearchTerm}".` : 'No data available.',
        isRowSelectable: (row) => mappableStateNames.has(row.stateName),
        isRowSelected: (row) => selectedState?.stateName === row.stateName,
        badge: (row) => `<span class="data-grid-drawer__badge">${row.state || ''}</span>`,
        onSelectRow: (row) => {
          selectStateFromGrid(row.stateName);
          closeDrawer();
        },
      });
    };

    const stateDrawerPopup = createPopup({
      scrim: drawerEls.overlay,
      panel: drawerEls.panel,
      trigger: drawerEls.trigger,
      bodyLockClass: 'data-grid-drawer-open',
      focusOnOpen: () => drawerEls.search?.focus(),
      onBeforeOpen: () => closeCountyDrawer(),
      onOpen: () => {
        renderDrawerList();
        drawerEls.tbody?.querySelector('tr.is-selected')?.scrollIntoView({ block: 'nearest' });
      },
    });
    const openDrawer = stateDrawerPopup.open;
    closeDrawer = stateDrawerPopup.close;
    const isDrawerOpen = stateDrawerPopup.isOpen;

    if (drawerEls.trigger) {
      drawerEls.trigger.addEventListener('click', openDrawer);
      drawerEls.closeBtn?.addEventListener('click', closeDrawer);
      drawerEls.overlay?.addEventListener('click', closeDrawer);
      drawerEls.search?.addEventListener('input', (event) => {
        drawerSearchTerm = event.target.value;
        renderDrawerList();
      });
    }

    // Force-close the drawers on entering desktop, and the expand overlays
    // on leaving it — matches each one's own CSS display:none guard.
    const desktopMql = window.matchMedia('(min-width: 64em)');
    desktopMql.addEventListener('change', (event) => {
      if (event.matches) {
        closeDrawer();
        closeCountyDrawer();
      } else {
        closeOverlay();
        closeCountyOverlay();
      }
    });

    // ---- County mobile drawer + desktop expand overlay. Dispatches
    // dashboard:countyselect directly instead of driving a <select>. ----

    const countyDrawerEls = makeDrawerEls('county');
    const countyOverlayEls = makeOverlayEls('county');

    let countyDrawerSort = { index: 0, direction: 'asc' };
    let countyDrawerSearchTerm = '';

    const updateCountyDrawerTriggerValue = () => {
      if (!countyDrawerEls.triggerValue) return;
      const hasState = Boolean(selectedState);
      const hasCounty = Boolean(selectedCounty);

      let statusText = 'Select a state first';
      if (hasState) {
        statusText = `${selectedState.stateName} — ${hasCounty ? selectedCounty : 'No county selected'}`;
      }
      countyDrawerEls.triggerValue.textContent = statusText;
      countyDrawerEls.triggerValue.classList.toggle('is-selected', hasCounty);
      countyDrawerEls.triggerDot?.classList.toggle('is-selected', hasCounty);
      if (countyDrawerEls.triggerClear) countyDrawerEls.triggerClear.hidden = !hasCounty;
      if (countyDrawerEls.trigger) countyDrawerEls.trigger.disabled = !hasState;
      if (countyOverlayEls.trigger) countyOverlayEls.trigger.disabled = !hasState;
    };

    const renderCountyDrawerList = (type = activeDashboardType) => {
      const cols = countyColumnsFor(type);
      const rows = filterAndSortDrawerRows(
        currentCountyRows,
        cols,
        countyDrawerSort,
        countyDrawerSearchTerm,
        (row, term) => row.county.toLowerCase().includes(term),
      );

      renderSortableDrawerHead(countyDrawerEls.theadRow, cols, countyDrawerSort, (index) => {
        countyDrawerSort = toggleSort(countyDrawerSort, index);
        renderCountyDrawerList(type);
      });
      renderDrawerRows(countyDrawerEls.tbody, rows, cols, {
        emptyMessage: countyDrawerSearchTerm ? `No counties match "${countyDrawerSearchTerm}".` : 'No data available.',
        isRowSelected: (row) => selectedCounty === row.county,
        onSelectRow: (row) => {
          document.dispatchEvent(new CustomEvent('dashboard:countyselect', {
            detail: { containerSelector: mapConfigs[activeDashboardType].selector, county: row.county },
          }));
          closeCountyDrawer();
        },
      });
    };

    const countyDrawerPopup = createPopup({
      scrim: countyDrawerEls.overlay,
      panel: countyDrawerEls.panel,
      trigger: countyDrawerEls.trigger,
      isDisabled: () => Boolean(countyDrawerEls.trigger?.disabled),
      bodyLockClass: 'data-grid-drawer-open',
      focusOnOpen: () => countyDrawerEls.search?.focus(),
      onBeforeOpen: () => closeDrawer(),
      onOpen: () => {
        renderCountyDrawerList();
        countyDrawerEls.tbody?.querySelector('tr.is-selected')?.scrollIntoView({ block: 'nearest' });
      },
    });
    const openCountyDrawer = countyDrawerPopup.open;
    closeCountyDrawer = countyDrawerPopup.close;

    if (countyDrawerEls.trigger) {
      countyDrawerEls.trigger.addEventListener('click', openCountyDrawer);
      countyDrawerEls.closeBtn?.addEventListener('click', closeCountyDrawer);
      countyDrawerEls.overlay?.addEventListener('click', closeCountyDrawer);
      countyDrawerEls.search?.addEventListener('input', (event) => {
        countyDrawerSearchTerm = event.target.value;
        renderCountyDrawerList();
      });
    }

    countyDrawerEls.triggerClear?.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('dashboard:countyselect', {
        detail: { containerSelector: mapConfigs[activeDashboardType].selector, county: null },
      }));
    });

    // ---- Desktop "expand" overlays. Reparents the card's live
    // .data-grid-scroll-wrap into the overlay body while open, and back on close. ----

    const allAreasScrollWrapEl = document.querySelector('#all-areas-table')?.closest('.data-grid-scroll-wrap');
    const allAreasScrollWrapHome = allAreasScrollWrapEl?.parentElement;
    const countyScrollWrapEl = document.querySelector('#county-table')?.closest('.data-grid-scroll-wrap');
    const countyScrollWrapHome = countyScrollWrapEl?.parentElement;

    const stateOverlayPopup = createPopup({
      scrim: overlayEls.scrim,
      panel: overlayEls.panel,
      trigger: overlayEls.trigger,
      isDisabled: () => !allAreasScrollWrapEl,
      bodyLockClass: 'data-grid-overlay-open',
      focusOnOpen: () => overlayEls.closeBtn?.focus(),
      onBeforeOpen: () => {
        closeCountyOverlay();
        closeDrawer();
        closeCountyDrawer();
      },
      onOpen: () => {
        overlayEls.body.appendChild(allAreasScrollWrapEl);
        bindScrollAffordance(document.querySelector('#all-areas-table'));
        document.querySelector('#all-areas-table tr.is-selected')?.scrollIntoView({ block: 'nearest' });
      },
      onClose: () => {
        allAreasScrollWrapHome.appendChild(allAreasScrollWrapEl);
        bindScrollAffordance(document.querySelector('#all-areas-table'));
      },
    });
    const openOverlay = stateOverlayPopup.open;
    closeOverlay = stateOverlayPopup.close;

    if (overlayEls.trigger) {
      overlayEls.trigger.addEventListener('click', openOverlay);
      overlayEls.closeBtn?.addEventListener('click', closeOverlay);
      overlayEls.scrim?.addEventListener('click', closeOverlay);
    }

    const countyOverlayPopup = createPopup({
      scrim: countyOverlayEls.scrim,
      panel: countyOverlayEls.panel,
      trigger: countyOverlayEls.trigger,
      isDisabled: () => !countyScrollWrapEl || Boolean(countyOverlayEls.trigger?.disabled),
      bodyLockClass: 'data-grid-overlay-open',
      focusOnOpen: () => countyOverlayEls.closeBtn?.focus(),
      onBeforeOpen: () => {
        closeOverlay();
        closeDrawer();
        closeCountyDrawer();
      },
      onOpen: () => {
        countyOverlayEls.body.appendChild(countyScrollWrapEl);
        bindScrollAffordance(document.querySelector('#county-table'));
        document.querySelector('#county-table tr.is-selected')?.scrollIntoView({ block: 'nearest' });
      },
      onClose: () => {
        countyScrollWrapHome.appendChild(countyScrollWrapEl);
        bindScrollAffordance(document.querySelector('#county-table'));
      },
    });
    const openCountyOverlay = countyOverlayPopup.open;
    closeCountyOverlay = countyOverlayPopup.close;

    if (countyOverlayEls.trigger) {
      countyOverlayEls.trigger.addEventListener('click', openCountyOverlay);
      countyOverlayEls.closeBtn?.addEventListener('click', closeCountyOverlay);
      countyOverlayEls.scrim?.addEventListener('click', closeCountyOverlay);
    }

    // Base text read from the njk markup ("County Enrollment") so the
    // state-name prefix stays in sync with it instead of duplicating the string.
    const countyGridTitleEl = document.querySelector('#county-grid-title');
    const countyOverlayTitleEl = document.querySelector('#county-overlay-title');
    const countyDrawerTitleEl = document.querySelector('#county-drawer-title');
    const countyGridBaseTitle = countyGridTitleEl?.textContent.trim() || 'County Enrollment';
    const updateCountyGridTitle = (stateName) => {
      const text = stateName ? `${stateName} ${countyGridBaseTitle}` : countyGridBaseTitle;
      if (countyGridTitleEl) countyGridTitleEl.textContent = text;
      if (countyOverlayTitleEl) countyOverlayTitleEl.textContent = text;
      if (countyDrawerTitleEl) countyDrawerTitleEl.textContent = text;
    };

    const renderCountyGridTable = (type = activeDashboardType) => {
      const cols = countyColumnsFor(type);
      const rows = sortRows(currentCountyRows, cols, countyGridSort);

      renderTable('#county-table', cols, rows, {
        onRowClick: (row) => selectCountyFromGrid(row.county),
        isRowSelected: (row) => selectedCounty === row.county,
        sortState: countyGridSort,
        onSort: (index) => {
          countyGridSort = toggleSort(countyGridSort, index);
          renderCountyGridTable(type);
        },
      });
    };

    // Fires on any county selection source (map click, drawer row, or the
    // grid's own row click below), so the grid's highlight always stays in sync.
    document.addEventListener('dashboard:countychange', (event) => {
      selectedCounty = (event.detail || {}).county || null;
      updateCountyDrawerTriggerValue();
      renderCountyGridTable(activeDashboardType);
      document.querySelector('#county-table tr.is-selected')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    const renderCountyGrid = async (stateAbbr, stateName, type = activeDashboardType) => {
      const host = document.querySelector('#county-table');
      if (!host) return;

      updateCountyGridTitle(stateName);

      selectedCounty = null;
      if (countyDrawerEls.panel?.classList.contains('is-open')) closeCountyDrawer();

      if (!stateAbbr) {
        currentCountyRows = [];
        updateCountyDrawerTriggerValue();
        host.innerHTML = '<p class="data-grid-placeholder">Select a state on the map or from the dropdown to view county enrollment.</p>';
        updateScrollAffordance(host);
        return;
      }

      host.innerHTML = '<p class="data-grid-placeholder">Loading counties…</p>';

      try {
        const counties = await requestDataset('countyEnrollment', { state: stateAbbr });
        currentCountyRows = counties.filter((d) => rowTotal(type, d) > 0);

        renderCountyGridTable(type);
        updateCountyDrawerTriggerValue();
        requestAnimationFrame(() => bindScrollAffordance(host));
      } catch {
        currentCountyRows = [];
        updateCountyDrawerTriggerValue();
        host.innerHTML = '<p class="data-grid-placeholder" role="alert">County data could not be loaded.</p>';
      }
    };

    // Re-renders fresh (always national view), so switching type never
    // leaves a stale drilled-in county from before.
    resetMapToNational = (type) => {
      const config = mapConfigs[type];
      if (!config) return;
      renderStateMap(config.selector, allStatesRows, config.options);
    };

    clearSelectedState = () => {
      selectedState = null;
      updateDrawerTriggerValue();
      renderAllAreasGrid(activeDashboardType);
      renderCountyGrid(null, null, activeDashboardType);
    };

    drawerEls.triggerClear?.addEventListener('click', () => {
      clearSelectedState();
      resetMapToNational(activeDashboardType);
    });

    const loadStateMap = async () => {
      const recentRows = await requestDataset('stateEnrollment', { state: 'NY', type: 'monthly' });
      const latest = recentRows[0];
      allStatesRows = await requestDataset('allStates', {
        year: latest.year,
        month: latest.month,
      });

      renderAllAreasGrid('hospital');
      updateDrawerTriggerValue();

      resetMapToNational('hospital');
      resetMapToNational('drug');
    };

    document.addEventListener('dashboard:typechange', (event) => {
      const { type } = event.detail || {};
      if (!type) return;
      activeDashboardType = type;
      setMapPanelVisibility(type);
      selectedState = null;
      updateDrawerTriggerValue();
      renderAllAreasGrid(type);
      if (isDrawerOpen()) {
        renderDrawerList(type);
      }
      renderCountyGrid(null, null, type);
      resetMapToNational(type);
    });

    document.addEventListener('dashboard:statechange', (event) => {
      const { state, stateName } = event.detail || {};
      if (!state) return;
      selectedState = { state, stateName };
      updateDrawerTriggerValue();
      renderAllAreasGrid(activeDashboardType);
      renderCountyGrid(state, stateName, activeDashboardType);
      document.querySelector('#all-areas-table tr.is-selected')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    document.addEventListener('dashboard:stateclear', clearSelectedState);

    await loadStateMap();
  } catch (error) {
    throw new Error(`Failed to load national data: ${error.message}`);
  }
}

init();
