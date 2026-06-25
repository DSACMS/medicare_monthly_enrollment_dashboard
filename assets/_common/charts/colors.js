/**
 * WCAG AA–compliant palette sourced from client/css/styles.css custom properties.
 * All line/bar fills meet ≥ 3:1 contrast against #ffffff; axis text meets ≥ 4.5:1 on #f8f9fa.
 */
export const CHART_COLORS = {
  primary: '#013b63',   // --cms-dark-blue
  secondary: '#941f2e', // --cms-dark-red
  tertiary: '#015390',  // --cms-blue
  accent: '#961d56',    // --cms-magenta
  axis: '#323a45',      // --gray-dark
  grid: '#d6d7d9',      // --gray
};

export const SERIES_COLORS = {
  ffs: '#b85c7e',
  ma: '#6a4c93',
  total: '#1b1b1b',
};

export const LINE_STYLES = [
  { dash: null, marker: 'circle' },
  { dash: null, marker: 'circle' },
  { dash: null, marker: 'circle' },
];

export const BAR_FILLS = [
  { fill: SERIES_COLORS.ffs, pattern: null },
  { fill: SERIES_COLORS.ma, pattern: null },
];
