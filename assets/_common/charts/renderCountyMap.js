import * as d3 from 'd3';
import renderSrTable from './accessibility';
import { createTooltip, moveTooltip } from './utils';
import { joinCountyData, filterCountiesByState } from './joinCountyData';

const NO_DATA_FILL = '#eee';

/**
 * Renders a single state's counties as a choropleth, colored by the same
 * kind of metric renderStateMap uses — pure renderer, no data fetching.
 *
 * @param {string} containerSelector - Container selector to clear and render into.
 * @param {Object[]} allCountyFeatures - Full counties FeatureCollection features.
 * @param {Object} stateFeature - Clicked state's GeoJSON feature.
 * @param {Object[]} countyRows - County-level rows for this state.
 * @param {Function} onBack - Called when the user wants to return to states view.
 * @param {Object} [config]
 * @param {string} [config.metricLabel] - Display label for the colored metric.
 * @param {Function} [config.metricPercent] - (row) => percent value for coloring and tooltip.
 * @param {Function} [config.metricCount] - (row) => raw count for tooltip.
 * @param {number[]} [config.breakpoints] - 4 cutoffs defining 5 color bands.
 * @param {string[]} [config.colors] - 5 hex colors, low-to-high.
 * @param {string} [config.title] - Accessible name for the sr-only table.
 * @param {{label: string, value: Function}[]} [config.tableColumns] - sr-only table columns.
 */
function renderCountyMap(
  containerSelector,
  allCountyFeatures,
  stateFeature,
  countyRows,
  onBack,
  config = {},
) {
  const formatNumber = (value) => (value == null ? 'No data' : value.toLocaleString());

  const {
    metricLabel = 'MA',
    metricPercent = (d) => d.maPercent,
    metricCount = (d) => d.maCount,
    breakpoints,
    colors,
    title = `${stateFeature.properties.name} counties`,
    tableColumns = [
      { label: 'County', value: (d) => d.county },
      { label: `${metricLabel} %`, value: (d) => `${metricPercent(d) ?? 'No data'}%` },
      { label: 'Total enrollees', value: (d) => formatNumber(d.totalEnrollees) },
    ],
  } = config;

  const DEFAULT_BREAKPOINTS = [17, 34, 51, 67];
  const DEFAULT_COLORS = ['#f6e8a3', '#e08e6d', '#c0506b', '#7a3a87', '#3d1a5e'];

  const resolvedBreakpoints =
    breakpoints && breakpoints.length === 4 ? breakpoints : DEFAULT_BREAKPOINTS;
  const resolvedColors = colors && colors.length === 5 ? colors : DEFAULT_COLORS;

  const metricColor = d3.scaleThreshold().domain(resolvedBreakpoints).range(resolvedColors);

  const stateFips = stateFeature.id;
  const stateCounties = filterCountiesByState(allCountyFeatures, stateFips);

  const width = 975;
  const height = 800;

  const container = d3.select(containerSelector);
  container.style('position', 'relative');
  container.selectAll('*').remove();

  if (!stateCounties.length) {
    container.append('p').attr('role', 'alert').text('No county shapes found for this state.');
    return;
  }

  const joined = joinCountyData(stateCounties, countyRows);

  const projection = d3.geoAlbersUsa();
  projection.fitSize([width, height], {
    type: 'FeatureCollection',
    features: stateCounties,
  });

  const path = d3.geoPath(projection);

  const svg = container.append('svg').attr('width', '100%').attr('viewBox', [0, 0, width, height]);

  const backButton = svg
    .append('g')
    .attr('class', 'county-map-back')
    .attr('role', 'button')
    .attr('tabindex', 0)
    .attr('aria-label', 'Back to state map')
    .style('cursor', 'pointer')
    .on('click', () => onBack())
    .on('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onBack();
      }
    });

  backButton
    .append('rect')
    .attr('x', 10)
    .attr('y', 10)
    .attr('width', 90)
    .attr('height', 30)
    .attr('rx', 4)
    .attr('fill', '#fff')
    .attr('stroke', '#888');

  backButton
    .append('text')
    .attr('x', 55)
    .attr('y', 30)
    .attr('text-anchor', 'middle')
    .attr('font-size', 13)
    .text('\u2190 Back');

  const tooltip = createTooltip(container).classed('county-map-tooltip', true);

  svg
    .append('g')
    .selectAll('path')
    .data(joined)
    .join('path')
    .attr('d', (entry) => path(entry.feature))
    .attr('fill', (entry) => {
      if (!entry.data) return NO_DATA_FILL;

      const percent = metricPercent(entry.data);
      return Number.isFinite(percent) ? metricColor(percent) : NO_DATA_FILL;
    })
    .attr('stroke', '#fff')
    .style('cursor', 'pointer')
    .on('mousemove', (event, entry) => {
      const row = entry.data;

      if (!row) {
        tooltip.style('opacity', 0).style('display', 'none');
        return;
      }

      const percent = metricPercent(row);
      const count = metricCount(row);

      tooltip.style('display', 'block').style('opacity', 1).html(`
        <div class="chart-tooltip__row"><span class="chart-tooltip__label">County</span><span>${row.county}</span></div>
        <div class="chart-tooltip__row"><span class="chart-tooltip__label">${metricLabel} %</span><span>${Number.isFinite(percent) ? `${percent}%` : 'No data'}</span></div>
        <div class="chart-tooltip__row"><span class="chart-tooltip__label">${metricLabel}</span><span>${formatNumber(count)}</span></div>
        <div class="chart-tooltip__row chart-tooltip__row--spaced"><span class="chart-tooltip__label">TOTAL</span><span>${formatNumber(row.totalEnrollees)}</span></div>
      `);

      moveTooltip(tooltip, container.node(), event);
    })
    .on('mouseleave', () => {
      tooltip.style('opacity', 0).style('display', 'none');
    });

  renderSrTable(
    container,
    title,
    tableColumns,
    joined.filter((entry) => entry.data !== undefined).map((entry) => entry.data),
  );
}

export default renderCountyMap;
