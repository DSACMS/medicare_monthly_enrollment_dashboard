import * as d3 from 'd3';
import { CHART_COLORS, BAR_FILLS } from './colors';
import renderSrTable from './accessibility';
import {
  appendChartSvg,
  getChartSize,
  formatPeriod,
  createTooltip,
  moveTooltip,
} from './utils';

const formatCount = d3.format(',');

/**
 * Renders a stacked bar chart showing percent-of-total enrollment trends (0–100%).
 *
 * @param {string} selector - DOM container selector
 * @param {Array}  data      - Enrollment data rows (pre-sorted ascending)
 * @param {Object} config
 * @param {Array}  config.segments  - [{ key, label, color? }]
 * @param {Function} [config.xAccessor]
 * @param {string} config.yLabel
 * @param {string} config.xLabel
 * @param {string} config.title
 * @param {Array}  config.tableColumns
 */
function renderStackedBarChart(selector, data, config) {
  const container = d3.select(selector);
  container.html('');

  if (!data || data.length === 0) return;

  const {
    segments,
    xAccessor = formatPeriod,
    yLabel,
    xLabel,
    title,
    tableColumns,
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
  const xScale = d3
    .scaleBand()
    .domain(xLabels)
    .range([0, innerWidth])
    .padding(0.2);

  const yScale = d3.scaleLinear().domain([0, 100]).range([innerHeight, 0]);

  const stack = d3
    .stack()
    .keys(segments.map((s) => s.key))
    .value((d, key) => d[key] || 0);

  const stackedData = stack(data);

  g.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale))
    .selectAll('text')
    .attr('fill', CHART_COLORS.axis)
    .attr('transform', rotateLabels ? 'rotate(-35)' : null)
    .style('text-anchor', rotateLabels ? 'end' : 'middle')
    .style('font-size', '13px');

  g.append('g')
    .call(d3.axisLeft(yScale).ticks(5).tickFormat((d) => `${d}%`))
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

  stackedData.forEach((layerData, i) => {
    const seg = segments[i];
    const style = BAR_FILLS[i % BAR_FILLS.length];
    const color = seg.color || style.fill;

    g.append('g')
      .selectAll('rect')
      .data(layerData)
      .enter()
      .append('rect')
      .attr('x', (d) => xScale(xAccessor(d.data)))
      .attr('y', (d) => yScale(d[1]))
      .attr('height', (d) => yScale(d[0]) - yScale(d[1]))
      .attr('width', xScale.bandwidth())
      .attr('fill', color)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.5)
      .on('mouseenter', (event, d) => {
        d3.select(event.currentTarget).attr('fill-opacity', 0.65);
        const row = d.data;
        tooltip
          .style('opacity', 1)
          .html(
            `<div class="chart-tooltip__row"><span class="chart-tooltip__label">${xLabel}</span><span>${xAccessor(row)}</span></div>`
              + `<div class="chart-tooltip__row"><span class="chart-tooltip__label">${seg.label}</span><span>${formatCount(row[seg.countKey] || 0)}</span></div>`
              + `<div class="chart-tooltip__row chart-tooltip__row--spaced"><span class="chart-tooltip__label">Percent Contribution</span><span>${Number(row[seg.key] || 0).toFixed(2)}%</span></div>`,
          );
        moveTooltip(tooltip, container.node(), event);
      })
      .on('mousemove', (event) => moveTooltip(tooltip, container.node(), event))
      .on('mouseleave', (event) => {
        d3.select(event.currentTarget).attr('fill-opacity', 1);
        tooltip.style('opacity', 0);
      });
  });

  const legend = svg
    .append('g')
    .attr('transform', `translate(${width - margin.right + 12},${margin.top})`);

  segments.forEach((seg, i) => {
    const style = BAR_FILLS[i % BAR_FILLS.length];
    const color = seg.color || style.fill;
    const row = legend.append('g').attr('transform', `translate(0,${i * 22})`);

    row
      .append('rect')
      .attr('width', 16)
      .attr('height', 16)
      .attr('fill', style.pattern === 'hatch' ? `url(#pattern-${seg.key})` : color)
      .attr('stroke', CHART_COLORS.axis)
      .attr('stroke-width', 0.5);

    row
      .append('text')
      .attr('x', 22)
      .attr('y', 12)
      .attr('fill', CHART_COLORS.axis)
      .style('font-size', '12px')
      .text(seg.label);
  });

  renderSrTable(container, title, tableColumns, data);
}

export default renderStackedBarChart;
