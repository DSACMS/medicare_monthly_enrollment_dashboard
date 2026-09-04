import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import renderSrTable from '../accessibility';
import {
  createTooltip,
  moveTooltip,
  DEFAULT_BREAKPOINTS,
  getDefaultColors,
  getNoDataFill,
  computeJenksBreaks,
  formatCount,
  formatPercent,
} from '../utils';
import renderCountyMap from './renderCountyMap';
import { normalizeAreaName } from '../../../../src/geographicAreas';
import requestDataset from '../../../../src/router';
import renderTierHistogram from './renderTierHistogram';
import createRequestGuard from '../../requestGuard';

// us-atlas's states-10m.json is unprojected (raw lon/lat),
// so it is projected at render time.
// 950 (vs. the us-atlas README's suggested 1300)
// is chosen specifically to keep Alaska/Hawaii fully inside the frame.
// Only the national map uses this — renderCountyMap.js's per-state
// drill-down map is untouched, it auto-fits via fitSize regardless.
const PROJECTION_SCALE = 950;
// Mobile gets a bigger map still — scale and height both increased by the
// same ~15% factor over the desktop values (width stays 975 either way)
// so Alaska/Hawaii still fit without clipping, same reasoning as above.
const PROJECTION_SCALE_MOBILE = 1150;
const MOBILE_MEDIA_QUERY = '(max-width: 63.99em)';

// Module-level (not inside renderStateMap, which runs repeatedly) so
// document only ever gets one dashboard:countyselect listener.
const countyViewRegistry = {};

// entry.rerender() is a full synchronous rebuild
// expensive for state with many counties.
// Coalescing into the next animation frame collapses
// a burst of clicks into a render of the final selection
let countySelectFrame = null;

document.addEventListener('dashboard:countyselect', (event) => {
  const { containerSelector, county } = event.detail || {};
  const entry = countyViewRegistry[containerSelector];
  if (!entry) return;

  if (countySelectFrame) cancelAnimationFrame(countySelectFrame);
  countySelectFrame = requestAnimationFrame(() => {
    entry.rerender(county);
    document.dispatchEvent(new CustomEvent('dashboard:countychange', { detail: { county } }));
  });
});

// pendingX tracks an in-flight fetch so concurrent callers
// share one request instead of each firing their own
let cachedCountyFeatures = null;
let pendingCountyFeatures = null;

async function getCountyFeatures() {
  if (cachedCountyFeatures) return cachedCountyFeatures;

  if (!pendingCountyFeatures) {
    pendingCountyFeatures = (async () => {
      const us = await d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json');
      cachedCountyFeatures = topojson.feature(us, us.objects.counties).features;
      return cachedCountyFeatures;
    })();
  }

  try {
    return await pendingCountyFeatures;
  } finally {
    pendingCountyFeatures = null;
  }
}

let cachedStateFeatures = null;
let pendingStateFeatures = null;

async function getStateFeatures() {
  if (cachedStateFeatures) return cachedStateFeatures;

  if (!pendingStateFeatures) {
    pendingStateFeatures = (async () => {
      const us = await d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json');
      cachedStateFeatures = topojson.feature(us, us.objects.states).features;
      return cachedStateFeatures;
    })();
  }

  try {
    return await pendingStateFeatures;
  } finally {
    pendingStateFeatures = null;
  }
}

/**
 * Renders a US state choropleth, colored by a chosen enrollment metric
 * (e.g. MA% or MAPD%) using fixed threshold bands, with a hover tooltip
 * showing the full breakdown, and a visually-hidden accessible data table
 * (see accessibility.js / renderSrTable)
 *
 * NOTE: this function assumes data rows shaped like fetchAllStates()'s
 * output (stateName, omCount, omPercent, totalEnrollees, plus whatever
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
 *   non-colored comparison row (e.g. "OM" for the MA map, "PDP" for the
 *   MAPD map). Defaults to "OM".
 * @param {Function} [config.comparisonPercent] - (row) => percent value for
 *   the comparison row. Defaults to OM% (d => d.omPercent).
 * @param {Function} [config.comparisonCount] - (row) => raw count for the
 *   comparison row. Defaults to OM count (d => d.omCount).
 * @param {number[]} [config.breakpoints] - 4 cutoff values defining the 5
 *   color bands (e.g. [17, 34, 51, 67]). Falls back to DEFAULT_BREAKPOINTS.
 * @param {string[]} [config.colors] - 5 hex colors, one per band, low-to-high.
 *   Falls back to DEFAULT_COLORS if omitted or incomplete.
 * @param {string} [config.title] - Accessible name for the chart; used as the
 *   sr-only table's <caption>. Falls back to containerSelector if omitted.
 * @param {{label: string, value: Function}[]} [config.tableColumns] - Column
 *   definitions for the sr-only table. Falls back to a
 *   State/<metric>%/<comparison>%/Total table if omitted.
 */

