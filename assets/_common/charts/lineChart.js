import * as d3 from 'd3';
import renderSrTable from './accessibility';
import {
  appendTrendFigure,
  buildLegendHtml,
  resolveLegendTarget,
  selectTickRows,
  formatMillions,
  formatPeriod,
  TREND_MARGIN,
} from './utils';

const PRIMARY_STROKE_WIDTH = 3;
const DEFAULT_STROKE_WIDTH = 2;
const PRIMARY_AREA_OPACITY = 0.08;
const END_LABEL_MIN_GAP = 12;

/**
 * Renders a multi-series enrollment count line chart with y-axis origin at 0.
 * Each series is labeled directly at its line's endpoint (name + value), so
 * there's no separate legend — the primary series (config.series[i].primary)
 * additionally renders bolder with a light area fill for emphasis.
 *
 * @param {string} selector - DOM container selector
 * @param {Array}  data      - Enrollment data rows (pre-sorted ascending)
 * @param {Object} config
 * @param {Array}  config.series     - [{ key, label, color?, primary? }]
 * @param {Function} [config.xAccessor] - Row → x-axis label / tooltip header
 * @param {Function} [config.xTickFormat] - Row → short x-axis tick text
 * @param {string} config.title       - Used for aria-label and sr-table caption
 * @param {Array}  config.tableColumns - [{ label, value(row) }] for sr table
 * @param {Function} [config.yTickFormat] - Value → axis tick / tooltip / end-label text
 */
