import * as d3 from 'd3';
import renderSrTable from './accessibility';

const SLOTS = ['A', 'B'];

function formatMillions(n) {
  return `${(n / 1000000).toFixed(1)}M`;
}

/**
 * Updates the "total + split bar" hero card (see .dash-hero in
 * dashboard-v2.scss). Unlike renderPieChart, this doesn't build DOM from
 * scratch — the markup (ids heroTotal/heroSeg{A,B}/etc.) already lives in
 * hero-card.njk, so this just fills it in. NOTE: assumes exactly 2 data points.
 *
 * @param {string} containerSelector - CSS selector for the hero <section>.
 * @param {{name: string, label: string, value: number}[]} data - exactly two items;
 *   value is a percent (0-100).
 * @param {number} totalEnrollment - raw total enrollment count (not in millions).
 * @param {Object} [config]
 * @param {string[]} [config.colors] - two CSS colors, indexed to match `data` order.
 * @param {string} [config.title] - Accessible name for the data; used as the
 *   sr-only table's <caption>.
 * @param {{label: string, value: Function}[]} [config.tableColumns] - Column
 *   definitions for the sr-only table.
 */
function renderEnrollmentHero(containerSelector, data, totalEnrollment, config = {}) {
  if (!data || data.length !== 2) {
    return { success: false, error: 'renderEnrollmentHero: expected exactly 2 data points.' };
  }
  if (!totalEnrollment) {
    return { success: false, error: 'renderEnrollmentHero: totalEnrollment is missing or zero.' };
  }

  const {
    colors = [],
    title = containerSelector,
    tableColumns = [
      { label: 'Program', value: (d) => d.name },
      { label: 'Percent of total', value: (d) => `${Math.round(d.value)}%` },
    ],
  } = config;

  const container = d3.select(containerSelector);
  if (container.empty()) {
    return { success: false, error: `renderEnrollmentHero: no element matches "${containerSelector}".` };
  }

  container.select('#heroTotal').text(formatMillions(totalEnrollment));

  SLOTS.forEach((slot, i) => {
    const datum = data[i];
    const color = colors[i];
    const amount = (datum.value / 100) * totalEnrollment;

    container.select(`#heroName${slot}`).text(datum.label ?? datum.name);
    container.select(`#heroSeg${slot}`)
      .style('background', color)
      .style('width', `${Math.max(datum.value, 0)}%`);
    container.select(`#heroBig${slot}`).text(formatMillions(amount));
    container.select(`#heroSub${slot}`).text(`${Math.round(datum.value)}%`);
  });

  container.select('#heroSplitBar')
    .attr('aria-label', `Enrollment split: ${data.map((d) => `${d.label ?? d.name} ${Math.round(d.value)}%`).join(', ')}`);

  // Re-rendered on every toggle, so drop the previous sr-only table first.
  container.select('.usa-sr-only.sr-only').remove();
  renderSrTable(container, title, tableColumns, data);

  return { success: true };
}

export default renderEnrollmentHero;
