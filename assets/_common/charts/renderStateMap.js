import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import renderSrTable from './accessibility';
import { createTooltip, moveTooltip } from './utils';
import renderCountyMap from './renderCountyMap';
import requestDataset from '../../../src/router';

// These are the breakpoints and colors for the legend design
// (5 bands: 1-17%, 17-34%, 34-51%, 51-67%, 67-87%).
const DEFAULT_PERCENT_BREAKPOINTS = [17, 34, 51, 67];
const DEFAULT_COLORS = ['#f6e8a3', '#e08e6d', '#c0506b', '#7a3a87', '#3d1a5e'];
const NO_DATA_FILL = '#979595';

// us-atlas's states-10m.json is unprojected (raw lon/lat), so we project it
// ourselves at render time. 975x610 is the viewport these scale/translate
// values are tuned for, per the us-atlas README; 800 (vs. the README's
// suggested 1300) was chosen here specifically to keep Alaska/Hawaii fully
// inside the frame at this viewport size — bump it up if you want the
// mainland states larger and don't mind clipping the insets.
const PROJECTION_SCALE = 800;

let currentCountyRequestId = 0;
let cachedCountyFeatures = null;

async function getCountyFeatures() {
  if (!cachedCountyFeatures) {
    const us = await d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json');
    cachedCountyFeatures = topojson.feature(us, us.objects.counties).features;
  }
  return cachedCountyFeatures;
}

let cachedStateFeatures = null;

async function getStateFeatures() {
  if (!cachedStateFeatures) {
    const us = await d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json');
    cachedStateFeatures = topojson.feature(us, us.objects.states).features;
  }
  return cachedStateFeatures;
}

/**
 * Renders a US state choropleth, colored by a chosen enrollment metric
 * (e.g. MA% or MAPD%) using fixed threshold bands, with a hover tooltip
 * showing the full breakdown, and a visually-hidden accessible data table
 * (see accessibility.js / renderSrTable)
 *
 * NOTE: this function assumes data rows shaped like fetchAllStates()'s
 * output (stateName, ffsCount, ffsPercent, totalEnrollees, plus whatever
 * count/percent fields config.metricPercent / config.metricCount point at).
 *
 * @param {string} containerSelector - CSS selector for the chart's container element.
 * @param {Object[]} data - output of fetchAllStates().
 * @param {Object} [config]
 * @param {string} [config.metricLabel] - Display label for the colored
 *   metric in the tooltip (e.g. "MA", "MAPD"). Defaults to "MA".
 * @param {Function} [config.metricPercent] - (row) => percent value used for
 *   both coloring and the tooltip's "<label> %" row. Defaults to MA%
 *   (d => d.maPercent).
 * @param {Function} [config.metricCount] - (row) => raw count, shown in the
 *   tooltip's "<label>" row. Defaults to MA count (d => d.maCount).
 * @param {string} [config.comparisonLabel] - Display label for the tooltip's
 *   non-colored comparison row (e.g. "FFS" for the MA map, "PDP" for the
 *   MAPD map). Defaults to "FFS".
 * @param {Function} [config.comparisonPercent] - (row) => percent value for
 *   the comparison row. Defaults to FFS% (d => d.ffsPercent).
 * @param {Function} [config.comparisonCount] - (row) => raw count for the
 *   comparison row. Defaults to FFS count (d => d.ffsCount).
 * @param {number[]} [config.breakpoints] - 4 cutoff values defining the 5
 *   color bands (e.g. [17, 34, 51, 67]). Falls back to DEFAULT_PERCENT_BREAKPOINTS.
 * @param {string[]} [config.colors] - 5 hex colors, one per band, low-to-high.
 *   Falls back to DEFAULT_COLORS if omitted or incomplete.
 * @param {string} [config.title] - Accessible name for the chart; used as the
 *   sr-only table's <caption>. Falls back to containerSelector if omitted.
 * @param {{label: string, value: Function}[]} [config.tableColumns] - Column
 *   definitions for the sr-only table, same shape as renderPieChart's
 *   config.tableColumns. Falls back to a State/<metric>%/<comparison>%/Total
 *   table if omitted.
 */

