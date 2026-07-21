import * as d3 from 'd3';

/**
 * Renders a D3 table into a container element.
 * @param {string} selector  - CSS selector for the container (e.g. '#my-table')
 * @param {Array}  columnDefs - Array of { label, value } or { label, html } objects
 * @param {Array}  data       - Array of data row objects
 * @param {Object} [options]  - Optional { onRowClick, isRowSelectable, isRowSelected, sortState, onSort } config
 * @param {Function} [options.onRowClick] - (row) => void, makes rows selectable
 * @param {Function} [options.isRowSelectable] - (row) => boolean, defaults to
 *   always-selectable. Rows failing this check don't get onRowClick's
 *   listeners/tabindex and are marked `.is-unselectable` instead of
 *   `.is-clickable` for styling.
 * @param {Function} [options.isRowSelected] - (row) => boolean, defaults to
 *   never-selected. Matching rows get `.is-selected` for styling (e.g. the
 *   currently-active state in the all-areas grid).
 * @param {{index: number, direction: 'asc'|'desc'}} [options.sortState] - currently
 *   active column/direction, for the header's aria-sort + arrow indicator.
 * @param {Function} [options.onSort] - (columnIndex) => void. Passing this
 *   makes headers clickable buttons instead of plain text (caller owns the
 *   sort state and re-renders with already-sorted `data`).
 */
function renderTable(selector, columnDefs, data, options = {}) {
  const {
    onRowClick, isRowSelectable = () => true, isRowSelected = () => false, sortState, onSort,
  } = options;
  const container = d3.select(selector);
  container.html('');

  const table = container.append('table');

  const headerCells = table.append('thead')
    .append('tr')
    .selectAll('th')
    .data(columnDefs)
    .enter()
    .append('th');

  if (onSort) {
    headerCells.each(function renderSortableHeader(col, index) {
      const th = d3.select(this);
      const isActive = sortState?.index === index;
      let ariaSortValue = 'none';
      if (isActive) ariaSortValue = sortState.direction === 'asc' ? 'ascending' : 'descending';
      th.attr('aria-sort', ariaSortValue);

      const button = th.append('button')
        .attr('type', 'button')
        .attr('class', 'data-grid-sort-button')
        .classed('is-active', isActive)
        .on('click', () => onSort(index));

      button.append('span').text(col.label);
      if (isActive) {
        button.append('span')
          .attr('aria-hidden', 'true')
          .text(sortState.direction === 'asc' ? ' ▲' : ' ▼');
      }
    });
  } else {
    headerCells.text((col) => col.label);
  }

  const rows = table.append('tbody')
    .selectAll('tr')
    .data(data)
    .enter()
    .append('tr');

  rows.classed('is-selected', (row) => isRowSelected(row));

  if (onRowClick) {
    rows.classed('is-unselectable', (row) => !isRowSelectable(row));

    rows
      .filter((row) => isRowSelectable(row))
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