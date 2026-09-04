import * as d3 from 'd3';
import requestDataset from '../../../src/router';
import renderTable from '../tables/renderTable';
import { sortYearlyAscending, sortMonthlyAscending, observeResize } from '../charts/utils';
import { buildTrendGridColumns } from '../tables/gridColumns';
import { toggleSort, makeDrawerEls, makeOverlayEls, createPopup } from './shared';
import { DASHBOARD_TREND_CHARTS } from '../charts/index';
import createRequestGuard from '../requestGuard';
import DASHBOARD_LABELS from '../labels';

// Owns the national/state/county trend cluster: the line/bar charts, the
// desktop "expand" overlay, the mobile bottom-sheet drawer, and the mobile
// carousel that swaps between them.
export default function initTrend(state, yearlyWithLatest, monthly) {
  const trendRequest = createRequestGuard();
  const barLegend = { legendSelector: '#national-trend-bar-legend' };
  const lineLegend = { legendSelector: '#national-trend-line-legend' };

  const trendChartFns = {
    hospital: {
      yearly: {
        line: DASHBOARD_TREND_CHARTS.hospital.yearlyLine,
        bar: DASHBOARD_TREND_CHARTS.hospital.yearlyBar,
      },
      monthly: {
        line: DASHBOARD_TREND_CHARTS.hospital.monthlyLine,
        bar: DASHBOARD_TREND_CHARTS.hospital.monthlyBar,
      },
    },
    drug: {
      yearly: {
        line: DASHBOARD_TREND_CHARTS.drug.yearlyLine,
        bar: DASHBOARD_TREND_CHARTS.drug.yearlyBar,
      },
      monthly: {
        line: DASHBOARD_TREND_CHARTS.drug.monthlyLine,
        bar: DASHBOARD_TREND_CHARTS.drug.monthlyBar,
      },
    },
  };

  state.trend.nationalTrendData = { yearly: yearlyWithLatest, monthly };

  const programLabel = (type) =>
    (type === 'drug' ? DASHBOARD_LABELS.prescriptionDrug : DASHBOARD_LABELS.hospitalMedical)
      .programName;

  const trendContextLabel = () => {
    if (state.trend.trendScope === 'county' && state.trend.trendArea?.county) {
      return `${state.trend.trendArea.county}, ${state.trend.trendArea.state} · ${programLabel(state.trend.activeTrendType)}`;
    }
    if (state.trend.trendScope === 'state' && state.trend.trendArea?.stateName) {
      return `${state.trend.trendArea.stateName} · ${programLabel(state.trend.activeTrendType)}`;
    }
    return `National · ${programLabel(state.trend.activeTrendType)}`;
  };

  const currentTrendBucket = () => {
    if (state.trend.trendScope === 'state' && state.trend.trendArea)
      return state.trend.stateTrendCache.get(state.trend.trendArea.state);
    if (state.trend.trendScope === 'county' && state.trend.trendArea)
      return state.trend.countyTrendCache.get(
        `${state.trend.trendArea.state}|${state.trend.trendArea.county}`,
      );
    return state.trend.nationalTrendData;
  };

  const syncOverlayControls = () => {
    document.querySelectorAll('#trend-overlay-range .chart-range-tab').forEach((tab) => {
      tab.setAttribute('aria-selected', String(tab.dataset.range === state.trend.activeTrendRange));
    });
    document.querySelectorAll('#trend-overlay-types [data-view]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.view === state.trend.overlayTrendView));
    });
  };

  // Shared by the desktop overlay's grid view and the mobile trend drawer.
  const renderTrendGrid = (selector) => {
    const data = currentTrendBucket()?.[state.trend.activeTrendRange];
    const ascending =
      state.trend.activeTrendRange === 'yearly'
        ? sortYearlyAscending(data || [])
        : sortMonthlyAscending(data || []);
    const sorted = state.trend.trendGridSort.direction === 'asc' ? ascending : ascending.reverse();
    if (!sorted.length) {
      document.querySelector(selector).innerHTML =
        '<p class="data-grid-placeholder">No trend data available for this selection.</p>';
    } else {
      renderTable(
        selector,
        buildTrendGridColumns(state.trend.activeTrendType, state.trend.activeTrendRange),
        sorted,
        {
          sortState: state.trend.trendGridSort,
          sortableIndex: 0,
          onSort: () => {
            state.trend.trendGridSort = toggleSort(state.trend.trendGridSort, 0);
            renderTrendGrid(selector);
          },
        },
      );
    }
  };

  const renderTrendOverlay = () => {
    if (!document.querySelector('#trend-overlay-body')) return;

    d3.select('#trend-overlay-sub').text(trendContextLabel());

    ['line', 'bar', 'grid'].forEach((view) => {
      const panel = document.querySelector(`#trend-overlay-${view}-panel`);
      if (panel) panel.hidden = view !== state.trend.overlayTrendView;
    });

    if (state.trend.overlayTrendView === 'grid') {
      renderTrendGrid('#trend-overlay-grid');
      return;
    }

    const data = currentTrendBucket()?.[state.trend.activeTrendRange];
    const hasData = Boolean(data && data.length);
    const fns = trendChartFns[state.trend.activeTrendType][state.trend.activeTrendRange];
    const host =
      state.trend.overlayTrendView === 'line' ? '#trend-overlay-line' : '#trend-overlay-bar';
    if (!hasData) {
      document.querySelector(host).innerHTML =
        '<p class="data-grid-placeholder">No trend data available for this selection.</p>';
      return;
    }
    if (state.trend.overlayTrendView === 'line') {
      fns.line('#trend-overlay-line', data, { legendSelector: '#trend-overlay-line-legend' });
    } else {
      fns.bar('#trend-overlay-bar', data, { legendSelector: '#trend-overlay-bar-legend' });
    }
  };

  const updateTrendDrawerTrigger = () => {
    const desc = document.querySelector('#trend-mobile-trigger-desc');
    if (desc)
      desc.textContent = `Open to view the full ${state.trend.activeTrendRange} trend data table.`;
  };

  const renderTrendDrawer = () => {
    if (!document.querySelector('#trend-drawer-body')) return;
    renderTrendGrid('#trend-drawer-body');
  };

  const renderTrend = () => {
    const data = currentTrendBucket()?.[state.trend.activeTrendRange];
    const fns = trendChartFns[state.trend.activeTrendType][state.trend.activeTrendRange];
    if (data && data.length) {
      fns.line('#national-trend-line', data, lineLegend);
      fns.bar('#national-trend-bar', data, barLegend);
    }
    d3.select('#national-trend-sub').text(trendContextLabel());
    updateTrendDrawerTrigger();
    if (state.trend.trendOverlayOpen) renderTrendOverlay();
    if (state.trend.trendDrawerOpen) renderTrendDrawer();
  };

  const trendLoadingHtml =
    '<p class="data-grid-placeholder trend-loading" role="status" aria-live="polite"><span class="trend-loading__spinner" aria-hidden="true"></span>Loading trend…</p>';

  const showTrendLoading = () => {
    d3.select('#national-trend-sub').text(trendContextLabel());
    const lineHost = document.querySelector('#national-trend-line');
    if (lineHost) lineHost.innerHTML = trendLoadingHtml;
    const barHost = document.querySelector('#national-trend-bar');
    if (barHost) barHost.innerHTML = trendLoadingHtml;

    if (state.trend.trendOverlayOpen) {
      d3.select('#trend-overlay-sub').text(trendContextLabel());
      const activeSel = {
        line: '#trend-overlay-line',
        bar: '#trend-overlay-bar',
        grid: '#trend-overlay-grid',
      }[state.trend.overlayTrendView];
      const overlayHost = document.querySelector(activeSel);
      if (overlayHost) overlayHost.innerHTML = trendLoadingHtml;
    }

    if (state.trend.trendDrawerOpen) {
      const drawerHost = document.querySelector('#trend-drawer-body');
      if (drawerHost) drawerHost.innerHTML = trendLoadingHtml;
    }
  };

  const showTrendForScope = async (scope, area) => {
    state.trend.trendScope = scope;
    state.trend.trendArea = area;
    const { signal, isStale } = trendRequest.next();

    if (scope !== 'national') {
      const cache = scope === 'state' ? state.trend.stateTrendCache : state.trend.countyTrendCache;
      const key = scope === 'state' ? area.state : `${area.state}|${area.county}`;

      if (!cache.has(key)) {
        showTrendLoading();
        const service = scope === 'state' ? 'stateEnrollment' : 'countyTrend';
        const params =
          scope === 'state' ? { state: area.state } : { state: area.state, county: area.county };
        try {
          const trendData = await requestDataset(service, params, { signal });
          if (isStale()) return;
          cache.set(key, trendData);
        } catch (error) {
          // Superseded by a newer selection -- nothing to cache or render;
          // the newer call already has its own request in flight.
          if (error?.name === 'AbortError') return;
          if (isStale()) return;
          cache.set(key, { yearly: [], monthly: [] });
        }
      }
    }

    if (isStale()) return;
    renderTrend();
  };

  const trendRangeTabs = document.querySelectorAll('#national-range-tabs .chart-range-tab');
  trendRangeTabs.forEach((tab) => {
    const isActive = tab.dataset.range === state.trend.activeTrendRange;
    tab.setAttribute('aria-selected', String(isActive));
    tab.setAttribute('tabindex', isActive ? '0' : '-1');
  });

  // Roving tabindex: only the active tab is in the tab order.
  const setTrendRange = (range, { moveFocus = false, announce = true } = {}) => {
    const tab = Array.from(trendRangeTabs).find((entry) => entry.dataset.range === range);
    if (!tab) return;
    state.trend.activeTrendRange = range;
    trendRangeTabs.forEach((t) => {
      t.setAttribute('aria-selected', String(t === tab));
      t.setAttribute('tabindex', t === tab ? '0' : '-1');
    });
    if (moveFocus) tab.focus();
    syncOverlayControls();
    renderTrend();
    document.dispatchEvent(new CustomEvent('dashboard:rangechange', { detail: { announce } }));
  };
  state.trend.setRange = setTrendRange;

  trendRangeTabs.forEach((tab, i) => {
    tab.setAttribute('tabindex', i === 0 ? '0' : '-1');

    tab.addEventListener('click', () => setTrendRange(tab.dataset.range, { moveFocus: true }));

    tab.addEventListener('keydown', (e) => {
      const tabs = Array.from(trendRangeTabs);
      const idx = tabs.indexOf(tab);
      let next = -1;
      if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabs.length - 1;
      if (next >= 0) {
        e.preventDefault();
        setTrendRange(tabs[next].dataset.range, { moveFocus: true });
      }
    });
  });

  const overlayRangeTabs = document.querySelectorAll('#trend-overlay-range .chart-range-tab');
  overlayRangeTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      state.trend.activeTrendRange = tab.dataset.range;
      trendRangeTabs.forEach((t) =>
        t.setAttribute('aria-selected', String(t.dataset.range === state.trend.activeTrendRange)),
      );
      syncOverlayControls();
      renderTrend();
    });
  });

  const overlayTypeBtns = document.querySelectorAll('#trend-overlay-types [data-view]');
  overlayTypeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.trend.overlayTrendView = btn.dataset.view;
      syncOverlayControls();
      renderTrendOverlay();
    });
  });

  observeResize('#chartsView', renderTrend);
  observeResize('#trend-overlay-body', () => {
    if (state.trend.trendOverlayOpen) renderTrendOverlay();
  });

  // ---- Mobile trend-card carousel (line chart / bar placeholder / grid)
  // Independent of activeTrendRange(yearly/monthly)/activeDashboardType

  const trendCarouselTrack = document.querySelector('#chartsView');
  const trendPanels = Array.from(document.querySelectorAll('#chartsView > .trend-panel'));
  const trendDots = Array.from(
    document.querySelectorAll('#trend-carousel-dots .trend-carousel-dot'),
  );

  const trendPanelFor = (view) => trendPanels.find((panel) => panel.dataset.view === view);

  const setActiveTrendDot = (view) => {
    trendDots.forEach((dot) => dot.setAttribute('aria-pressed', String(dot.dataset.view === view)));
  };

  const scrollToTrendView = (view, behavior = 'smooth') => {
    const panel = trendPanelFor(view);
    if (!panel || !trendCarouselTrack) return;
    trendCarouselTrack.scrollTo({ left: panel.offsetLeft, behavior });
  };

  trendDots.forEach((dot) => {
    dot.addEventListener('click', () => {
      state.trend.activeTrendView = dot.dataset.view;
      setActiveTrendDot(state.trend.activeTrendView);
      scrollToTrendView(state.trend.activeTrendView);
    });
  });

  // Keeps dots in sync when the user swipes instead of clicking a dot.
  // Passive: never calls preventDefault, so it can't interfere with the
  // native scroll-snap touch gesture.
  if (trendCarouselTrack && trendPanels.length) {
    trendCarouselTrack.addEventListener(
      'scroll',
      () => {
        const { scrollLeft } = trendCarouselTrack;
        const closest = trendPanels.reduce((best, panel) =>
          Math.abs(panel.offsetLeft - scrollLeft) < Math.abs(best.offsetLeft - scrollLeft)
            ? panel
            : best,
        );
        if (closest.dataset.view !== state.trend.activeTrendView) {
          state.trend.activeTrendView = closest.dataset.view;
          setActiveTrendDot(state.trend.activeTrendView);
        }
      },
      { passive: true },
    );
  }

  const trendOverlayEls = makeOverlayEls('trend'); // tabsSlot resolves to null (no tabs-slot markup) and is unused

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

  // ---- Desktop "expand" overlay for the trend card. No reparenting — the
  // body is static placeholder markup baked into trend-card.njk, so this
  // popup needs no onOpen/onClose hooks. ----

  const trendOverlayPopup = createPopup({
    scrim: trendOverlayEls.scrim,
    panel: trendOverlayEls.panel,
    trigger: trendOverlayEls.trigger,
    bodyLockClass: 'data-grid-overlay-open',
    focusOnOpen: () => trendOverlayEls.closeBtn?.focus(),
    onBeforeOpen: () => {
      state.popups.closeDrawer();
      state.popups.closeCountyDrawer();
      state.popups.closeOverlay();
    },
    onOpen: () => {
      state.trend.trendOverlayOpen = true;
      syncOverlayControls();
      requestAnimationFrame(renderTrendOverlay);
    },
    onClose: () => {
      state.trend.trendOverlayOpen = false;
    },
  });
  const openTrendOverlay = trendOverlayPopup.open;
  state.popups.closeTrendOverlay = trendOverlayPopup.close;

  if (trendOverlayEls.trigger) {
    trendOverlayEls.trigger.addEventListener('click', openTrendOverlay);
    trendOverlayEls.closeBtn?.addEventListener('click', state.popups.closeTrendOverlay);
    trendOverlayEls.scrim?.addEventListener('click', state.popups.closeTrendOverlay);
  }

  // ---- Mobile-only bottom-sheet drawer for the trend data table
  // (carousel page 3). No search/thead-row/tbody fields from makeDrawerEls
  // are used -- renderTrendGrid() calls renderTable() directly instead of
  // the state/county drawers' bespoke sortable-head/row renderer. ----

  const trendDrawerEls = makeDrawerEls('trend');

  const trendDrawerPopup = createPopup({
    scrim: trendDrawerEls.overlay,
    panel: trendDrawerEls.panel,
    trigger: trendDrawerEls.trigger,
    bodyLockClass: 'data-grid-drawer-open',
    focusOnOpen: () => trendDrawerEls.closeBtn?.focus(),
    onBeforeOpen: () => {
      state.popups.closeDrawer();
      state.popups.closeCountyDrawer();
    },
    onOpen: () => {
      state.trend.trendDrawerOpen = true;
      renderTrendDrawer();
    },
    onClose: () => {
      state.trend.trendDrawerOpen = false;
    },
  });
  const openTrendDrawer = trendDrawerPopup.open;
  state.popups.closeTrendDrawer = trendDrawerPopup.close;

  if (trendDrawerEls.trigger) {
    trendDrawerEls.trigger.addEventListener('click', openTrendDrawer);
    trendDrawerEls.closeBtn?.addEventListener('click', state.popups.closeTrendDrawer);
    trendDrawerEls.overlay?.addEventListener('click', state.popups.closeTrendDrawer);
  }

  return { showTrendForScope };
}
