import * as d3 from 'd3';
import renderSrTable from '../accessibility';
import {
  createTooltip,
  moveTooltip,
  DEFAULT_BREAKPOINTS,
  NO_DATA_FILL,
  DEFAULT_COLORS,
  formatCount,
  formatPercent,
} from '../utils';
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
 * @param {string} [config.comparisonLabel] - Display label for the tooltip's
 *   non-colored comparison row (e.g. "OM" for the MA map, "PDP" for the
 *   MAPD map). Defaults to "OM".
 * @param {Function} [config.comparisonPercent] - (row) => percent value for
 *   the comparison row. Defaults to OM% (d => d.omPercent).
 * @param {Function} [config.comparisonCount] - (row) => raw count for the
 *   comparison row. Defaults to OM count (d => d.omCount).
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
  const {
    metricLabel = 'MA',
    metricPercent = (d) => d.maPercent,
    metricCount = (d) => d.maCount,
    comparisonLabel = 'OM',
    comparisonPercent = (d) => d.omPercent,
    comparisonCount = (d) => d.omCount,
    totalCount = (d) => d.totalEnrollees,
    breakpoints,
    colors,
    selectedCounty: initialSelectedCounty = null,
    histogramSelector,
    title = `${stateFeature.properties.name} counties`,
    tableColumns = [
      { label: 'County', value: (d) => d.county },
      { label: `${metricLabel} %`, value: (d) => formatPercent(metricPercent(d)) },
      { label: `${comparisonLabel} %`, value: (d) => formatPercent(comparisonPercent(d)) },
      { label: 'Total enrollees', value: (d) => formatCount(totalCount(d)) },
    ],
  } = config;

  // Mutable so updateSelection can change the path
  // without re-running the rest of this function
  let selectedCounty = initialSelectedCounty;

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
    return { updateSelection: () => {} };
  }

  const joined = joinCountyData(stateCounties, countyRows);

  // AlbersUsa's composite projection covers only 50 states + DC; territory
  // FIPS 60/66/69/72/78 project to null. Use a general Mercator for those.
  const isTerritory = ['60', '66', '69', '72', '78'].includes(String(stateFips).padStart(2, '0'));
  const projection = isTerritory ? d3.geoMercator() : d3.geoAlbersUsa();
  projection.fitSize([width, height], {
    type: 'FeatureCollection',
    features: stateCounties,
  });

  const path = d3.geoPath(projection);

  const svg = container.append('svg').attr('width', '100%').attr('viewBox', [0, 0, width, height]);

  const tooltip = createTooltip(container).classed('county-map-tooltip', true);

  const isSelected = (entry) => Boolean(entry.data) && entry.data.county === selectedCounty;
  // Any county with a joined data row is selectable, even if CMS suppressed
  // its metric (e.g. Bethel Census Area, AK) or its total (e.g. Kalawao
  // County, HI) -- the trend card still has something real to show (or, for
  // a fully-suppressed county, honestly shows nothing rather than blocking
  // the click). Only a shape with no matching row at all stays unselectable.
  const isSelectable = (entry) => Boolean(entry.data);

  const getDisplayedFill = (entry) => {
    const fill = getCountyFill(entry);

    return isSelected(entry) ? d3.color(fill).brighter(0.7).formatHex() : fill;
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
    .style('cursor', (entry) => (isSelectable(entry) ? 'pointer' : 'default'));

  const hoverOutline = svg
    .append('path')
    .attr('fill', 'none')
    .attr('stroke', '#111')
    .attr('stroke-width', 3)
    .style('pointer-events', 'none')
    .style('opacity', 0);

  countyPaths
    .on('mouseenter', function highlightCurrent(event, entry) {
      const currentFill = getCountyFill(entry);
      d3.select(this).attr('fill', d3.color(currentFill).brighter(0.7).formatHex());
      hoverOutline.attr('d', path(entry.feature)).style('opacity', 1);
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
        <div class="chart-tooltip__row"><span class="chart-tooltip__label">${metricLabel} %</span><span>${formatPercent(percent)}</span></div>
        <div class="chart-tooltip__row"><span class="chart-tooltip__label">${metricLabel}</span><span>${formatCount(count)}</span></div>
        <div class="chart-tooltip__row"><span class="chart-tooltip__label">${comparisonLabel} %</span><span>${formatPercent(comparisonPercent(row))}</span></div>
        <div class="chart-tooltip__row"><span class="chart-tooltip__label">${comparisonLabel}</span><span>${formatCount(comparisonCount(row))}</span></div>
        <div class="chart-tooltip__row chart-tooltip__row--spaced"><span class="chart-tooltip__label">TOTAL</span><span>${formatCount(totalCount(row))}</span></div>
      `);

      moveTooltip(tooltip, container.node(), event);
    })
    .on('mouseleave', function clearHighlight(event, entry) {
      d3.select(this).attr('fill', getDisplayedFill(entry));
      hoverOutline.style('opacity', 0);

      tooltip.style('opacity', 0).style('display', 'none');
    })
    .on('click', (event, entry) => {
      if (!isSelectable(entry)) return;
      document.dispatchEvent(
        new CustomEvent('dashboard:countyselect', {
          detail: { containerSelector, county: entry.data.county },
        }),
      );
    });

  countyPaths.filter((entry) => isSelected(entry)).raise();

  renderSrTable(
    container,
    title,
    tableColumns,
    joined.filter((entry) => entry.data !== undefined).map((entry) => entry.data),
  );

  // Cheap path for "only the selection changed" (same state, same data) --
  // re-applies fill/stroke/raise on the already-bound paths instead of
  // rebuilding the histogram, sr-only table, and county-shape geometry,
  // which for a large state (Texas has 254 counties) is the expensive part
  // of a full re-render and was blocking the trend card from updating.
  const updateSelection = (newSelectedCounty) => {
    selectedCounty = newSelectedCounty;
    countyPaths
      .attr('fill', getDisplayedFill)
      .attr('stroke', (entry) => (isSelected(entry) ? '#111' : '#fff'))
      .attr('stroke-width', (entry) => (isSelected(entry) ? 3 : 0.75));
    countyPaths.filter((entry) => isSelected(entry)).raise();
  };

  return { updateSelection };
}

export default renderCountyMap;
