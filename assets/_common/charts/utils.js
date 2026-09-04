import * as d3 from 'd3';
import { ckmeans } from 'simple-statistics';

const MONTH_ORDER = {
  January: 1,
  February: 2,
  March: 3,
  April: 4,
  May: 5,
  June: 6,
  July: 7,
  August: 8,
  September: 9,
  October: 10,
  November: 11,
  December: 12,
};

const TREND_CHART_WIDTH = 560;
const TREND_CHART_HEIGHT = 270;

export const DEFAULT_BREAKPOINTS = [17, 34, 51, 67];
export const NO_DATA_FILL = '#eee';
export const DEFAULT_COLORS = ['#f1eef6', '#d7b5d8', '#df65b0', '#dd1c77', '#980043'];

// D3 needs real, parseable colors (not `var(...)` strings -- d3.color() can't
// resolve custom properties) so the choropleth scale and its .brighter()
// hover/selected variant stay in sync with light/dark mode, we read the
// resolved value of the theme tokens defined in dashboard/_tokens.scss at
// render time instead of hardcoding one palette.
function readColorToken(name, fallback) {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

// Theme-aware "no data / suppressed" fill for map choropleths.
export function getNoDataFill() {
  return readColorToken('--map-no-data', NO_DATA_FILL);
}

// Theme-aware 5-color sequential choropleth scale (falls back to
// DEFAULT_COLORS outside a browser, e.g. in Jest/Node).
export function getDefaultColors() {
  return DEFAULT_COLORS.map((fallback, index) => readColorToken(`--map-scale-${index}`, fallback));
}

export function computeJenksBreaks(values, numClasses = DEFAULT_COLORS.length) {
  const clean = values.filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
  if (clean.length < numClasses) return DEFAULT_BREAKPOINTS;

  const clusters = ckmeans(clean, numClasses);

  const breaks = clusters.slice(0, -1).map((cluster) => cluster[cluster.length - 1]);

  return breaks.map((b) => Math.round(b));
}

export const TREND_MARGIN = {
  top: 12,
  right: 100,
  bottom: 30,
  left: 44,
};

export function sortYearlyAscending(data) {
  return [...data].sort((a, b) => Number(a.year) - Number(b.year));
}

export function sortMonthlyAscending(data) {
  return [...data].sort((a, b) => {
    const yearDiff = Number(a.year) - Number(b.year);
    if (yearDiff !== 0) return yearDiff;
    return (MONTH_ORDER[a.month] || 0) - (MONTH_ORDER[b.month] || 0);
  });
}

export function formatPeriod(d) {
  return d.month ? `${d.month} ${d.year}` : String(d.year);
}

// Scale-adaptive: plain number under 1,000 (e.g. a small county's
// enrollment), "12k" for thousands, "3.5M" for millions -- a fixed
// divide-by-1e6 breaks down for anything smaller than national/state scale.
export function formatCompactNumber(d) {
  return d3.format('.2~s')(d);
}

// One place to change these two strings
// used across the maps, grid, and trend charts
export const SUPPRESSED_LABEL = 'Suppressed';
export const NO_DATA_LABEL = '-';

// Raw enrollment counts are null when CMS suppresses a small count for
// privacy (see num() in src/utils.js) -- shown as "Suppressed"
// "-" is shown for a suppressed/zero-total percent
export function formatCount(n) {
  return Number.isFinite(n) ? n.toLocaleString() : SUPPRESSED_LABEL;
}

// Percent is NaN both when the total is 0 and when the count feeding it is
// suppressed, shown as "-"
export function formatPercent(v) {
  return Number.isFinite(v) ? `${v}%` : NO_DATA_LABEL;
}

export function createTooltip(container) {
  container.style('position', 'relative');
  return container
    .append('div')
    .attr('class', 'chart-tooltip')
    .attr('aria-hidden', 'true')
    .style('opacity', 0);
}

export function moveTooltip(tooltip, containerNode, event) {
  const [x, y] = d3.pointer(event, containerNode);
  const offset = 16;

  const containerRect = containerNode.getBoundingClientRect();
  const tooltipRect = tooltip.node().getBoundingClientRect();

  let left = x + offset;
  let top = y + offset;

  if (left + tooltipRect.width > containerRect.width) {
    left = x - offset - tooltipRect.width;
  }

  if (top + tooltipRect.height > containerRect.height) {
    top = y - offset - tooltipRect.height;
  }

  left = Math.max(0, left);
  top = Math.max(0, top);

  tooltip.style('left', `${left}px`).style('top', `${top}px`);
}

export function buildLegendHtml(items) {
  return items
    .map((it) => {
      const classes = ['key', it.dot && 'dot', it.dashStyle && `key--${it.dashStyle}`]
        .filter(Boolean)
        .join(' ');
      return `<span class="item"><span class="${classes}" style="--legend-color:${it.color}"></span>${it.label}</span>`;
    })
    .join('');
}

export function resolveLegendTarget(container, legendSelector) {
  return legendSelector
    ? d3.select(legendSelector)
    : container.append('div').attr('class', 'legend');
}

function pickEvenIndices(count, max) {
  if (count <= max) return Array.from({ length: count }, (_, i) => i);
  const step = Math.ceil(count / max);
  const indices = [];
  for (let i = 0; i < count; i += step) indices.push(i);
  return indices;
}

export function selectTickRows(svg, data, tickFormat, availableWidth, minGap = 16) {
  const probe = svg.append('text').attr('class', 'tick-txt').style('visibility', 'hidden');
  let maxWidth = 0;
  data.forEach((d) => {
    probe.text(tickFormat(d));
    maxWidth = Math.max(maxWidth, probe.node().getComputedTextLength());
  });
  probe.remove();

  const maxCount = Math.max(2, Math.floor(availableWidth / (maxWidth + minGap)));
  return pickEvenIndices(data.length, maxCount).map((i) => data[i]);
}

export function appendTrendFigure(container, title) {
  container.style('position', 'relative');

  const figure = container
    .append('div')
    .attr('class', 'chart-figure')
    .attr('role', 'img')
    .attr('aria-label', title)
    .attr('tabindex', '0');

  // Figure's height is flex-grown to fill its card on desktop
  // viewBox is sized to match the figure's actual box rather than a fixed constant
  const rect = figure.node().getBoundingClientRect();
  const width = Math.round(rect.width) || TREND_CHART_WIDTH;
  const height = Math.round(rect.height) || TREND_CHART_HEIGHT;

  const svg = figure
    .append('svg')
    .attr('class', 'chart-svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'none')
    .attr('aria-hidden', 'true')
    .attr('focusable', 'false');

  const tooltip = container.append('div').attr('class', 'tt').attr('aria-hidden', 'true');

  return {
    svg,
    tooltip,
    width,
    height,
  };
}

// Re-measures `selector`'s box whenever it changes size.
// Calls `onResize` so charts can redraw at the correct size.
export function observeResize(selector, onResize) {
  if (typeof ResizeObserver === 'undefined') return undefined;
  const node = document.querySelector(selector);
  if (!node) return undefined;

  let lastWidth = null;
  let lastHeight = null;
  let frame = null;

  const observer = new ResizeObserver((entries) => {
    const { width, height } = entries[0].contentRect;
    const w = Math.round(width);
    const h = Math.round(height);
    if (w === lastWidth && h === lastHeight) return;
    lastWidth = w;
    lastHeight = h;

    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(onResize);
  });

  observer.observe(node);
  return observer;
}
