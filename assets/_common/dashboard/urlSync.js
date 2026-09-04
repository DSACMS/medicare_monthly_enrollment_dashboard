/**
 * URL state synchronization for the Medicare Enrollment Dashboard.
 * Reads/writes URL search params and dispatches custom events to keep
 * the dashboard state in sync with the browser address bar.
 */

export function readParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    type: params.get('type'),
    state: params.get('state'),
    county: params.get('county'),
    range: params.get('range'),
    view: params.get('view'),
    table: params.get('table'),
  };
}

export function writeParams(state) {
  const params = new URLSearchParams();
  if (state.activeDashboardType && state.activeDashboardType !== 'hospital') {
    params.set('type', state.activeDashboardType);
  }
  if (state.selectedState) {
    params.set('state', state.selectedState.state);
  }
  if (state.selectedCounty && state.selectedState) {
    params.set('county', state.selectedCounty);
  }
  if (state.trend?.activeTrendRange && state.trend.activeTrendRange !== 'yearly') {
    params.set('range', state.trend.activeTrendRange);
  }
  if (state.trend?.activeTrendView && state.trend.activeTrendView !== 'line') {
    params.set('view', state.trend.activeTrendView);
  }
  if (state.grid?.activeView && state.grid.activeView !== 'state') {
    params.set('table', state.grid.activeView);
  }
  const qs = params.toString();
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState(null, '', url);
}

export function initUrlSync(state) {
  const initial = readParams();

  if (initial.type) {
    state.activeDashboardType = initial.type;
    state.trend.activeTrendType = initial.type;
  }
  if (initial.range) {
    state.trend.activeTrendRange = initial.range;
  }
  if (initial.view) {
    state.trend.activeTrendView = initial.view;
  }
  if (initial.table) {
    state.grid.activeView = initial.table;
  }

  // Defer writes so all other event handlers update state first
  const scheduleWrite = () => setTimeout(() => writeParams(state), 0);

  document.addEventListener('dashboard:typechange', scheduleWrite);
  document.addEventListener('dashboard:statechange', scheduleWrite);
  document.addEventListener('dashboard:stateclear', scheduleWrite);
  document.addEventListener('dashboard:countychange', scheduleWrite);
  document.addEventListener('dashboard:rangechange', scheduleWrite);
  document.addEventListener('dashboard:viewchange', scheduleWrite);
  document.addEventListener('dashboard:tablechange', scheduleWrite);

  window.addEventListener('popstate', () => {
    const params = readParams();
    const options = { source: 'url', moveFocus: false, announce: false };
    if (params.type && params.type !== state.activeDashboardType) {
      document.dispatchEvent(
        new CustomEvent('dashboard:typechange', {
          detail: { type: params.type, ...options },
        }),
      );
    }
    if (params.state) {
      document.dispatchEvent(
        new CustomEvent('dashboard:statechange', {
          detail: { state: params.state, ...options },
        }),
      );
      if (params.county) {
        document.dispatchEvent(
          new CustomEvent('dashboard:countychange', {
            detail: { county: params.county, ...options },
          }),
        );
      }
    } else if (!params.state && state.selectedState) {
      document.dispatchEvent(new CustomEvent('dashboard:stateclear', { detail: options }));
    }
    if (params.range && params.range !== state.trend.activeTrendRange) {
      state.trend.setRange?.(params.range, options);
    }
    if (params.view && params.view !== state.trend.activeTrendView) {
      state.trend.activeTrendView = params.view;
      document.dispatchEvent(new CustomEvent('dashboard:viewchange', { detail: options }));
    }
    if (params.table && params.table !== state.grid.activeView) {
      state.grid.setActiveView?.(params.table, options);
    }
  });

  writeParams(state);

  return { initial };
}
