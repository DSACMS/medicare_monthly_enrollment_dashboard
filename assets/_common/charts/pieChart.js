import * as d3 from 'd3';
import { CHART_COLORS } from './colors';
import renderSrTable from './accessibility';

// Default colors used if the caller doesn't supply both colors for the two slices.
const DEFAULT_COLORS = [CHART_COLORS.primary, CHART_COLORS.secondary];

// The circle's diameter. Its container lays the circle out in a real CSS
// grid alongside its two value labels (see .pie-chart-inner in
// custom-styles.scss: grid-template-columns: 1fr auto 1fr), so this is the
// only size this module needs — the overall width is however much room
// that label/circle/label grid takes, not a guessed SVG pixel width.
const DEFAULT_HEIGHT = 275;

/**
 * Draws the colored arcs (slices) of the donut chart, with a hover tooltip per slice.
 * @param {d3.Selection} svg - the SVG selection to draw into.
 * @param {Object[]} pieData - output of d3.pie()(data), i.e. data with computed angles.
 * @param {Function} arc - a configured d3.arc() generator.
 * @param {string[]} colors - hex colors, indexed to match pieData order.
 */

function drawArcs(svg, pieData, arc, colors) {
  svg.append('g')
    .selectAll('path')
    .data(pieData)
    .join('path')
    .attr('fill', (d, i) => colors[i])
    .attr('d', arc)
    .append('title') // adding "title" allows the labeling to appear when hovering over
    .text(d => `${d.data.name}: ${Math.round(d.data.value)}%`);
}

/**
 * Draws the centered total-enrollment text inside the donut hole.
 * @param {d3.Selection} svg - the SVG selection to draw into.
 * @param {string|number} enrollmentInMillions - total enrollment, already converted to millions.
 */

function drawCenterText(svg, enrollmentInMillions) {
  const centerText = svg.append('text')
    .attr('class', 'pie-chart-text')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle');
  centerText.append('tspan')
    .attr('x', 0)
    .attr('y', '-0.2em')
    .attr('font-weight', 'bold')
    .attr('font-size', 40)
    .text(`${enrollmentInMillions}M`);
  centerText.append('tspan')
    .attr('x', 0)
    .attr('y', '1em')
    .attr('font-weight', 'bold')
    .attr('font-size', 20)
    .text('Total Enrollment*');
  centerText.append('title')
    .text(`Total Enrollment: ${enrollmentInMillions} Million`);
}

/**
 * Renders one side value label ("FFS: 28.4M" / "(62% of total)") as plain
 * HTML rather than positioned SVG text, so it becomes a real CSS grid
 * column (see .pie-chart-label) instead of a hand-computed x-offset.
 * @param {d3.Selection} parent - the column <div> to render into.
 * @param {Object} datum - one entry from d3.pie()(data).
 * @param {string|number} enrollmentInMillions - total enrollment, already converted to millions.
 */

function renderValueLabel(parent, datum, enrollmentInMillions) {
  parent.append('span')
    .attr('class', 'pie-chart-label__line')
    .text(`${datum.data.name}: ${((datum.data.value / 100) * enrollmentInMillions).toFixed(1)}M`);
  parent.append('span')
    .attr('class', 'pie-chart-label__line')
    .text(`(${Math.round(datum.data.value)}% of total)`);
}

/**
 * Renders a two-slice donut chart with center total text, side labels, and a
 * visually-hidden accessible data table (see accessibility.js / renderSrTable).
 * NOTE: this function assumes exactly 2 data points.
 *
 * @param {string} containerSelector - CSS selector for the chart's container element.
 * @param {{name: string, value: number}[]} data - exactly two items.
 * @param {number} totalEnrollment - raw total enrollment count (not in millions).
 * @param {Object} [config]
 * @param {string[]} [config.colors] - two hex colors, indexed to match `data` order.
 *   Falls back to DEFAULT_COLORS if omitted or incomplete.
 * @param {number} [config.height] - diameter of the circle in px. Defaults to DEFAULT_HEIGHT.
 * @param {string} [config.title] - Accessible name for the chart; used as the
 *   sr-only table's <caption>. Falls back to containerSelector if omitted.
 * @param {{label: string, value: Function}[]} [config.tableColumns] - Column
 *   definitions for the sr-only table, same shape as renderLineChart's
 *   config.tableColumns: value(row) returns that column's cell text for a
 *   given data item. Falls back to a basic Name/Percent table if omitted.
 */

function renderPieChart(containerSelector, data, totalEnrollment, config = {}) {
  if (!data?.length) {
    console.warn('renderPieChart: no data provided, skipping render.');
    return;
  }
  if (!totalEnrollment) {
    console.warn('renderPieChart: totalEnrollment is missing or zero.');
  }

  const {
    colors,
    height = DEFAULT_HEIGHT,
    title = containerSelector,
    tableColumns = [
      { label: 'Category', value: (d) => d.name },
      { label: 'Percent of total', value: (d) => `${Math.round(d.value)}%` },
    ],
  } = config;

  // Fall back to default colors if colors weren't passed in, or don't cover both slices.
  const resolvedColors = (colors && colors.length >= data.length) ? colors : DEFAULT_COLORS;

  const radius = height / 2;
  const innerRadius = radius * 0.7;
  const enrollmentInMillions = (totalEnrollment / 1000000).toFixed(1);

  // Cleared first so re-rendering into the same container (e.g. a future
  // data refresh) doesn't stack duplicate label/svg elements.
  const container = d3.select(containerSelector);
  container.html('');

  const inner = container.append('div').attr('class', 'pie-chart-inner');

  const pie = d3.pie()
      .sort(null)
      .value(d => d.value);
  const pieData = pie(data);

  // NOTE: with 2 slices and no custom startAngle, d3.pie() sweeps clockwise
  // from 12 o'clock, so index 0 lands on the right half of the donut and
  // index 1 lands on the left half. Each label is placed in the grid
  // column matching its slice's actual side.
  renderValueLabel(
    inner.append('div').attr('class', 'pie-chart-label'),
    pieData[1],
    enrollmentInMillions,
  );

  const chartHost = inner.append('div').attr('class', 'pie-chart-svg-host');

  renderValueLabel(
    inner.append('div').attr('class', 'pie-chart-label'),
    pieData[0],
    enrollmentInMillions,
  );

  // By adjusting the innerRadius you can change the width of the circle
  const arc = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(radius - 1);
  // Creation and centering of the SVG where D3 will draw
  const svg = chartHost.append('svg')
      .attr('width', height)
      .attr('height', height)
      .attr('viewBox', [-radius, -radius, height, height]);

  drawArcs(svg, pieData, arc, resolvedColors);
  drawCenterText(svg, enrollmentInMillions);

  // Visually-hidden table mirroring the chart's data, for screen readers.
  renderSrTable(container, title, tableColumns, data);
}

export default renderPieChart;