function renderStateMap(containerSelector, data, config = {}) {
  // Reaching here always means this container is back on the national view.
  delete countyViewRegistry[containerSelector];

  const countyRequest = createRequestGuard();
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
    comparisonLabel = 'OM',
    comparisonPercent = (d) => d.omPercent,
    comparisonCount = (d) => d.omCount,
    totalCount = (d) => d.totalEnrollees,
    tableColumns = [
      { label: 'State', value: (d) => d.stateName },
      { label: `${metricLabel} %`, value: (d) => formatPercent(metricPercent(d)) },
      { label: `${comparisonLabel} %`, value: (d) => formatPercent(comparisonPercent(d)) },
      { label: 'Total enrollees', value: (d) => formatCount(totalCount(d)) },
    ],
    comboBoxSelector,
    backButtonSelector,
    histogramSelector,
    histogramData = data,
    year,
    month,
  } = config;

  // Reaching here always means we're back on the national view — the button
  // only makes sense while showCountyView below has drilled into a state.
  const backButtonEl = backButtonSelector ? document.querySelector(backButtonSelector) : null;
  if (backButtonEl) backButtonEl.hidden = true;

  const resolvedBreakpoints =
    breakpoints && breakpoints.length === 4 ? breakpoints : DEFAULT_BREAKPOINTS;
  const resolvedColors = colors && colors.length === 5 ? colors : getDefaultColors();

  if (histogramSelector) {
    renderTierHistogram(histogramSelector, histogramData, {
      metricPercent,
      metricLabel,
      breakpoints: resolvedBreakpoints,
      colors: resolvedColors,
      areaLabel: 'States',
      contextLabel: 'United States',
    });
  }

  const metricColor = d3.scaleThreshold().domain(resolvedBreakpoints).range(resolvedColors);

  const dataByName = new Map(
    data.map((d) => [normalizeAreaName(d.stateName), d]),
  );

  const isMobile = window.matchMedia(MOBILE_MEDIA_QUERY).matches;
  const width = 975;
  const height = isMobile ? 750 : 620;

  const getStateFill = (stateFeature) => {
    const row = dataByName.get(normalizeAreaName(stateFeature.properties.name));
    if (!row) return getNoDataFill();

    const percent = metricPercent(row);
    return Number.isFinite(percent) ? metricColor(percent) : getNoDataFill();
  };

  const container = d3.select(containerSelector);

  const syncComboBox = (stateName = '') => {
    if (!comboBoxSelector) return;

    const select = document.querySelector(comboBoxSelector);
    if (!select) return;

    const comboBox = select.closest('.usa-combo-box');
    const comboBoxInput = comboBox?.querySelector('.usa-combo-box__input');

    const isCountyView = Boolean(stateName);

    const usMapOption = select.querySelector('option[value="us-map"]');

    // USWDS creates its own visible list from the original <select>.
    const usMapListOption = Array.from(
      comboBox?.querySelectorAll('.usa-combo-box__list-option') || [],
    ).find(
      (option) => option.dataset.value === 'us-map' || option.textContent.trim() === 'U.S. Map',
    );

    // Hide U.S. Map on the national map and show it in county view.
    if (usMapOption) {
      usMapOption.hidden = !isCountyView;
    }

    if (usMapListOption) {
      usMapListOption.hidden = !isCountyView;
    }

    // Update the original select.
    select.value = stateName || '';

    // Update the visible USWDS input.
    if (comboBoxInput) {
      comboBoxInput.value = stateName || '';
      comboBoxInput.placeholder = 'Select a state';
    }
  };

  syncComboBox();

  document.querySelectorAll('.usa-combo-box__clear-input').forEach((button) => button.remove());

  container.style('position', 'relative');
  container.selectAll('*').remove();

  const svg = container.append('svg').attr('width', '100%').attr('viewBox', [0, 0, width, height]);

  const projection = d3
    .geoAlbersUsa()
    .scale(isMobile ? PROJECTION_SCALE_MOBILE : PROJECTION_SCALE)
    .translate([width / 2, height / 2]);
  const path = d3.geoPath(projection);

  const tooltip = createTooltip(container).classed('state-map-tooltip', true);

  const showCountyView = async (stateFeature, stateData) => {
    syncComboBox(stateData.stateName);

    const { signal, isStale } = countyRequest.next();

    tooltip.style('opacity', 0).style('display', 'none');

    try {
      const [countyFeatures, countyRows] = await Promise.all([
        getCountyFeatures(),
        requestDataset('countyEnrollment', { state: stateData.state, year, month }, { signal }),
      ]);

      if (isStale()) return;

      const countyValues = countyRows.map(metricPercent);
      const countyBreakpoints = computeJenksBreaks(countyValues, resolvedColors.length);

      const onBackFn = () => {
        document.dispatchEvent(new CustomEvent('dashboard:stateclear'));
        renderStateMap(containerSelector, data, config);
      };

      // Full render happens once here; subsequent county selections reuse
      // the cheap updateSelection path (see renderCountyMap.js)
      const countyMapHandle = renderCountyMap(
        containerSelector,
        countyFeatures,
        stateFeature,
        countyRows,
        {
          metricLabel,
          metricPercent,
          metricCount,
          comparisonLabel,
          comparisonPercent,
          comparisonCount,
          totalCount,
          breakpoints: countyBreakpoints,
          colors: resolvedColors,
          selectedCounty: null,
          histogramSelector,
        },
      );

      countyViewRegistry[containerSelector] = {
        rerender: countyMapHandle.updateSelection,
      };

      if (backButtonEl) {
        backButtonEl.hidden = false;
        backButtonEl.onclick = onBackFn;
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;
      if (isStale()) return;
      container.append('p').attr('role', 'alert').text('County map could not be loaded.');
    }
  };

  const emitStateChange = (stateData) => {
    document.dispatchEvent(
      new CustomEvent('dashboard:statechange', {
        detail: { stateName: stateData.stateName, state: stateData.state },
      }),
    );
  };

  getStateFeatures()
    .then((features) => {
      const featureByStateName = new Map(
        features.map((stateFeature) => [normalizeAreaName(stateFeature.properties.name), stateFeature]),
      );

      d3.select(comboBoxSelector).on('change.state-map', async (event) => {
        const selectedValue = event.target.value;

        if (!selectedValue || selectedValue === 'us-map') {
          document.dispatchEvent(new CustomEvent('dashboard:stateclear'));

          renderStateMap(containerSelector, data, config);
          return;
        }

        const normalizedValue = normalizeAreaName(selectedValue);
        const stateData = dataByName.get(normalizedValue);
        if (!stateData) return;

        const stateFeature = featureByStateName.get(normalizedValue);
        if (!stateFeature) return;

        emitStateChange(stateData);
        await showCountyView(stateFeature, stateData);
      });
      const statePaths = svg
        .append('g')
        .selectAll('path')
        .data(features)
        .join('path')
        .attr('d', path)
        .attr('fill', getStateFill)
        .attr('stroke', 'var(--map-stroke)')
        .attr('stroke-width', 1)
        .style('cursor', 'pointer');

      const hoverOutline = svg
        .append('path')
        .attr('fill', 'none')
        .attr('stroke', 'var(--map-stroke-selected)')
        .attr('stroke-width', 3)
        .style('pointer-events', 'none')
        .style('opacity', 0);

      statePaths
        .on('mouseenter', function highlightCurrent(event, d) {
          const currentFill = getStateFill(d);
          d3.select(this).attr('fill', d3.color(currentFill).brighter(0.7).formatHex());
          hoverOutline.attr('d', path(d)).style('opacity', 1);
        })
        .on('mousemove', (event, d) => {
          const row = dataByName.get(normalizeAreaName(d.properties.name));
          if (!row) {
            tooltip.style('opacity', 0).style('display', 'none');
            return;
          }

          tooltip.style('display', 'block').style('opacity', 1).html(`
            <div class="chart-tooltip__row"><span class="chart-tooltip__label">State</span><span>${row.stateName}</span></div>
            <div class="chart-tooltip__row"><span class="chart-tooltip__label">${metricLabel} %</span><span>${formatPercent(metricPercent(row))}</span></div>
            <div class="chart-tooltip__row"><span class="chart-tooltip__label">${metricLabel}</span><span>${formatCount(metricCount(row))}</span></div>
            <div class="chart-tooltip__row"><span class="chart-tooltip__label">${comparisonLabel} %</span><span>${formatPercent(comparisonPercent(row))}</span></div>
            <div class="chart-tooltip__row"><span class="chart-tooltip__label">${comparisonLabel}</span><span>${formatCount(comparisonCount(row))}</span></div>
            <div class="chart-tooltip__row chart-tooltip__row--spaced"><span class="chart-tooltip__label">TOTAL</span><span>${formatCount(totalCount(row))}</span></div>
          `);
          moveTooltip(tooltip, container.node(), event);
        })
        .on('mouseleave', function selectHighlight(event, entry) {
          d3.select(this).attr('fill', getStateFill(entry));
          hoverOutline.style('opacity', 0);

          tooltip.style('opacity', 0).style('display', 'none');
        })
        .on('click', async (event, d) => {
          const stateData = dataByName.get(normalizeAreaName(d.properties.name));
          if (!stateData) return;

          emitStateChange(stateData);
          await showCountyView(d, stateData);
        });
    })
    .catch(() => {
      container.append('p').attr('role', 'alert').text('State map could not be loaded.');
    });

  renderSrTable(container, title, tableColumns, data);
  return { success: true };
}

export default renderStateMap;
