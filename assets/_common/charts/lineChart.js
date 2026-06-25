import * as d3 from 'd3';
import { CHART_COLORS, LINE_STYLES } from './colors';
import renderSrTable from './accessibility';
import {
  appendChartSvg,
  getChartSize,
  formatPeriod,
  createTooltip,
  moveTooltip,
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
    yTickFormat = formatCount,
  } = config;

  const { width, height, margin, innerWidth, innerHeight } = getChartSize(
    container.node(),
  );

  const tooltip = createTooltip(container);
  const { svg } = appendChartSvg(container, width, height, title);
  const g = svg
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const xLabels = data.map(xAccessor);
  const rotateLabels = xLabels.some((label) => String(label).length > 6);
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
    .attr('transform', rotateLabels ? 'rotate(-35)' : null)
    .style('text-anchor', rotateLabels ? 'end' : 'middle')
    .style('font-size', '13px');

  g.append('g')
    .call(d3.axisLeft(yScale).ticks(6).tickFormat(yTickFormat))
    .selectAll('text')
    .attr('fill', CHART_COLORS.axis)
    .style('font-size', '13px');

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerHeight / 2)
    .attr('y', -60)
    .attr('text-anchor', 'middle')
    .attr('fill', CHART_COLORS.axis)
    .style('font-size', '15px')
    .style('font-weight', '600')
    .text(yLabel);

  g.append('text')
    .attr('x', innerWidth / 2)
    .attr('y', innerHeight + 48)
    .attr('text-anchor', 'middle')
    .attr('fill', CHART_COLORS.axis)
    .style('font-size', '15px')
    .style('font-weight', '600')
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

  const hoverRing = g
    .append('circle')
    .attr('r', 7)
    .attr('fill', 'none')
    .attr('stroke-width', 2)
    .style('opacity', 0)
    .style('pointer-events', 'none');

  series.forEach((s, i) => {
    const color = s.color || (i === 0 ? CHART_COLORS.primary : CHART_COLORS.secondary);

    g.append('g')
      .selectAll('circle')
      .data(data)
      .enter()
      .append('circle')
      .attr('cx', (d) => xScale(xAccessor(d)))
      .attr('cy', (d) => yScale(d[s.key] || 0))
      .attr('r', 12)
      .attr('fill', 'transparent')
      .on('mouseenter', (event, d) => {
        hoverRing
          .attr('cx', xScale(xAccessor(d)))
          .attr('cy', yScale(d[s.key] || 0))
          .attr('stroke', color)
          .style('opacity', 1);
        tooltip
          .style('opacity', 1)
          .html(
            `<div class="chart-tooltip__row"><span class="chart-tooltip__label">${xLabel}</span><span>${xAccessor(d)}</span></div>`
              + `<div class="chart-tooltip__row"><span class="chart-tooltip__label">${s.label}</span><span>${formatCount(d[s.key] || 0)}</span></div>`,
          );
        moveTooltip(tooltip, container.node(), event);
      })
      .on('mousemove', (event) => moveTooltip(tooltip, container.node(), event))
      .on('mouseleave', () => {
        hoverRing.style('opacity', 0);
        tooltip.style('opacity', 0);
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