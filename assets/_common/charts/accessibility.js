/**
 * Renders a screen-reader-accessible data table mirroring chart data.
 * Uses .usa-sr-only per Section 508 requirements; pairs with existing .sr-only in styles.css.
 */
function renderSrTable(container, caption, columns, data) {
  const wrapper = container
    .append('div')
    .attr('class', 'usa-sr-only sr-only');

  const table = wrapper.append('table');

  table.append('caption').text(caption);

  table
    .append('thead')
    .append('tr')
    .selectAll('th')
    .data(columns)
    .enter()
    .append('th')
    .attr('scope', 'col')
    .text((col) => col.label);

  const rows = table
    .append('tbody')
    .selectAll('tr')
    .data(data)
    .enter()
    .append('tr');

  rows
    .selectAll('td')
    .data((row) => columns.map((col) => col.value(row)))
    .enter()
    .append('td')
    .text((cell) => cell);
}

export default renderSrTable;