import * as d3 from 'd3';
import renderSrTable from './accessibility';
import { createTooltip, moveTooltip, DEFAULT_BREAKPOINTS, NO_DATA_FILL, DEFAULT_COLORS } from './utils';
import { joinCountyData, filterCountiesByState } from './joinCountyData';
import renderTierHistogram from './renderTierHistogram';


const MOBILE_MEDIA_QUERY = '(max-width: 63.99em)';

/**
 * Renders a single state's counties as a choropleth, colored by the same
 * kind of metric renderStateMap uses — pure renderer, no data fetching.
 *
 * @param {string} containerSelector - Container selector to clear and render into.
 * @param {Object[]} allCountyFeatures - Full counties FeatureCollection features.
 * @param {Object} stateFeature - Clicked state's GeoJSON feature.
 * @param {Object[]} countyRows - County-level rows for this state.
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
  config = {},
) {
  const formatNumber = (value) => (value == null ? 'No data' : value.toLocaleString());

  const {
    metricLabel = 'MA',
    metricPercent = (d) => d.maPercent,
    metricCount = (d) => d.maCount,
    breakpoints,
    colors,
    selectedCounty = null,
    histogramSelector,
    title = `${stateFeature.properties.name} counties`,
    tableColumns = [
      { label: 'County', value: (d) => d.county },
      { label: `${metricLabel} %`, value: (d) => `${metricPercent(d) ?? 'No data'}%` },
      { label: 'Total enrollees', value: (d) => formatNumber(d.totalEnrollees) },
    ],
  } = config;


  const resolvedBreakpoints =
    breakpoints && breakpoints.length === 4 ? breakpoints : DEFAULT_BREAKPOINTS;
  const resolvedColors = colors && colors.length === 5 ? colors : DEFAULT_COLORS;
  if (histogramSelector) {
    renderTierHistogram(histogramSelector, countyRows, {
      metricPercent,
      metricLabel,
      breakpoints: resolvedBreakpoints,
      colors: resolvedColors,
      areaLabel: 'Counties',
      contextLabel: stateFeature.properties.name,
    });
  }

  const metricColor = d3.scaleThreshold().domain(resolvedBreakpoints).range(resolvedColors);

  const stateFips = stateFeature.id;
  const stateCounties = filterCountiesByState(allCountyFeatures, stateFips);

  // fitSize (below) auto-computes scale/translate to fill exactly whatever
  // [width, height] we give it, so unlike renderStateMap.js's fixed-scale
  // approach, bumping height on mobile is enough on its own — no clipping risk.
  const isMobile = window.matchMedia(MOBILE_MEDIA_QUERY).matches;
  const width = 975;
  const height = isMobile ? 750 : 620;

  const getCountyFill = (entry) => {
    if (!entry.data) return NO_DATA_FILL;

    const percent = metricPercent(entry.data);
    return Number.isFinite(percent) ? metricColor(percent) : NO_DATA_FILL;
  };

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

  const tooltip = createTooltip(container).classed('county-map-tooltip', true);

  const isSelected = (entry) => Boolean(entry.data) && entry.data.county === selectedCounty;

  const getDisplayedFill = (entry) => {
  const fill = getCountyFill(entry);

  return isSelected(entry)
    ? d3.color(fill).brighter(0.7).formatHex()
    : fill;
};

  const countyPaths = svg
    .append('g')
    .selectAll('path')
    .data(joined)
    .join('path')
    .attr('d', (entry) => path(entry.feature))
    .attr('fill', getDisplayedFill)
    .attr('stroke', (entry) => (isSelected(entry) ? '#111' : '#fff'))
    .attr('stroke-width', (entry) => (isSelected(entry) ? 3 : 0.75))
    .style('cursor', 'pointer')
    .on('mouseenter', function highlight_current(event, entry){
      const currentFill = getCountyFill(entry);
      d3.select(this)
        .raise()
        .attr('stroke', '#111')
        .attr('stroke-width', 3)
        .attr('fill', d3.color(currentFill).brighter(0.7).formatHex());
    })
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
    .on('mouseleave', function leftover_outline (event, entry) {
      // Revert to the selected-state stroke, not a flat reset — otherwise
      // leaving the selected county erases its highlight until re-render.
      d3.select(this)
        .attr('fill', getDisplayedFill(entry))
        .attr('stroke', isSelected(entry) ? '#111' : '#fff')
        .attr('stroke-width', isSelected(entry) ? 3 : 0.75);

      tooltip.style('opacity', 0).style('display', 'none');
    })
    .on('click', (event, entry) => {
      if (!entry.data) return;
      document.dispatchEvent(new CustomEvent('dashboard:countyselect', {
        detail: { containerSelector, county: entry.data.county },
      }));
    });

  countyPaths.filter((entry) => isSelected(entry)).raise();

  renderSrTable(
    container,
    title,
    tableColumns,
    joined.filter((entry) => entry.data !== undefined).map((entry) => entry.data),
  );
}

export default renderCountyMap;
