/** @jest-environment jsdom */

import { renderEnrollmentHero } from '../charts/index';
import initHeroCard from './hero';

jest.mock('../charts/index', () => ({ renderEnrollmentHero: jest.fn() }));

describe('hero dashboard type synchronization', () => {
  test('rerenders when dashboard:typechange comes from the controller', () => {
    document.body.innerHTML = `
      <section id="medicare-enrollment-hero"></section>
      <button class="dashboard-type-button" data-dashboard-type="hospital"></button>
      <button class="dashboard-type-button" data-dashboard-type="drug"></button>
    `;
    const yearly = [
      {
        year: '2024',
        totalEnrollees: 100,
        omPercent: 40,
        maPercent: 60,
        drugTotal: 90,
        pdpPercent: 30,
        mapdPercent: 70,
      },
    ];

    initHeroCard(yearly);
    document.dispatchEvent(
      new CustomEvent('dashboard:typechange', { detail: { type: 'drug', source: 'webmcp' } }),
    );

    expect(renderEnrollmentHero).toHaveBeenCalledTimes(2);
    expect(
      document.querySelector('[data-dashboard-type="drug"]').getAttribute('aria-pressed'),
    ).toBe('true');
  });
});
