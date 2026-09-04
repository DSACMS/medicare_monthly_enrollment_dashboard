import * as d3 from 'd3';
import requestDataset, { dataManager } from '../../../src/router';
import { sortMonthlyAscending, observeResize } from '../charts/utils';
import { scrollRowIntoView, syncColumnHeights } from './shared';
import createDashboardState from './dashboardState';
import initHeroCard from './hero';
import initMap from './map';
import initGrid from './grid';
import initTrend from './trend';
import { mergeLatestMonthlyIntoYearly } from '../charts/index';
import { initUrlSync } from './urlSync';
import DashboardController from './DashboardController';
import registerDashboardTools from './webmcp';
import formatFreshnessInfo from './freshness';

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

    const { showTrendForScope } = initTrend(state, yearlyWithLatest, monthly);

    const { setMapPanelVisibility, mappableStateNames } = initMap(state);

    setMapPanelVisibility('hospital');
    initHeroCard(yearlyWithLatest);

    const {
      renderAllAreasGrid,
      renderDrawerList,
      isDrawerOpen,
      updateDrawerTriggerValue,
      renderCountyGrid,
      renderCountyGridTable,
      updateCountyDrawerTriggerValue,
      setActiveGridView,
    } = initGrid(state, mappableStateNames);

    const latestMonth = sortMonthlyAscending(monthly).at(-1);
    d3.select('#dashboard-title-date').text(`${latestMonth.month} ${latestMonth.year}`);
    const dataSource = document.querySelector('#dashboard-data-source');
    const freshnessInfo = formatFreshnessInfo(dataManager.getInfo());
    if (dataSource && freshnessInfo) {
      dataSource.textContent = freshnessInfo;
      dataSource.hidden = false;
    }

    // Fires on any county selection source (map click, drawer row, or the
    // grid's own row click), so the grid's highlight always stays in sync.
    document.addEventListener('dashboard:countychange', (event) => {
      const shouldMoveFocus = event.detail?.moveFocus ?? hasUserInteracted;
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
      if (shouldMoveFocus) {
        scrollRowIntoView(document.querySelector('#county-table tr.is-selected'), {
          smooth: true,
        });
      }
    });

    state.clearSelectedState = () => {
      state.selectedState = null;
      state.selectedCounty = null;
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

    // Waits for the active map to bind its combo-box change handler, then
    // drives the drill-in via a native change event on the <select>. This
    // reuses the same code path as a user selection, so it also emits
    // dashboard:statechange (which updates the grid and trend cards).
    const drillActiveMapToState = ({ stateAbbr, stateName, county, options = {} }) => {
      const activeConfig = state.mapConfigs[state.activeDashboardType];
      const activeSelector = activeConfig?.selector;
      const select = activeConfig
        ? document.querySelector(activeConfig.options.comboBoxSelector)
        : null;

      const trigger = () => {
        if (select && stateName) {
          select.value = stateName;
          select.dispatchEvent(new CustomEvent('change', { bubbles: true, detail: options }));
        } else if (stateAbbr) {
          document.dispatchEvent(
            new CustomEvent('dashboard:statechange', {
              detail: { state: stateAbbr, stateName, ...options },
            }),
          );
        }

        if (county) {
          // Route the county through the map's own selection channel so the
          // county map's highlight updates too; countyselect internally
          // re-emits countychange for the grid and trend cards.
          const onCountyMapReady = (event) => {
            if (!activeSelector || event.detail?.containerSelector === activeSelector) {
              document.removeEventListener('dashboard:countymapready', onCountyMapReady);
              document.dispatchEvent(
                new CustomEvent('dashboard:countyselect', {
                  detail: { containerSelector: activeSelector, county, ...options },
                }),
              );
            }
          };
          document.addEventListener('dashboard:countymapready', onCountyMapReady);
        }
      };

      const onReady = (event) => {
        if (!activeSelector || event.detail?.containerSelector === activeSelector) {
          document.removeEventListener('dashboard:mapready', onReady);
          trigger();
        }
      };
      document.addEventListener('dashboard:mapready', onReady);
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
      const shouldMoveFocus = event.detail?.moveFocus ?? hasUserInteracted;
      const { state: stateAbbr, stateName } = event.detail || {};
      if (!stateAbbr) return;
      state.selectedState = { state: stateAbbr, stateName };
      updateDrawerTriggerValue();
      renderAllAreasGrid(state.activeDashboardType);
      renderCountyGrid(stateAbbr, stateName, state.activeDashboardType);
      if (shouldMoveFocus) {
        scrollRowIntoView(document.querySelector('#all-areas-table tr.is-selected'), {
          smooth: true,
        });
      }
      showTrendForScope('state', { state: stateAbbr, stateName });

      // Switch to county view and move focus for keyboard users. Skip the
      // focus move on URL restore so a shared link lands at the top of the
      // page instead of jumping down to the county table.
      setActiveGridView('county');
      if (shouldMoveFocus) {
        requestAnimationFrame(() => {
          const countyTable = document.querySelector('#county-table');
          if (countyTable) {
            countyTable.focus();
          }
        });
      }
    });

    document.addEventListener('dashboard:stateclear', () => state.clearSelectedState());

    await loadStateMap();

    window.dashboardController = new DashboardController({
      state,
      statusElement: document.querySelector('#dashboard-status'),
    });
    registerDashboardTools({ controller: window.dashboardController }).catch(() => {
      // WebMCP is an optional browser enhancement.
    });

    if (initial.state) {
      const matchedState = state.grid.allStatesRows.find((row) => row.state === initial.state);
      const stateName = matchedState?.stateName || initial.state;
      drillActiveMapToState({
        stateAbbr: initial.state,
        stateName,
        county: initial.county,
        options: { source: 'url', moveFocus: false, announce: false },
      });
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
