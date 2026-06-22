const MONTH_ORDER = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
};

export const CHART_MARGIN = { top: 24, right: 140, bottom: 56, left: 80 };

export function clearContainer(selector) {
  return d3.select(selector).html('');
}

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

export function getChartSize(containerNode, height = 400) {
  const width = containerNode.getBoundingClientRect().width || 800;
  const margin = CHART_MARGIN;
  return {
    width,
    height,
    margin,
    innerWidth: width - margin.left - margin.right,
    innerHeight: height - margin.top - margin.bottom,
  };
}

export function appendChartSvg(container, width, height, ariaLabel) {
  const wrapper = container
    .append('div')
    .attr('role', 'img')
    .attr('aria-label', ariaLabel);

  const svg = wrapper
    .append('svg')
    .attr('width', '100%')
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('aria-hidden', 'true')
    .attr('focusable', 'false');

  return { svg, wrapper };
}

export function addHatchPattern(svg, id, stroke, baseFill = '#f8f9fa') {
  const defs = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs');

  const pattern = defs
    .append('pattern')
    .attr('id', id)
    .attr('patternUnits', 'userSpaceOnUse')
    .attr('width', 6)
    .attr('height', 6)
    .attr('patternTransform', 'rotate(45)');

  pattern.append('rect').attr('width', 6).attr('height', 6).attr('fill', baseFill);

  pattern
    .append('line')
    .attr('x1', 0)
    .attr('y1', 0)
    .attr('x2', 0)
    .attr('y2', 6)
    .attr('stroke', stroke)
    .attr('stroke-width', 2);
}
