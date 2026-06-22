import { CHART_COLORS } from './colors.js';
import { renderSrTable } from './accessibility.js';

// Default colors used if the caller doesn't supply both colors for the two slices.
const DEFAULT_COLORS = [CHART_COLORS.primary, CHART_COLORS.secondary];

/**
 * Draws the colored arcs (slices) of the donut chart, with a hover tooltip per slice.
 * @param {d3.Selection} svg - the SVG selection to draw into.
 * @param {Object[]} pieData - output of d3.pie()(data), i.e. data with computed angles.
 * @param {Function} arc - a configured d3.arc() generator.
 * @param {string[]} colors - hex colors, indexed to match pieData order.
 */

function drawArcs(svg, pieData, arc, colors) {
  svg.append("g")
    .selectAll("path")
    .data(pieData)
    .join("path")
    .attr("fill", (d, i) => colors[i])
    .attr("d", arc)
    .append("title") //adding "title" allows the labeling to appear when hovering over
    .text(d => `${d.data.name}: ${Math.round(d.data.value)}%`);
}

/**
 * Draws the centered total-enrollment text inside the donut hole.
 * @param {d3.Selection} svg - the SVG selection to draw into.
 * @param {string|number} enrollmentInMillions - total enrollment, already converted to millions.
 */

function drawCenterText(svg, enrollmentInMillions) {
  const centerText = svg.append("text")
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .attr("font-family", "sans-serif");
  centerText.append("tspan")
    .attr("x", 0)
    .attr("y", "-0.2em")
    .attr("font-weight", "bold")
    .attr("font-size", 60)
    .text(enrollmentInMillions + "M");
  centerText.append("tspan")
    .attr("x", 0)
    .attr("y", "1em")
    .attr("font-weight", "bold")
    .attr("font-size", 30)
    .text("Total Enrollment");
  centerText.append("title")
    .text(`Total Enrollment: ${enrollmentInMillions} Million`);
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
 * @param {string} [config.title] - Accessible name for the chart; used as the
 *   sr-only table's <caption>. Falls back to containerSelector if omitted.
 * @param {{label: string, value: Function}[]} [config.tableColumns] - Column
 *   definitions for the sr-only table, same shape as renderLineChart's
 *   config.tableColumns: value(row) returns that column's cell text for a
 *   given data item. Falls back to a basic Name/Percent table if omitted.
 */

export function renderPieChart(containerSelector, data, totalEnrollment, config = {}) {
  if (!data?.length) {
    console.warn("renderPieChart: no data provided, skipping render.");
    return;
  }
  if (!totalEnrollment) {
    console.warn("renderPieChart: totalEnrollment is missing or zero.");
  }

  const {
    colors,
    title = containerSelector,
    tableColumns = [
      { label: 'Category', value: (d) => d.name },
      { label: 'Percent of total', value: (d) => `${Math.round(d.value)}%` },
    ],
  } = config;

  // Fall back to default colors if colors weren't passed in, or don't cover both slices.
  const resolvedColors = (colors && colors.length >= data.length) ? colors : DEFAULT_COLORS;

  const width = 700;
  const height = 400;
  const radius = Math.min(width, height) / 2;
  const enrollmentInMillions = (totalEnrollment / 1000000).toFixed(1);
  const LABEL_OFFSET_X = 280;
  // NOTE: with 2 slices and no custom startAngle, d3.pie() sweeps clockwise
  // from 12 o'clock, so index 0 lands on the right half of the donut and
  // index 1 lands on the left half. This maps the label position to match
  // wherever the arc itself actually ends up (index 1 → left).
  const xPosition = (d, i) => (i === 1 ? -LABEL_OFFSET_X : LABEL_OFFSET_X);

  // Selected once and reused for both the SVG and the accessible sr-table
  // below, so the visual chart and its hidden table end up as siblings
  // inside the same container — matching the pattern in renderLineChart.
  const container = d3.select(containerSelector);

  //By adjusting the innerRadius you can change the width of the circle
  const arc = d3.arc()
      .innerRadius(radius * 0.7)
      .outerRadius(radius - 1);
  //Converts data into angles
  const pie = d3.pie()
      .sort(null)
      .value(d => d.value);
  //Creation and centering of the SVG where D3 will draw
  const svg = container
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [-width / 2, -height / 2, width, height]);

  const pieData = pie(data);
  drawArcs(svg, pieData, arc, resolvedColors);
  drawCenterText(svg, enrollmentInMillions);

  //The side texts are developed here
  svg.append("g")
    .selectAll("text")
    .data(pieData)
    .join("text")
    .attr("x", xPosition)
    .attr("y", 0)
    .attr("text-anchor", "middle")
    .call(text => {
      text.append("tspan")
        .attr("x", xPosition)
        .attr("font-weight", "bold")
        .attr("font-size", 19)
        .text(d =>
`${d.data.name}: ${((d.data.value / 100) * enrollmentInMillions).toFixed(1)}M`
        );
      text.append("tspan")
        .attr("x", xPosition)
        .attr("font-weight", "bold")
        .attr("font-size", 19)
        .attr("dy", "1.2em")
        .text(d => `(${Math.round(d.data.value)}% of total)`);
    });

  // Visually-hidden table mirroring the chart's data, for screen readers.
  renderSrTable(container, title, tableColumns, data);
}