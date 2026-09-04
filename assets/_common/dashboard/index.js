import * as d3 from 'd3';
import requestDataset from '../../../src/router';
import { sortMonthlyAscending, observeResize } from '../charts/utils';
import { scrollRowIntoView, syncColumnHeights } from './shared';
import createDashboardState from './dashboardState';
import initHeroCard from './hero';
import initMap from './map';
import initGrid from './grid';
import initTrend from './trend';
import { mergeLatestMonthlyIntoYearly } from '../charts/index';
import { initUrlSync } from './urlSync';

async function init() {
  try {
    const state = createDashboardState();
    const { initial } = initUrlSync(state);

    // Suppresses auto-scroll and focus movement until the user actually
    // touches the page. URL-restore (?state=X&county=Y links) reuses the
    // same drill-in code path as an interactive selection, so without
    // this guard a shared link would auto-scroll past the header down to
    // the county table.
    let hasUserInteracted = false;
    const markUserInteracted = () => {
      hasUserInteracted = true;
    };
    document.addEventListener('pointerdown', markUserInteracted, { once: true, capture: true });
    document.addEventListener('keydown', markUserInteracted, { once: true, capture: true });

    const [yearly, monthly] = await Promise.all([
      requestDataset('nationalEnrollment', { type: 'yearly' }),
      requestDataset('nationalEnrollment', { type: 'monthly' }),
    ]);

    const yearlyWithLatest = mergeLatestMonthlyIntoYearly(yearly, monthly);

    const { showTrendForScope, setActiveTrendDot, scrollToTrendView } = initTrend(state, yearlyWithLatest, monthly);

    const { setMapPanelVisibility } = initMap(state);

    setMapPanelVisibility(initial.activeDashboardType || 'hospital');
    initHeroCard(yearlyWithLatest, initial);

    const {
      renderAllAreasGrid,
      renderDrawerList,
      isDrawerOpen,
      updateDrawerTriggerValue,
      renderCountyGrid,
      renderCountyGridTable,
      updateCountyDrawerTriggerValue,
      setActiveGridView,
    } = initGrid(state);

    const latestMonth = sortMonthlyAscending(monthly).at(-1);
    d3.select('#dashboard-title-date').text(`${latestMonth.month} ${latestMonth.year}`);

    // Fires on any county selection source (map click, drawer row, or the
    // grid's own row click), so the grid's highlight always stays in sync.
    document.addEventListener('dashboard:countychange', (event) => {
      state.selectedCounty = (event.detail || {}).county || null;
      updateCountyDrawerTriggerValue();

      // Trend update updates first
      if (state.selectedCounty && state.selectedState) {
        showTrendForScope('county', {
          state: state.selectedState.state,
          stateName: state.selectedState.stateName,
          county: state.selectedCounty,
        });
      } else if (state.selectedState) {
        showTrendForScope('state', {
          state: state.selectedState.state,
          stateName: state.selectedState.stateName,
        });
      } else {
        showTrendForScope('national', null);
      }

      renderCountyGridTable(state.activeDashboardType);

      if (state.selectedCounty) setActiveGridView('county');
      if (hasUserInteracted) {
        scrollRowIntoView(document.querySelector('#county-table tr.is-selected'), {
          smooth: true,
        });
      }
    });

    state.clearSelectedState = () => {
      state.selectedState = null;
      updateDrawerTriggerValue();
      renderAllAreasGrid(state.activeDashboardType);
      renderCountyGrid(null, null, state.activeDashboardType);
      showTrendForScope('national', null);
    };

    const loadStateMap = async () => {
      const { monthly: recentRows } = await requestDataset('stateEnrollment', { state: 'NY' });
      const latest = recentRows[0];

      state.mapConfigs.hospital.options.year = latest.year;
      state.mapConfigs.hospital.options.month = latest.month;
      state.mapConfigs.drug.options.year = latest.year;
      state.mapConfigs.drug.options.month = latest.month;

      state.grid.allStatesRows = await requestDataset('allStates', {
        year: latest.year,
        month: latest.month,
      });

      renderAllAreasGrid('hospital');
      updateDrawerTriggerValue();

      state.resetMapToNational('hospital');
      state.resetMapToNational('drug');
    };

    document.addEventListener('dashboard:typechange', (event) => {
      const { type } = event.detail || {};
      if (!type) return;
      state.activeDashboardType = type;
      state.trend.activeTrendType = type;
      setMapPanelVisibility(type);
      state.selectedState = null;
      updateDrawerTriggerValue();
      renderAllAreasGrid(type);
      if (isDrawerOpen()) {
        renderDrawerList(type);
      }
      renderCountyGrid(null, null, type);
      state.resetMapToNational(type);
      showTrendForScope('national', null);
    });

    document.addEventListener('dashboard:statechange', (event) => {
      const { state: stateAbbr, stateName } = event.detail || {};
      if (!stateAbbr) return;
      state.selectedState = { state: stateAbbr, stateName };
      updateDrawerTriggerValue();
      renderAllAreasGrid(state.activeDashboardType);
      renderCountyGrid(stateAbbr, stateName, state.activeDashboardType);
      if (hasUserInteracted) {
        scrollRowIntoView(document.querySelector('#all-areas-table tr.is-selected'), {
          smooth: true,
        });
      }
      showTrendForScope('state', { state: stateAbbr, stateName });

      // Switch to county view and move focus for keyboard users. Skip the
      // focus move on URL restore so a shared link lands at the top of the
      // page instead of jumping down to the county table.
      setActiveGridView('county');
      if (hasUserInteracted) {
        requestAnimationFrame(() => {
          const countyTable = document.querySelector('#county-table');
          if (countyTable) {
            countyTable.focus();
          }
        });
      }
    });

    document.addEventListener('dashboard:stateclear', () => state.clearSelectedState());

    // Force-close the drawers on entering desktop, and the expand overlays
    // on leaving it — matches each one's own CSS display:none guard.
    const desktopMql = window.matchMedia('(min-width: 64em)');
    desktopMql.addEventListener('change', (event) => {
      if (event.matches) {
        state.popups.closeDrawer();
        state.popups.closeCountyDrawer();
        state.popups.closeTrendDrawer();
        state.trend.activeTrendView = 'line';
        setActiveTrendDot('line');
        scrollToTrendView('line', 'auto');
      } else {
        state.popups.closeOverlay();
        state.popups.closeTrendOverlay();
      }
    });

    await loadStateMap();

    if (initial.state) {
      const matchedState = state.grid.allStatesRows.find((row) => row.state === initial.state);
      const stateName = matchedState?.stateName || initial.state;

      document.dispatchEvent(new CustomEvent('dashboard:statechange', {
        detail: { state: initial.state, stateName },
      }));

      if (initial.county) {
        document.dispatchEvent(new CustomEvent('dashboard:countychange', {
          detail: { county: initial.county },
        }));
      }
    }

    observeResize('.dashboard-columns__main', syncColumnHeights);
    observeResize('.dashboard-columns__side', syncColumnHeights);
  } catch (error) {
    const root = document.querySelector('.dashboard-root');
    if (root) {
      root.innerHTML =
        '<p class="data-grid-placeholder" role="alert">Dashboard failed to load. Please refresh the page to try again.</p>';
    }
    throw new Error(`Failed to load national data: ${error.message}`);
  }
}

init();
