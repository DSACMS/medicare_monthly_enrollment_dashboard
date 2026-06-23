import * as d3 from 'd3';
import { CHART_COLORS, LINE_STYLES } from './colors';
import renderSrTable from './accessibility';
import {
  appendChartSvg,
  getChartSize,
  formatPeriod,
} from './utils';


const formatCount = d3.format(',');

function drawMarker(g, type, x, y, color) {
  if (type === 'circle') {
    g.append('circle').attr('cx', x).attr('cy', y).attr('r', 4).attr('fill', color);
  } else if (type === 'triangle') {
    g.append('path')
      .attr('d', `M${x},${y - 5} L${x + 5},${y + 4} L${x - 5},${y + 4} Z`)
      .attr('fill', color);
  } else if (type === 'square') {
    g.append('rect')
      .attr('x', x - 4)
      .attr('y', y - 4)
      .attr('width', 8)
      .attr('height', 8)
      .attr('fill', color);
  }
}

/**
 * Renders a multi-series enrollment count line chart with y-axis origin at 0.
 *
 * @param {string} selector - DOM container selector
 * @param {Array}  data      - Enrollment data rows (pre-sorted ascending)
 * @param {Object} config
 * @param {Array}  config.series     - [{ key, label, color? }]
 * @param {Function} [config.xAccessor] - Row → x-axis label
 * @param {string} config.yLabel
 * @param {string} config.xLabel
 * @param {string} config.title       - Used for aria-label and sr-table caption
 * @param {Array}  config.tableColumns - [{ label, value(row) }] for sr table
 */
function renderLineChart(selector, data, config) {
  const container = d3.select(selector);
  container.html('');

  if (!data || data.length === 0) return;

  const {
    series,
    xAccessor = formatPeriod,
    yLabel,
    xLabel,
    title,
    tableColumns,
  } = config;

  const { width, height, margin, innerWidth, innerHeight } = getChartSize(
    container.node(),
  );

  const { svg } = appendChartSvg(container, width, height, title);
  const g = svg
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const xLabels = data.map(xAccessor);
  const xScale = d3.scalePoint().domain(xLabels).range([0, innerWidth]).padding(0.5);

  const yMax = d3.max(data, (d) => d3.max(series, (s) => d[s.key] || 0));
  const yScale = d3
    .scaleLinear()
    .domain([0, yMax])
    .nice()
    .range([innerHeight, 0]);

  g.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale))
    .selectAll('text')
    .attr('fill', CHART_COLORS.axis)
    .attr('transform', xLabels.length > 8 ? 'rotate(-35)' : null)
    .style('text-anchor', xLabels.length > 8 ? 'end' : 'middle');

  g.append('g')
    .call(d3.axisLeft(yScale).ticks(6).tickFormat(formatCount))
    .selectAll('text')
    .attr('fill', CHART_COLORS.axis);

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerHeight / 2)
    .attr('y', -60)
    .attr('text-anchor', 'middle')
    .attr('fill', CHART_COLORS.axis)
    .text(yLabel);

  g.append('text')
    .attr('x', innerWidth / 2)
    .attr('y', innerHeight + 48)
    .attr('text-anchor', 'middle')
    .attr('fill', CHART_COLORS.axis)
    .text(xLabel);

  g.selectAll('.grid-line')
    .data(yScale.ticks(6))
    .enter()
    .append('line')
    .attr('class', 'grid-line')
    .attr('x1', 0)
    .attr('x2', innerWidth)
    .attr('y1', (d) => yScale(d))
    .attr('y2', (d) => yScale(d))
    .attr('stroke', CHART_COLORS.grid)
    .attr('stroke-dasharray', '2,4');

  series.forEach((s, i) => {
    const style = LINE_STYLES[i % LINE_STYLES.length];
    const color = s.color || (i === 0 ? CHART_COLORS.primary : CHART_COLORS.secondary);

    const lineGenerator = d3
      .line()
      .x((d) => xScale(xAccessor(d)))
      .y((d) => yScale(d[s.key] || 0));

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 2.5)
      .attr('stroke-dasharray', style.dash || null)
      .attr('d', lineGenerator);

    const markerG = g.append('g').attr('class', `markers-${s.key}`);
    data.forEach((d) => {
      drawMarker(markerG, style.marker, xScale(xAccessor(d)), yScale(d[s.key] || 0), color);
    });
  });

  const legend = svg
    .append('g')
    .attr('transform', `translate(${width - margin.right + 12},${margin.top})`);

  series.forEach((s, i) => {
    const style = LINE_STYLES[i % LINE_STYLES.length];
    const color = s.color || (i === 0 ? CHART_COLORS.primary : CHART_COLORS.secondary);
    const row = legend.append('g').attr('transform', `translate(0,${i * 22})`);

    row
      .append('line')
      .attr('x1', 0)
      .attr('x2', 20)
      .attr('y1', 8)
      .attr('y2', 8)
      .attr('stroke', color)
      .attr('stroke-width', 2.5)
      .attr('stroke-dasharray', style.dash || null);

    drawMarker(row, style.marker, 10, 8, color);

    row
      .append('text')
      .attr('x', 28)
      .attr('y', 12)
      .attr('fill', CHART_COLORS.axis)
      .style('font-size', '12px')
      .text(s.label);
  });

  renderSrTable(container, title, tableColumns, data);
}

export default renderLineChart;