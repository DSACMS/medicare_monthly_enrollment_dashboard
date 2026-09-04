import { getMappableAreas } from '../../../src/geographicAreas';
import { computeJenksBreaks } from '../charts/utils';
import { renderStateMap } from '../charts/index';
import DASHBOARD_LABELS from '../labels';

// Only areas with geometry are mappable; territories without geometry are excluded
const mappableStateNames = new Set(getMappableAreas().map((area) => area.name));

const hospitalLabels = DASHBOARD_LABELS.hospitalMedical;
const drugLabels = DASHBOARD_LABELS.prescriptionDrug;

function buildMapConfigs() {
  return {
    hospital: {
      selector: '#medicare-enrollment-state-map',
      options: {
        title: hospitalLabels.screenReaderMapTitle,
        metricLabel: hospitalLabels.type1.label,
        metricPercent: (d) => d[hospitalLabels.type1.percentKey],
        metricCount: (d) => d[hospitalLabels.type1.key],
        comparisonLabel: hospitalLabels.type2.label,
        comparisonPercent: (d) => d[hospitalLabels.type2.percentKey],
        comparisonCount: (d) => d[hospitalLabels.type2.key],
        totalCount: (d) => d[hospitalLabels.total.key],
        colors: hospitalLabels.mapColors,
        comboBoxSelector: '#medicare-state-selector',
        backButtonSelector: '#medicare-map-back',
        histogramSelector: '#medicare-tier-histogram',
      },
    },
    drug: {
      selector: '#medicare-mapd-state-map',
      options: {
        title: drugLabels.screenReaderMapTitle,
        metricLabel: drugLabels.type1.label,
        metricPercent: (d) => d[drugLabels.type1.percentKey],
        metricCount: (d) => d[drugLabels.type1.key],
        colors: drugLabels.mapColors,
        comparisonLabel: drugLabels.type2.label,
        comparisonPercent: (d) => d[drugLabels.type2.percentKey],
        comparisonCount: (d) => d[drugLabels.type2.key],
        totalCount: (d) => d[drugLabels.total.key],
        comboBoxSelector: '#drug-state-selector',
        backButtonSelector: '#drug-map-back',
        histogramSelector: '#drug-tier-histogram',
      },
    },
  };
}

// Builds state.mapConfigs and assigns state.resetMapToNational (called by
// grid code -- selectStateFromGrid/clearSelectedState -- and by loadStateMap
// once state.grid.allStatesRows is populated). Also returns
// setMapPanelVisibility, which the .dashboard-type-button handler and the
// dashboard:typechange listener use to swap which map panel is visible.
export default function initMap(state) {
  state.mapConfigs = buildMapConfigs();

  const mapPanels = Array.from(document.querySelectorAll('.dashboard-map-panel'));

  const setMapPanelVisibility = (type) => {
    mapPanels.forEach((panel) => {
      const isActive = panel.dataset.mapDashboardType === type;
      panel.classList.toggle('is-active', isActive);
      panel.hidden = !isActive;
      panel.setAttribute('aria-hidden', String(!isActive));
    });
  };

  // Re-renders fresh (always national view), so switching type never
  // leaves a stale drilled-in county from before.
  state.resetMapToNational = (type) => {
    const config = state.mapConfigs[type];
    if (!config) return;

    const mappableRows = state.grid.allStatesRows.filter((row) =>
      mappableStateNames.has(row.stateName),
    );
    const values = mappableRows.map(config.options.metricPercent);
    config.options.breakpoints = computeJenksBreaks(values);
    // DC is mappable/clickable but isn't one of the 50 states
    // so it's excluded here only
    config.options.histogramData = mappableRows.filter(
      (row) => row.stateName !== 'District of Columbia',
    );

    renderStateMap(config.selector, state.grid.allStatesRows, config.options);
  };

  return { setMapPanelVisibility, mappableStateNames };
}
