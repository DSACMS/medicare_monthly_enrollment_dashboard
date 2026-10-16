import requestDataset from '../../../src/router';
import renderTable from '../tables/renderTable';
import { areaColumnsFor, countyColumnsFor, rowTotal } from '../tables/gridColumns';
import {
  toggleSort,
  sortRows,
  updateScrollAffordance,
  bindScrollAffordance,
  scrollRowIntoView,
  makeDrawerEls,
  makeOverlayEls,
  createPopup,
  renderSortableDrawerHead,
  renderDrawerRows,
  filterAndSortDrawerRows,
} from './shared';
import createRequestGuard from '../requestGuard';

// Owns the state/county grids, drawers, and overlay. Trend-card syncing
// happens via the dashboard:* listeners in dashboard/index.js instead.
export default function initGrid(state, mappableStateNames) {
  const countyGridRequest = createRequestGuard();
  // Shared by the desktop grids and both mobile drawers
  const selectStateFromGrid = (stateName) => {
    if (state.selectedState?.stateName === stateName) {
      state.clearSelectedState();
      state.resetMapToNational(state.activeDashboardType);
      return;
    }

    const selectorId =
      state.activeDashboardType === 'drug' ? '#drug-state-selector' : '#medicare-state-selector';
    const select = document.querySelector(selectorId);
    if (!select) return;
    select.value = stateName;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  };

  // Mirrors selectStateFromGrid's toggle behavior, reusing the existing
  // dashboard:countyselect event so the map/drawer/grid all stay in sync.
  const selectCountyFromGrid = (county) => {
    const config = state.mapConfigs[state.activeDashboardType];
    if (!config) return;
    document.dispatchEvent(
      new CustomEvent('dashboard:countyselect', {
        detail: {
          containerSelector: config.selector,
          county: state.selectedCounty === county ? null : county,
        },
      }),
    );
  };

  const renderAllAreasGrid = (type = state.activeDashboardType) => {
    const host = document.querySelector('#all-areas-table');
    if (!host || !state.grid.allStatesRows.length) return;

    const cols = areaColumnsFor(type);
    const rows = sortRows(
      state.grid.allStatesRows.filter((d) => rowTotal(type, d) > 0),
      cols,
      state.grid.allAreasSort,
    );

    renderTable('#all-areas-table', cols, rows, {
      onRowClick: (row) => selectStateFromGrid(row.stateName),
      isRowSelectable: (row) => mappableStateNames.has(row.stateName),
      isRowSelected: (row) => state.selectedState?.stateName === row.stateName,
      sortState: state.grid.allAreasSort,
      onSort: (index) => {
        state.grid.allAreasSort = toggleSort(state.grid.allAreasSort, index);
        renderAllAreasGrid(type);
      },
    });
    requestAnimationFrame(() => bindScrollAffordance(host));
  };

  // ---- State mobile drawer + desktop expand overlay ----

  const drawerEls = makeDrawerEls('all-areas');
  const overlayEls = makeOverlayEls('enrollment');

  let drawerSort = { index: 0, direction: 'asc' };
  let drawerSearchTerm = '';

  const updateDrawerTriggerValue = () => {
    if (!drawerEls.triggerValue) return;
    const isSelected = Boolean(state.selectedState);
    drawerEls.triggerValue.textContent = isSelected
      ? `${state.selectedState.stateName} · ${state.selectedState.state}`
      : 'No state selected';
    drawerEls.triggerValue.classList.toggle('is-selected', isSelected);
    drawerEls.triggerDot?.classList.toggle('is-selected', isSelected);
    if (drawerEls.triggerClear) drawerEls.triggerClear.hidden = !isSelected;
  };

  const renderDrawerList = (type = state.activeDashboardType) => {
    const cols = areaColumnsFor(type);
    const rows = filterAndSortDrawerRows(
      state.grid.allStatesRows.filter((d) => rowTotal(type, d) > 0),
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
      emptyMessage: drawerSearchTerm
        ? `No states match "${drawerSearchTerm}".`
        : 'No data available.',
      isRowSelectable: (row) => mappableStateNames.has(row.stateName),
      isRowSelected: (row) => state.selectedState?.stateName === row.stateName,
      onSelectRow: (row) => {
        selectStateFromGrid(row.stateName);
        state.popups.closeDrawer();
      },
    });
  };

  const stateDrawerPopup = createPopup({
    scrim: drawerEls.overlay,
    panel: drawerEls.panel,
    trigger: drawerEls.trigger,
    bodyLockClass: 'data-grid-drawer-open',
    // Not the search input -- auto-focusing it pops the mobile keyboard
    // (and, on iOS Safari, zooms the page) the instant the drawer opens.
    focusOnOpen: () => drawerEls.closeBtn?.focus(),
    onBeforeOpen: () => {
      state.popups.closeCountyDrawer();
      state.popups.closeTrendDrawer();
    },
    onOpen: () => {
      renderDrawerList();
      drawerEls.tbody?.querySelector('tr.is-selected')?.scrollIntoView({ block: 'nearest' });
    },
  });
  const openDrawer = stateDrawerPopup.open;
  state.popups.closeDrawer = stateDrawerPopup.close;
  const isDrawerOpen = stateDrawerPopup.isOpen;

  if (drawerEls.trigger) {
    drawerEls.trigger.addEventListener('click', openDrawer);
    drawerEls.closeBtn?.addEventListener('click', state.popups.closeDrawer);
    drawerEls.overlay?.addEventListener('click', state.popups.closeDrawer);
    drawerEls.search?.addEventListener('input', (event) => {
      drawerSearchTerm = event.target.value;
      renderDrawerList();
    });
  }

  // ---- County mobile drawer. Dispatches dashboard:countyselect directly
  // instead of driving a <select>. ----

  const countyDrawerEls = makeDrawerEls('county');

  let countyDrawerSort = { index: 0, direction: 'asc' };
  let countyDrawerSearchTerm = '';

  const updateCountyDrawerTriggerValue = () => {
    if (!countyDrawerEls.triggerValue) return;
    const hasState = Boolean(state.selectedState);
    const hasCounty = Boolean(state.selectedCounty);

    let statusText = 'Select a state first';
    if (hasState) {
      statusText = `${state.selectedState.stateName} — ${hasCounty ? state.selectedCounty : 'No county selected'}`;
    }
    countyDrawerEls.triggerValue.textContent = statusText;
    countyDrawerEls.triggerValue.classList.toggle('is-selected', hasCounty);
    countyDrawerEls.triggerDot?.classList.toggle('is-selected', hasCounty);
    if (countyDrawerEls.triggerClear) countyDrawerEls.triggerClear.hidden = !hasCounty;
    if (countyDrawerEls.trigger) countyDrawerEls.trigger.disabled = !hasState;
  };

  const renderCountyDrawerList = (type = state.activeDashboardType) => {
    const cols = countyColumnsFor(type);
    const rows = filterAndSortDrawerRows(
      state.grid.currentCountyRows,
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
      emptyMessage: countyDrawerSearchTerm
        ? `No counties match "${countyDrawerSearchTerm}".`
        : 'No data available.',
      isRowSelected: (row) => state.selectedCounty === row.county,
      onSelectRow: (row) => {
        document.dispatchEvent(
          new CustomEvent('dashboard:countyselect', {
            detail: {
              containerSelector: state.mapConfigs[state.activeDashboardType].selector,
              county: row.county,
            },
          }),
        );
        state.popups.closeCountyDrawer();
      },
    });
  };

  const countyDrawerPopup = createPopup({
    scrim: countyDrawerEls.overlay,
    panel: countyDrawerEls.panel,
    trigger: countyDrawerEls.trigger,
    isDisabled: () => Boolean(countyDrawerEls.trigger?.disabled),
    bodyLockClass: 'data-grid-drawer-open',
    // Not the search input -- auto-focusing it pops the mobile keyboard
    // (and, on iOS Safari, zooms the page) the instant the drawer opens.
    focusOnOpen: () => countyDrawerEls.closeBtn?.focus(),
    onBeforeOpen: () => {
      state.popups.closeDrawer();
      state.popups.closeTrendDrawer();
    },
    onOpen: () => {
      renderCountyDrawerList();
      countyDrawerEls.tbody?.querySelector('tr.is-selected')?.scrollIntoView({ block: 'nearest' });
    },
  });
  const openCountyDrawer = countyDrawerPopup.open;
  state.popups.closeCountyDrawer = countyDrawerPopup.close;

  if (countyDrawerEls.trigger) {
    countyDrawerEls.trigger.addEventListener('click', openCountyDrawer);
    countyDrawerEls.closeBtn?.addEventListener('click', state.popups.closeCountyDrawer);
    countyDrawerEls.overlay?.addEventListener('click', state.popups.closeCountyDrawer);
    countyDrawerEls.search?.addEventListener('input', (event) => {
      countyDrawerSearchTerm = event.target.value;
      renderCountyDrawerList();
    });
  }

  countyDrawerEls.triggerClear?.addEventListener('click', () => {
    document.dispatchEvent(
      new CustomEvent('dashboard:countyselect', {
        detail: {
          containerSelector: state.mapConfigs[state.activeDashboardType].selector,
          county: null,
        },
      }),
    );
  });

  // ---- Desktop "expand" overlay for the merged Enrollment Table card.
  // Reparents whichever .data-grid-scroll-wrap (state or county) is
  // currently active into the overlay body while open, and back on close.
  // Switching state/county view works the same way whether the card is expanded
  // or not — see setActiveGridView below. ----

  const allAreasScrollWrapEl = document
    .querySelector('#all-areas-table')
    ?.closest('.data-grid-scroll-wrap');
  const allAreasScrollWrapHome = allAreasScrollWrapEl?.parentElement;
  const countyScrollWrapEl = document
    .querySelector('#county-table')
    ?.closest('.data-grid-scroll-wrap');
  const countyScrollWrapHome = countyScrollWrapEl?.parentElement;

  const viewTabsEl = document.querySelector('#enrollment-view-tabs');
  const viewTabsHome = viewTabsEl?.parentElement;

  let activeGridView = state.grid.activeView; // 'state' | 'county'

  const enrollmentTabState = document.querySelector('#enrollment-tab-state');
  const enrollmentTabCounty = document.querySelector('#enrollment-tab-county');
  const enrollmentInstructionEl = document.querySelector('#enrollment-instruction');

  const viewInstructions = {
    state: 'Click a state to display on the map. Click again to deselect.',
    county: 'Click a county to display on the map. Click again to deselect.',
  };

  const scrollWrapFor = (view) => (view === 'county' ? countyScrollWrapEl : allAreasScrollWrapEl);
  const scrollWrapHomeFor = (view) =>
    view === 'county' ? countyScrollWrapHome : allAreasScrollWrapHome;
  const tableSelectorFor = (view) => (view === 'county' ? '#county-table' : '#all-areas-table');

  const enrollmentOverlayPopup = createPopup({
    scrim: overlayEls.scrim,
    panel: overlayEls.panel,
    trigger: overlayEls.trigger,
    isDisabled: () => !allAreasScrollWrapEl && !countyScrollWrapEl,
    bodyLockClass: 'data-grid-overlay-open',
    focusOnOpen: () => overlayEls.closeBtn?.focus(),
    onBeforeOpen: () => {
      state.popups.closeDrawer();
      state.popups.closeCountyDrawer();
      state.popups.closeTrendOverlay();
    },
    onOpen: () => {
      overlayEls.tabsSlot.appendChild(viewTabsEl);
      overlayEls.body.appendChild(scrollWrapFor(activeGridView));
      bindScrollAffordance(document.querySelector(tableSelectorFor(activeGridView)));
      scrollRowIntoView(
        document.querySelector(`${tableSelectorFor(activeGridView)} tr.is-selected`),
      );
    },
    onClose: () => {
      scrollWrapHomeFor(activeGridView).appendChild(scrollWrapFor(activeGridView));
      viewTabsHome.appendChild(viewTabsEl);
      bindScrollAffordance(document.querySelector(tableSelectorFor(activeGridView)));
    },
  });
  const openOverlay = enrollmentOverlayPopup.open;
  state.popups.closeOverlay = enrollmentOverlayPopup.close;
  const isOverlayOpen = enrollmentOverlayPopup.isOpen;

  if (overlayEls.trigger) {
    overlayEls.trigger.addEventListener('click', openOverlay);
    overlayEls.closeBtn?.addEventListener('click', state.popups.closeOverlay);
    overlayEls.scrim?.addEventListener('click', state.popups.closeOverlay);
  }

  // Swaps which table (state/county) is visible, whether the card is
  // expanded into the overlay or not — reused both for a direct tab click
  // and for the forced state-cleared reset in updateCountyGridTitle below.
  const setActiveGridView = (view, { announce = true } = {}) => {
    if (view === activeGridView || (view === 'county' && enrollmentTabCounty.hidden)) return;
    const previousView = activeGridView;
    activeGridView = view;
    state.grid.activeView = view;

    enrollmentTabState.setAttribute('aria-selected', String(view === 'state'));
    enrollmentTabCounty.setAttribute('aria-selected', String(view === 'county'));
    enrollmentInstructionEl.textContent = viewInstructions[view];

    scrollWrapFor(previousView).hidden = true;
    scrollWrapFor(view).hidden = false;

    if (isOverlayOpen()) {
      scrollWrapHomeFor(previousView).appendChild(scrollWrapFor(previousView));
      overlayEls.body.appendChild(scrollWrapFor(view));
    }

    bindScrollAffordance(document.querySelector(tableSelectorFor(view)));
    document.dispatchEvent(new CustomEvent('dashboard:tablechange', { detail: { announce } }));
  };
  state.grid.setActiveView = setActiveGridView;

  [enrollmentTabState, enrollmentTabCounty].forEach((tab) => {
    tab.addEventListener('click', () => setActiveGridView(tab.dataset.view));
  });

  // Base text read from the njk markup ("County Enrollment") so the
  // state-name prefix stays in sync with it instead of duplicating the string.
  const countyDrawerTitleEl = document.querySelector('#county-drawer-title');
  const countyDrawerBaseTitle = countyDrawerTitleEl?.textContent.trim() || 'County Enrollment';
  const updateCountyGridTitle = (stateName) => {
    const hasState = Boolean(stateName);

    enrollmentTabCounty.hidden = !hasState;
    enrollmentTabCounty.textContent = hasState ? `${stateName} Counties` : 'Counties';

    // Edge case: state cleared while county view was active — force back to state view.
    if (!hasState && activeGridView === 'county') {
      setActiveGridView('state');
    }

    if (countyDrawerTitleEl) {
      countyDrawerTitleEl.textContent = hasState
        ? `${stateName} ${countyDrawerBaseTitle}`
        : countyDrawerBaseTitle;
    }
  };

  const renderCountyGridTable = (type = state.activeDashboardType) => {
    const cols = countyColumnsFor(type);
    const rows = sortRows(state.grid.currentCountyRows, cols, state.grid.countyGridSort);

    renderTable('#county-table', cols, rows, {
      onRowClick: (row) => selectCountyFromGrid(row.county),
      isRowSelected: (row) => state.selectedCounty === row.county,
      sortState: state.grid.countyGridSort,
      onSort: (index) => {
        state.grid.countyGridSort = toggleSort(state.grid.countyGridSort, index);
        renderCountyGridTable(type);
      },
    });
  };

  const renderCountyGrid = async (stateAbbr, stateName, type = state.activeDashboardType) => {
    const host = document.querySelector('#county-table');
    if (!host) return;

    updateCountyGridTitle(stateName);

    state.selectedCounty = null;
    if (countyDrawerEls.panel?.classList.contains('is-open')) state.popups.closeCountyDrawer();

    const { signal, isStale } = countyGridRequest.next();

    if (!stateAbbr) {
      state.grid.currentCountyRows = [];
      updateCountyDrawerTriggerValue();
      host.innerHTML =
        '<p class="data-grid-placeholder">Select a state on the map or from the dropdown to view county enrollment.</p>';
      updateScrollAffordance(host);
      return;
    }

    host.innerHTML = '<p class="data-grid-placeholder">Loading counties…</p>';

    try {
      const { year, month } = state.mapConfigs[type].options;
      // Suppressed/no-data counties (e.g. Kalawao County, HI) are kept here
      // -- shown flagged (via the "Suppressed"/"No data" tag) but still
      // selectable, matching the map, rather than silently dropped.
      const countyRows = await requestDataset(
        'countyEnrollment',
        { state: stateAbbr, year, month },
        { signal },
      );
      if (isStale()) return;
      state.grid.currentCountyRows = countyRows;

      renderCountyGridTable(type);
      updateCountyDrawerTriggerValue();
      requestAnimationFrame(() => bindScrollAffordance(host));
    } catch (error) {
      if (error?.name === 'AbortError') return;
      if (isStale()) return;
      state.grid.currentCountyRows = [];
      updateCountyDrawerTriggerValue();
      host.innerHTML =
        '<p class="data-grid-placeholder" role="alert">County data could not be loaded.</p>';
    }
  };

  drawerEls.triggerClear?.addEventListener('click', () => {
    state.clearSelectedState();
    state.resetMapToNational(state.activeDashboardType);
  });

  return {
    renderAllAreasGrid,
    renderDrawerList,
    isDrawerOpen,
    updateDrawerTriggerValue,
    renderCountyGrid,
    renderCountyGridTable,
    updateCountyDrawerTriggerValue,
    setActiveGridView,
  };
}