function renderLineChart(selector, data, config) {
  const container = d3.select(selector);
  container.html('');

  if (!data || data.length === 0) return;

  const {
    series,
    xAccessor = formatPeriod,
    xTickFormat = xAccessor,
    title,
    tableColumns,
    yTickFormat = formatMillions,
    legendSelector,
  } = config;

  const MARGIN = legendSelector ? { ...TREND_MARGIN, right: 16 } : TREND_MARGIN;

  const {
    svg, tooltip, width: W, height: H,
  } = appendTrendFigure(container, title);

  const xLabels = data.map(xAccessor);
  const xScale = d3.scalePoint().domain(xLabels).range([MARGIN.left, W - MARGIN.right]).padding(0.5);

  const yMax = d3.max(data, (d) => d3.max(series, (s) => d[s.key] || 0)) * 1.08;
  const yScale = d3.scaleLinear().domain([0, yMax]).nice().range([H - MARGIN.bottom, MARGIN.top]);

  yScale.ticks(5).forEach((t) => {
    svg.append('line')
      .attr('class', 'gridline')
      .attr('x1', MARGIN.left).attr('x2', W - MARGIN.right)
      .attr('y1', yScale(t)).attr('y2', yScale(t));
    svg.append('text')
      .attr('class', 'tick-txt')
      .attr('x', MARGIN.left - 8).attr('y', yScale(t))
      .attr('text-anchor', 'end').attr('dominant-baseline', 'middle')
      .text(yTickFormat(t));
  });

  const tickRows = selectTickRows(svg, data, xTickFormat, W - MARGIN.left - MARGIN.right);
  svg.append('g').selectAll('text')
    .data(tickRows)
    .join('text')
    .attr('class', 'tick-txt')
    .attr('x', (d) => xScale(xAccessor(d)))
    .attr('y', H - MARGIN.bottom + 15)
    .attr('text-anchor', 'middle')
    .text((d) => xTickFormat(d));

  svg.append('line')
    .attr('class', 'axis-base')
    .attr('x1', MARGIN.left).attr('x2', W - MARGIN.right)
    .attr('y1', yScale(0)).attr('y2', yScale(0));

  const lastRow = data[data.length - 1];
  const lineGenerator = d3.line()
    .x((d) => xScale(d.x))
    .y((d) => yScale(d.v))
    .curve(d3.curveMonotoneX);
  const areaGenerator = d3.area()
    .x((d) => xScale(d.x))
    .y0(yScale(0))
    .y1((d) => yScale(d.v))
    .curve(d3.curveMonotoneX);

  series.forEach((s) => {
    const points = data.map((d) => ({ x: xAccessor(d), v: d[s.key] || 0 }));

    if (s.primary) {
      svg.append('path')
        .attr('d', areaGenerator(points))
        .attr('fill', s.color)
        .attr('fill-opacity', PRIMARY_AREA_OPACITY)
        .attr('stroke', 'none');
    }

    svg.append('path')
      .attr('class', 'series-line')
      .attr('stroke', s.color)
      .style('stroke-width', s.primary ? PRIMARY_STROKE_WIDTH : DEFAULT_STROKE_WIDTH)
      .attr('d', lineGenerator(points));

    svg.append('circle')
      .attr('class', 'marker-ring')
      .attr('cx', xScale(xAccessor(lastRow)))
      .attr('cy', yScale(lastRow[s.key] || 0))
      .attr('r', s.primary ? 5 : 4.5)
      .attr('fill', s.color);
  });

  if (legendSelector) {
    const legendItems = series.map((s) => ({
      label: `${s.label} ${yTickFormat(lastRow[s.key] || 0)}`,
      color: s.color,
      dot: true,
    }));
    resolveLegendTarget(container, legendSelector).html(buildLegendHtml(legendItems));
  } else {
    const endLabelX = xScale(xAccessor(lastRow)) + 10;
    const endLabels = series
      .map((s) => ({ s, y: yScale(lastRow[s.key] || 0) }))
      .sort((a, b) => a.y - b.y);
    endLabels.forEach((entry, i) => {
      if (i > 0 && entry.y - endLabels[i - 1].y < END_LABEL_MIN_GAP) {
        entry.y = endLabels[i - 1].y + END_LABEL_MIN_GAP;
      }
    });
    endLabels.forEach(({ s, y }) => {
      svg.append('text')
        .attr('class', 'end-label')
        .attr('x', endLabelX)
        .attr('y', y + 4)
        .style('fill', s.color)
        .style('font-weight', s.primary ? 800 : 700)
        .text(`${s.label} ${yTickFormat(lastRow[s.key] || 0)}`);
    });
  }

  const crosshair = svg.append('line')
    .attr('class', 'crosshair')
    .attr('y1', MARGIN.top).attr('y2', H - MARGIN.bottom)
    .style('opacity', 0);
  const focusDots = svg.append('g');
  const totalSeries = series.find((s) => s.primary) || series[0];

  svg.append('rect')
    .attr('x', MARGIN.left).attr('y', MARGIN.top)
    .attr('width', Math.max(0, W - MARGIN.right - MARGIN.left))
    .attr('height', Math.max(0, H - MARGIN.bottom - MARGIN.top))
    .attr('fill', 'transparent')
    .style('cursor', 'crosshair')
    .on('mousemove', (event) => {
      const [mx] = d3.pointer(event, svg.node());
      let idx = 0;
      let best = Infinity;
      data.forEach((d, i) => {
        const dist = Math.abs(xScale(xAccessor(d)) - mx);
        if (dist < best) { best = dist; idx = i; }
      });
      const d = data[idx];
      const dx = xScale(xAccessor(d));

      crosshair.attr('x1', dx).attr('x2', dx).style('opacity', 1);
      focusDots.selectAll('*').remove();
      series.forEach((s) => {
        focusDots.append('circle')
          .attr('class', 'marker-ring')
          .attr('cx', dx).attr('cy', yScale(d[s.key] || 0))
          .attr('r', 4).attr('fill', s.color);
      });

      tooltip.html(`<div class="tt-h">${xAccessor(d)}</div>${series.map((s) => `<div class="tt-row"><span class="lab"><span class="k" style="background:${s.color}"></span>${s.label}</span><span class="val">${yTickFormat(d[s.key] || 0)}</span></div>`).join('')}`);
      const rect = svg.node().getBoundingClientRect();
      tooltip.style('left', `${(dx * rect.width) / W}px`);
      tooltip.style('top', `${(yScale(d[totalSeries.key] || 0) * rect.height) / H}px`);
      tooltip.style('opacity', 1);
    })
    .on('mouseleave', () => {
      crosshair.style('opacity', 0);
      focusDots.selectAll('*').remove();
      tooltip.style('opacity', 0);
    });

  renderSrTable(container, title, tableColumns, data);
}

export default renderLineChart;
