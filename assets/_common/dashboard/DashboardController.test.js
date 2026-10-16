/** @jest-environment jsdom */

import DashboardController from './DashboardController';

function createState() {
  return {
    activeDashboardType: 'hospital',
    selectedState: null,
    selectedCounty: null,
    mapConfigs: { hospital: { selector: '#map', options: { comboBoxSelector: '#selector' } } },
    grid: {
      activeView: 'state',
      allStatesRows: [{ state: 'PR', stateName: 'Puerto Rico' }],
      currentCountyRows: [{ fips: '72001', county: 'Adjuntas' }],
      setActiveView: jest.fn(),
    },
    trend: { activeTrendRange: 'yearly', setRange: jest.fn() },
  };
}

describe('DashboardController', () => {
  test('uses the native state selector and defaults agent actions to no focus movement', () => {
    document.body.innerHTML =
      '<select id="selector"><option>Puerto Rico</option></select><div id="status"></div>';
    const state = createState();
    const controller = new DashboardController({
      state,
      statusElement: document.querySelector('#status'),
    });
    const onChange = jest.fn();
    document.querySelector('#selector').addEventListener('change', onChange);

    controller.selectState('PR');

    expect(onChange.mock.calls[0][0].detail).toEqual({
      source: 'webmcp',
      moveFocus: false,
      announce: true,
    });
    expect(document.querySelector('#selector').value).toBe('Puerto Rico');
  });

  test('delegates trend and table changes without mutating state directly', () => {
    const state = createState();
    const controller = new DashboardController({ state, statusElement: null });

    controller.setTrendRange('monthly', { source: 'human' });
    controller.showTable('county', { source: 'url' });

    expect(state.trend.setRange).toHaveBeenCalledWith('monthly', {
      source: 'human',
      moveFocus: true,
      announce: true,
    });
    expect(state.grid.setActiveView).toHaveBeenCalledWith('county', {
      source: 'url',
      moveFocus: false,
      announce: false,
    });
  });

  test('announces state changes unless the caller suppresses announcements', () => {
    jest.useFakeTimers();
    document.body.innerHTML = '<div id="status"></div>';
    const state = createState();
    state.selectedState = { state: 'PR', stateName: 'Puerto Rico' };
    const controller = new DashboardController({
      state,
      statusElement: document.querySelector('#status'),
    });

    document.dispatchEvent(
      new CustomEvent('dashboard:statechange', { detail: { announce: true } }),
    );
    jest.runAllTimers();
    expect(document.querySelector('#status').textContent).toBe('Puerto Rico selected.');

    controller.clearGeography({ source: 'url' });
    jest.runAllTimers();
    expect(document.querySelector('#status').textContent).toBe('Puerto Rico selected.');
    jest.useRealTimers();
  });
});
