/* eslint-env jest */
import { ckmeans } from 'simple-statistics';
import { computeJenksBreaks } from './utils';

// utils.js imports d3 (ESM only) for chart helpers this test does not use
jest.mock('d3', () => ({}));

// Same rule as d3.scaleThreshold().domain(breaks): a value equal to a break
// goes to the class above it
const classOf = (value, breaks) => breaks.filter((b) => value >= b).length;

describe('computeJenksBreaks', () => {
  // MAPD % of the 50 states and DC, August 2026, as parseEnrollmentFields
  // computes it from the data.cms.gov Medicare Monthly Enrollment API
  const values = [
    2.52, 11.56, 16.63, 26.27, 28.19, 29.1, 33.57, 35.24, 35.98, 37.3, 37.33, 37.88, 38.06, 39.73,
    44.34, 47.13, 48.61, 49.16, 50.36, 52.27, 52.36, 52.51, 52.65, 52.85, 53.13, 54.77, 55.45,
    56.37, 56.91, 56.98, 57.0, 57.4, 58.02, 58.11, 58.82, 59.12, 59.5, 59.81, 60.1, 60.51, 61.14,
    61.3, 61.95, 63.63, 64.06, 64.19, 64.67, 64.68, 66.05, 67.52, 68.42,
  ];

  it('keeps every value in its natural-breaks class', () => {
    const breaks = computeJenksBreaks(values);

    ckmeans(values, 5).forEach((cluster, index) => {
      cluster.forEach((value) => expect(classOf(value, breaks)).toBe(index));
    });
  });

  it('breaks at the lowest value of each upper class', () => {
    expect(computeJenksBreaks(values)).toEqual([26.27, 44.34, 54.77, 61.95]);
  });
});
