/**
 * Renders a D3 table into a container element.
 * @param {string} selector  - CSS selector for the container (e.g. '#my-table')
 * @param {Array}  columnDefs - Array of { label, value } objects
 * @param {Array}  data       - Array of data row objects
 */
export function renderTable(selector, columnDefs, data) {
  const container = d3.select(selector);
  container.html('');

  const table = container.append('table');

  table.append('thead')
    .append('tr')
    .selectAll('th')
    .data(columnDefs)
    .enter()
    .append('th')
    .text(col => col.label);

  const rows = table.append('tbody')
    .selectAll('tr')
    .data(data)
    .enter()
    .append('tr');

  rows.selectAll('td')
    .data(row => columnDefs.map(col => col.value(row)))
    .enter()
    .append('td')
    .text(cell => cell);
}
