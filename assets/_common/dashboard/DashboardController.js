const CONTROLLER_SOURCES = new Set(['human', 'url', 'webmcp']);

function eventOptions(options = {}) {
  const source = CONTROLLER_SOURCES.has(options.source) ? options.source : 'webmcp';
  return {
    source,
    moveFocus: options.moveFocus ?? source === 'human',
    announce: options.announce ?? source !== 'url',
  };
}

function dispatch(type, detail) {
  document.dispatchEvent(new CustomEvent(type, { detail }));
}

export default class DashboardController {
  constructor({ state, statusElement }) {
    this.state = state;
    this.statusElement = statusElement;
    document.addEventListener('dashboard:typechange', (event) => this.announceChange(event));
    document.addEventListener('dashboard:statechange', (event) => this.announceChange(event));
    document.addEventListener('dashboard:countychange', (event) => this.announceChange(event));
    document.addEventListener('dashboard:stateclear', (event) => this.announceChange(event));
    document.addEventListener('dashboard:rangechange', (event) => this.announceChange(event));
    document.addEventListener('dashboard:tablechange', (event) => this.announceChange(event));
  }

  setDashboardType(type, options) {
    if (!['hospital', 'drug'].includes(type)) throw new Error(`Unknown dashboard type '${type}'.`);
    dispatch('dashboard:typechange', { type, ...eventOptions(options) });
    return this.getSnapshot();
  }

  selectState(stateCode, options) {
    const row = this.state.grid.allStatesRows.find((entry) => entry.state === stateCode);
    if (!row) throw new Error(`Unknown state or territory '${stateCode}'.`);
    const selector = document.querySelector(
      this.state.mapConfigs[this.state.activeDashboardType].options.comboBoxSelector,
    );
    if (!selector) throw new Error('The active state selector is unavailable.');

    selector.value = row.stateName;
    selector.dispatchEvent(
      new CustomEvent('change', { bubbles: true, detail: eventOptions(options) }),
    );
    return this.getSnapshot();
  }

  selectCounty(stateCode, countyFips, options) {
    if (this.state.selectedState?.state !== stateCode) {
      throw new Error('Select the county state before selecting a county.');
    }
    const county = this.state.grid.currentCountyRows.find((entry) => entry.fips === countyFips);
    if (!county) throw new Error(`Unknown county or equivalent area '${countyFips}'.`);
    dispatch('dashboard:countyselect', {
      containerSelector: this.state.mapConfigs[this.state.activeDashboardType].selector,
      county: county.county,
      ...eventOptions(options),
    });
    return this.getSnapshot();
  }

  clearGeography(options) {
    dispatch('dashboard:stateclear', eventOptions(options));
    return this.getSnapshot();
  }

  setTrendRange(range, options) {
    if (!['yearly', 'monthly'].includes(range)) throw new Error(`Unknown trend range '${range}'.`);
    this.state.trend.setRange(range, eventOptions(options));
    return this.getSnapshot();
  }

  showTable(view, options) {
    if (!['state', 'county'].includes(view)) throw new Error(`Unknown table view '${view}'.`);
    this.state.grid.setActiveView(view, eventOptions(options));
    return this.getSnapshot();
  }

  getSnapshot() {
    return {
      dashboardType: this.state.activeDashboardType,
      state: this.state.selectedState?.state || null,
      county: this.state.selectedCounty || null,
      trendRange: this.state.trend.activeTrendRange,
      tableView: this.state.grid.activeView,
    };
  }

  announceChange(event) {
    if (!this.statusElement || event.detail?.announce === false) return;
    const messages = {
      'dashboard:typechange': `${this.state.activeDashboardType === 'drug' ? 'Prescription Drug' : 'Hospital and Medical'} dashboard selected.`,
      'dashboard:statechange': `${this.state.selectedState?.stateName || 'State'} selected.`,
      'dashboard:countychange': this.state.selectedCounty
        ? `${this.state.selectedCounty} selected.`
        : 'County selection cleared.',
      'dashboard:stateclear': 'National view selected.',
      'dashboard:rangechange': `${this.state.trend.activeTrendRange === 'monthly' ? 'Monthly' : 'Yearly'} trend selected.`,
      'dashboard:tablechange': `${this.state.grid.activeView === 'county' ? 'County' : 'State'} table selected.`,
    };
    const message = messages[event.type];
    if (!message) return;
    this.statusElement.textContent = '';
    window.setTimeout(() => {
      this.statusElement.textContent = message;
    }, 50);
  }
}
