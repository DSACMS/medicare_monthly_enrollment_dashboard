import { getCssVar } from './utils';

/**
 * WCAG AA–compliant palette sourced from client/css/styles.css custom properties.
 * All line/bar fills meet ≥ 3:1 contrast against #ffffff; axis text meets ≥ 4.5:1 on #f8f9fa.
 */
export const CHART_COLORS = {
  primary: '#013b63',   // --cms-dark-blue
  secondary: '#941f2e', // --cms-dark-red
  tertiary: '#015390',  // --cms-blue
  accent: '#961d56',    // --cms-magenta
};

export const SERIES_COLORS = {
  ffs: getCssVar('--ffs', '#961d56'),
  ma: getCssVar('--ma', '#7928c9'),
  total: getCssVar('--total', '#1b1b1b'),
};
