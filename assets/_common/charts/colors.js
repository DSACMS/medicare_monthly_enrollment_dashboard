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

export const LINE_STYLES = [
  { dash: null, marker: 'circle' },
  { dash: '8 4', marker: 'triangle' },
  { dash: '2 3', marker: 'square' },
];

export const BAR_FILLS = [
  { fill: CHART_COLORS.primary, pattern: null },
  { fill: CHART_COLORS.secondary, pattern: 'hatch' },
];
