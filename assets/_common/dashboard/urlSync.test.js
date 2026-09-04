/** @jest-environment jsdom */

import { readParams, writeParams } from './urlSync';

describe('dashboard URL sync', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
    document.body.innerHTML = '';
  });

  it('reads the selected county from the URL query string', () => {
    window.history.pushState({}, '', '/?state=AZ&type=drug&county=La%20Paz&range=monthly');

    expect(readParams()).toEqual({
      type: 'drug',
      state: 'AZ',
      county: 'La Paz',
      range: 'monthly',
      view: null,
      table: null,
    });
  });

  it('writes the selected state and county back to the URL', () => {
    writeParams({
      activeDashboardType: 'hospital',
      selectedState: { state: 'AZ', stateName: 'Arizona' },
      selectedCounty: 'La Paz',
      grid: { activeView: 'state' },
      trend: { activeTrendRange: 'yearly', activeTrendView: 'line' },
    });

    expect(window.location.pathname).toBe('/');
    expect(window.location.search).toBe('?state=AZ&county=La+Paz');
  });
});
