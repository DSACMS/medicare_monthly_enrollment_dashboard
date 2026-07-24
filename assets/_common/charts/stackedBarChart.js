import * as d3 from 'd3';
import renderSrTable from './accessibility';
import {
  appendTrendFigure,
  buildLegendHtml,
  resolveLegendTarget,
  selectTickRows,
  formatPeriod,
  TREND_MARGIN,
} from './utils';

const BAR_MAX_WIDTH = 24;
const SEGMENT_GAP = 2;

const MARGIN = { ...TREND_MARGIN, right: 16 };

/**
 * Renders a stacked bar chart showing percent-of-total enrollment trends (0–100%).
 * Assumes exactly two segments: segments[0] stacks on the bottom (square),
 * segments[1] stacks on top (rounded top corners) — matches the mockup's MA/FFS split.
 *
 * @param {string} selector - DOM container selector
 * @param {Array}  data      - Enrollment data rows (pre-sorted ascending)
 * @param {Object} config
 * @param {Array}  config.segments  - [{ key, label, color? }]
 * @param {Function} [config.xAccessor]
 * @param {Function} [config.xTickFormat] - Row → short x-axis tick text
 * @param {string} config.title
 * @param {Array}  config.tableColumns
 * @param {string} [config.legendSelector] - External element to render the legend into
 */
function renderStackedBarChart(selector, data, config) {
  const container = d3.select(selector);
  container.html('');

  if (!data || data.length === 0) return;

  const {
    segments,
    xAccessor = formatPeriod,
    xTickFormat = xAccessor,
    title,
    tableColumns,
    legendSelector,
  } = config;

  const [bottom, top] = segments;
  const legendItems = [...segments].reverse().map((seg) => ({
    label: seg.label,
    color: seg.color,
    dashStyle: seg === bottom ? 'hatched' : undefined,
  }));
  resolveLegendTarget(container, legendSelector).html(buildLegendHtml(legendItems));

  const {
    svg, tooltip, width: W, height: H,
  } = appendTrendFigure(container, title);

  // Unique per render since multiple bar charts (card, overlay, mobile
  // carousel placeholders) can be in the DOM at once -- a shared/static id
  // would let one chart's pattern get hijacked by another's url(#id) ref.
  const hatchId = `hatch-${selector.replace(/[^a-zA-Z0-9]/g, '')}-${Math.random().toString(36).slice(2, 8)}`;
  const hatchPattern = svg.append('defs').append('pattern')
    .attr('id', hatchId)
    .attr('width', 6).attr('height', 6)
    .attr('patternUnits', 'userSpaceOnUse')
    .attr('patternTransform', 'rotate(45)');
  hatchPattern.append('rect').attr('width', 6).attr('height', 6).attr('fill', bottom.color).attr('fill-opacity', 0.18);
  hatchPattern.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 6).attr('stroke', bottom.color).attr('stroke-width', 3);

  const xLabels = data.map(xAccessor);
  const yScale = d3.scaleLinear().domain([0, 100]).range([H - MARGIN.bottom, MARGIN.top]);
  const xScale = d3.scalePoint().domain(xLabels).range([MARGIN.left, W - MARGIN.right]).padding(0.5);
  const barWidth = Math.min(BAR_MAX_WIDTH, xScale.step() * 0.72);
  const barX = (d) => xScale(xAccessor(d)) - barWidth / 2;

  yScale.ticks(5).forEach((t) => {
    svg.append('line')
      .attr('class', 'gridline')
      .attr('x1', MARGIN.left).attr('x2', W - MARGIN.right)
      .attr('y1', yScale(t)).attr('y2', yScale(t));
    svg.append('text')
      .attr('class', 'tick-txt')
      .attr('x', MARGIN.left - 8).attr('y', yScale(t))
      .attr('text-anchor', 'end').attr('dominant-baseline', 'middle')
      .text(`${t}%`);
  });

  const tickRows = selectTickRows(svg, data, xTickFormat, W - MARGIN.left - MARGIN.right);
  svg.append('g').selectAll('text')
    .data(tickRows)
    .join('text')
    .attr('class', 'tick-txt')
    .attr('x', (d) => barX(d) + barWidth / 2)
    .attr('y', H - MARGIN.bottom + 15)
    .attr('text-anchor', 'middle')
    .text((d) => xTickFormat(d));

  const columns = svg.append('g');

  data.forEach((d) => {
    const pctBottom = Number(d[bottom.key]) || 0;
    const pctTop = Number(d[top.key]) || 0;
    const yBase = yScale(0);
    const yBottomTop = yScale(pctBottom);
    const yTopEdge = yScale(100);
    const topHeight = Math.max(0, (yBottomTop - SEGMENT_GAP) - yTopEdge);

    const col = columns.append('g').style('cursor', 'pointer');

    col.append('rect')
      .attr('x', barX(d)).attr('width', barWidth)
      .attr('y', yBottomTop).attr('height', Math.max(0, yBase - yBottomTop))
      .attr('fill', `url(#${hatchId})`);

    col.append('rect')
      .attr('x', barX(d)).attr('width', barWidth)
      .attr('y', yTopEdge).attr('height', topHeight)
      .attr('fill', top.color)
      .attr('rx', 4).attr('ry', 4);
    col.append('rect')
      .attr('x', barX(d)).attr('width', barWidth)
      .attr('y', yTopEdge + Math.min(4, topHeight)).attr('height', Math.max(0, topHeight - 4))
      .attr('fill', top.color);

    col.on('mousemove', () => {
      tooltip.html(
        `<div class="tt-h">${xAccessor(d)}</div>`
        + `<div class="tt-row"><span class="lab"><span class="k" style="background:${top.color}"></span>${top.label}</span><span class="val">${Math.round(pctTop)}%</span></div>`
        + `<div class="tt-row"><span class="lab"><span class="k" style="background:${bottom.color}"></span>${bottom.label}</span><span class="val">${Math.round(pctBottom)}%</span></div>`,
      );
      const rect = svg.node().getBoundingClientRect();
      tooltip.style('left', `${((barX(d) + barWidth / 2) * rect.width) / W}px`);
      tooltip.style('top', `${((yScale(100) * rect.height) / H) + 6}px`);
      tooltip.style('opacity', 1);
    }).on('mouseleave', () => tooltip.style('opacity', 0));
  });

  renderSrTable(container, title, tableColumns, data);
}

export default renderStackedBarChart;
