import * as d3 from 'd3';

/**
 * Renders a D3 table into a container element.
 * @param {string} selector  - CSS selector for the container (e.g. '#my-table')
 * @param {Array}  columnDefs - Array of { label, value } or { label, html } objects
 * @param {Array}  data       - Array of data row objects
 * @param {Object} [options]  - Optional { onRowClick } config
 * @param {Function} [options.onRowClick] - (row) => void, makes rows selectable
 */
function renderTable(selector, columnDefs, data, options = {}) {
  const { onRowClick } = options;
  const container = d3.select(selector);
  container.html('');

  const table = container.append('table');

  table.append('thead')
    .append('tr')
    .selectAll('th')
    .data(columnDefs)
    .enter()
    .append('th')
    .text((col) => col.label);

  const rows = table.append('tbody')
    .selectAll('tr')
    .data(data)
    .enter()
    .append('tr');

  if (onRowClick) {
    rows
      .classed('is-clickable', true)
      .attr('tabindex', 0)
      .on('click', (event, row) => onRowClick(row))
      .on('keydown', (event, row) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onRowClick(row);
        }
      });
  }

  rows.selectAll('td')
    .data((row) => columnDefs.map((col) => ({
      text: col.value ? col.value(row) : null,
      html: col.html ? col.html(row) : null,
    })))
    .enter()
    .append('td')
    .each(function renderCell(cell) {
      const td = d3.select(this);
      if (cell.html != null) td.html(cell.html);
      else td.text(cell.text);
    });
}

export default renderTable;