/**
 * URL state synchronization for the Medicare Enrollment Dashboard.
 * Reads/writes URL search params and dispatches custom events to keep
 * the dashboard state in sync with the browser address bar.
 */

export function readParams() {
  const params = new URLSearchParams(window.location.search);
  const result = {};
  const type = params.get('type');
  if (type && ['hospital', 'drug'].includes(type)) result.activeDashboardType = type;
  const state = params.get('state');
  if (state) result.selectedStateAbbr = state;
  const county = params.get('county');
  if (county) result.selectedCounty = county;
  const range = params.get('range');
  if (range && ['yearly', 'monthly'].includes(range)) result.activeTrendRange = range;
  const view = params.get('view');
  if (view && ['line', 'bar', 'grid'].includes(view)) result.activeTrendView = view;
  return result;
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
  const qs = params.toString();
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState(null, '', url);
}

export function initUrlSync(state) {
  const initial = readParams();

  if (initial.activeDashboardType) {
    state.activeDashboardType = initial.activeDashboardType;
  }
  if (initial.activeTrendRange) {
    state.trend.activeTrendRange = initial.activeTrendRange;
  }
  if (initial.activeTrendView) {
    state.trend.activeTrendView = initial.activeTrendView;
  }

  document.addEventListener('dashboard:typechange', () => writeParams(state));
  document.addEventListener('dashboard:statechange', () => writeParams(state));
  document.addEventListener('dashboard:stateclear', () => writeParams(state));
  document.addEventListener('dashboard:countychange', () => writeParams(state));
  document.addEventListener('dashboard:rangechange', () => writeParams(state));
  document.addEventListener('dashboard:viewchange', () => writeParams(state));

  window.addEventListener('popstate', () => {
    const params = readParams();
    if (params.activeDashboardType && params.activeDashboardType !== state.activeDashboardType) {
      document.dispatchEvent(new CustomEvent('dashboard:typechange', {
        detail: { type: params.activeDashboardType }
      }));
    }
    if (params.selectedStateAbbr) {
      document.dispatchEvent(new CustomEvent('dashboard:statechange', {
        detail: { state: params.selectedStateAbbr }
      }));
      if (params.selectedCounty) {
        document.dispatchEvent(new CustomEvent('dashboard:countychange', {
          detail: { county: params.selectedCounty }
        }));
      }
    } else if (!params.selectedStateAbbr && state.selectedState) {
      document.dispatchEvent(new CustomEvent('dashboard:stateclear'));
    }
  });

  writeParams(state);

  return { initial };
}