function renderStateMap(containerSelector, data, config = {}) {
  if (!data?.length) {
    return {
      success: false,
      error: 'renderStateMap: no data provided, skipping render.',
    };
  }

  const {
    breakpoints,
    colors,
    title = containerSelector,
    metricLabel = 'MA',
    metricPercent = (d) => d.maPercent,
    metricCount = (d) => d.maCount,
    comparisonLabel = 'FFS',
    comparisonPercent = (d) => d.ffsPercent,
    comparisonCount = (d) => d.ffsCount,
    tableColumns = [
      { label: 'State', value: (d) => d.stateName },
      { label: `${metricLabel} %`, value: (d) => `${metricPercent(d)}%` },
      { label: `${comparisonLabel} %`, value: (d) => `${comparisonPercent(d)}%` },
      { label: 'Total enrollees', value: (d) => d.totalEnrollees.toLocaleString() },
    ],
  } = config;

  const resolvedBreakpoints =
    breakpoints && breakpoints.length === 4 ? breakpoints : DEFAULT_PERCENT_BREAKPOINTS;
  const resolvedColors = colors && colors.length === 5 ? colors : DEFAULT_COLORS;

  const metricColor = d3.scaleThreshold().domain(resolvedBreakpoints).range(resolvedColors);

  // Lookup by full state name (matches us-atlas's properties.name field).
  const dataByName = new Map(data.map((d) => [d.stateName, d]));

  const width = 975;
  const height = 610;

  const container = d3.select(containerSelector);

  container.style('position', 'relative');
  container.selectAll('*').remove();

  const svg = container.append('svg').attr('width', '100%').attr('viewBox', [0, 0, width, height]);

  const projection = d3
    .geoAlbersUsa()
    .scale(PROJECTION_SCALE)
    .translate([width / 2, height / 2]);
  const path = d3.geoPath(projection);

  const tooltip = createTooltip(container).classed('state-map-tooltip', true);

  getStateFeatures()
    .then((features) => {
      svg
        .append('g')
        .selectAll('path')
        .data(features)
        .join('path')
        .attr('d', path)
        .attr('fill', (d) => {
          const row = dataByName.get(d.properties.name);
          return row === undefined ? NO_DATA_FILL : metricColor(metricPercent(row));
        })
        .attr('stroke', '#fff')
        .style('cursor', 'pointer')
        .on('mousemove', (event, d) => {
          const row = dataByName.get(d.properties.name);
          if (!row) {
            tooltip.style('opacity', 0).style('display', 'none');
            return;
          }

          tooltip.style('display', 'block').style('opacity', 1).html(`
            <div class="chart-tooltip__row"><span class="chart-tooltip__label">State</span><span>${row.stateName}</span></div>
            <div class="chart-tooltip__row"><span class="chart-tooltip__label">${metricLabel} %</span><span>${metricPercent(row)}%</span></div>
            <div class="chart-tooltip__row"><span class="chart-tooltip__label">${metricLabel}</span><span>${metricCount(row).toLocaleString()}</span></div>
            <div class="chart-tooltip__row"><span class="chart-tooltip__label">${comparisonLabel} %</span><span>${comparisonPercent(row)}%</span></div>
            <div class="chart-tooltip__row"><span class="chart-tooltip__label">${comparisonLabel}</span><span>${comparisonCount(row).toLocaleString()}</span></div>
            <div class="chart-tooltip__row chart-tooltip__row--spaced"><span class="chart-tooltip__label">TOTAL</span><span>${row.totalEnrollees.toLocaleString()}</span></div>
          `);
          moveTooltip(tooltip, container.node(), event);
        })
        .on('mouseleave', () => {
          tooltip.style('opacity', 0).style('display', 'none');
        })
        .on('click', async (event, d) => {
          currentCountyRequestId += 1;
          const requestId = currentCountyRequestId;

          const row = dataByName.get(d.properties.name);
          if (!row) return;

          tooltip.style('opacity', 0).style('display', 'none');

          try {
            const [countyFeatures, countyRows] = await Promise.all([
              getCountyFeatures(),
              requestDataset('countyEnrollment', { state: row.state }),
            ]);

            if (requestId !== currentCountyRequestId) return;

            renderCountyMap(
              containerSelector,
              countyFeatures,
              d,
              countyRows,
              () => renderStateMap(containerSelector, data, config),
              {
                metricLabel,
                metricPercent,
                metricCount,
                breakpoints: resolvedBreakpoints,
                colors: resolvedColors,
              },
            );
          } catch (error) {
            if (requestId !== currentCountyRequestId) return;
            container.append('p').attr('role', 'alert').text('County map could not be loaded.');
          }
        });
    })
    .catch(() => {
      container.append('p').attr('role', 'alert').text('State map could not be loaded.');
    });

  renderSrTable(container, title, tableColumns, data);
  return { success: true };
}

export default renderStateMap;
