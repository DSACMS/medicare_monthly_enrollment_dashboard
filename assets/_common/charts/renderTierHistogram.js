import * as d3 from 'd3';

const HISTOGRAM_WIDTH = 760;
const HISTOGRAM_HEIGHT = 180;

const HISTOGRAM_MARGIN = {
  top: 32,
  right: 24,
  bottom: 40,
  left: 8,
};

/**
 * Renders a histogram that also serves as the choropleth legend.
 *
 * Each bar represents the number of geographic areas whose metric falls
 * within one of the map's threshold tiers.
 *
 * @param {string} containerSelector
 * @param {Object[]} data
 * @param {Object} config
 * @param {Function} config.metricPercent
 * @param {string} config.metricLabel
 * @param {number[]} config.breakpoints
 * @param {string[]} config.colors
 * @param {string} config.areaLabel
 * @param {string} [config.contextLabel]
 */
function renderTierHistogram(
  containerSelector,
  data,
  {
    metricPercent,
    metricLabel,
    breakpoints,
    colors,
    areaLabel,
    contextLabel = '',
  },
) {
  const container = d3.select(containerSelector);

  if (container.empty()) return;

  container.selectAll('*').remove();

  if (
    !Array.isArray(data)
    || !data.length
    || typeof metricPercent !== 'function'
    || breakpoints?.length !== 4
    || colors?.length !== 5
  ) {
    container
      .append('p')
      .attr('class', 'map-tier-histogram__empty')
      .text('No tier data available.');

    return;
  }

  const values = data
    .map((row) => Number(metricPercent(row)))
    .filter((value) => Number.isFinite(value));

  const rawMax = d3.max(values) ?? 100;
  const domainMax = Math.ceil(rawMax);

  const noDataCount = data.length - values.length;
  const edges = [0, ...breakpoints, domainMax];

  const tiers = colors.map((color, index) => {
    const lower = edges[index];
    const upper = edges[index + 1];
    const isLastTier = index === colors.length - 1;

    const count = values.filter(
      (value) => value >= lower && (isLastTier ? value <= upper : value < upper),
    ).length;

    return {
      lower,
      upper,
      color,
      count,
      label: `${lower}%–${upper}%`,
    };
  })
  .filter((tier) => tier.count > 0);

 const title = `${contextLabel}: ${metricLabel} Enrollment Distribution Count`;
 const countLabel = `Number of ${areaLabel.toLowerCase()}`;



  const figure = container
    .append('div')
    .attr('class', 'map-tier-histogram__figure')
    .attr('role', 'img')
    .attr(
      'aria-label',
      `${title}. ${tiers
        .map((tier) => `${tier.label}: ${tier.count} ${areaLabel.toLowerCase()}`)
        .join('. ')}.${noDataCount ? ` No data: ${noDataCount}.` : ''}`,
    );

  const svg = figure
    .append('svg')
    .attr('width', '100%')
    .attr('viewBox', `0 0 ${HISTOGRAM_WIDTH} ${HISTOGRAM_HEIGHT}`)
    .attr('aria-hidden', 'true')
    .attr('focusable', 'false');

  const innerWidth =
    HISTOGRAM_WIDTH
    - HISTOGRAM_MARGIN.left
    - HISTOGRAM_MARGIN.right;

  const innerHeight =
    HISTOGRAM_HEIGHT
    - HISTOGRAM_MARGIN.top
    - HISTOGRAM_MARGIN.bottom;

  const chart = svg
    .append('g')
    .attr(
      'transform',
      `translate(${HISTOGRAM_MARGIN.left},${HISTOGRAM_MARGIN.top})`,
    );

  const x = d3
    .scaleLinear()
    .domain([0, domainMax])
    .range([0, innerWidth]);

  const maxCount = d3.max(tiers, (tier) => tier.count) || 1;

  const y = d3
    .scaleLinear()
    .domain([0, maxCount])
    .nice()
    .range([innerHeight, 0]);


  chart
    .selectAll('.map-tier-histogram__bar')
    .data(tiers)
    .join('rect')
    .attr('class', 'map-tier-histogram__bar')
    .attr('x', (tier) => x(tier.lower) + 1)
    .attr('y', (tier) => y(tier.count))
    .attr(
      'width',
      (tier) => Math.max(0, x(tier.upper) - x(tier.lower) - 2),
    )
    .attr('height', (tier) => innerHeight - y(tier.count))
    .attr('fill', (tier) => tier.color);

  chart
    .selectAll('.map-tier-histogram__count')
    .data(tiers)
    .join('text')
    .attr('class', 'map-tier-histogram__count')
    .attr(
      'x',
      (tier) => x(tier.lower) + ((x(tier.upper) - x(tier.lower)) / 2),
    )
    .attr('y', (tier) => y(tier.count) - 7)
    .attr('text-anchor', 'middle')
    .text((tier) => tier.count);

  const xAxis = d3
    .axisBottom(x)
    .tickValues(edges)
    .tickFormat((value) => `${value}%`)
    .tickSizeOuter(0);

  chart
    .append('g')
    .attr('class', 'map-tier-histogram__x-axis')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(xAxis);

  container
  .append('p')
  .attr('class', 'map-tier-histogram__title')
  .text(title);

  container
    .append('p')
    .attr('class', 'map-tier-histogram__subtitle')
    .text(countLabel);
}

export default renderTierHistogram;