// Generic, dashboard-state-agnostic helpers reused across the grid, drawer,
// and overlay UI for both the state and county views

// Flips {index, direction} for a newly-clicked column (resets to
// ascending on a column switch). Shared by both drawers and both grids.
export const toggleSort = (current, index) =>
  current.index === index
    ? { index, direction: current.direction === 'asc' ? 'desc' : 'asc' }
    : { index, direction: 'asc' };

export const sortRows = (rows, cols, sortState) => {
  const col = cols[sortState.index] || cols[0];
  const getSortValue = col.sortValue || col.value || (() => '');
  const dir = sortState.direction === 'desc' ? -1 : 1;

  return [...rows].sort((a, b) => {
    const av = getSortValue(a);
    const bv = getSortValue(b);
    // A suppressed count's sortValue is null -- always sorts last
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });
};

export const updateScrollAffordance = (scrollEl) => {
  const wrap = scrollEl?.closest('.data-grid-scroll-wrap');
  if (!wrap) return;

  const { scrollWidth, clientWidth, scrollLeft } = scrollEl;
  const canScrollX = scrollWidth > clientWidth + 1;

  wrap.classList.toggle('is-scrollable-x', canScrollX);
  wrap.classList.toggle('is-at-start', scrollLeft <= 1);
  wrap.classList.toggle('is-at-end', scrollLeft + clientWidth >= scrollWidth - 2);

  if (canScrollX) {
    scrollEl.setAttribute('aria-description', 'Scroll horizontally to see more columns.');
  } else {
    scrollEl.removeAttribute('aria-description');
  }
};

export const bindScrollAffordance = (scrollEl) => {
  if (!scrollEl) return;
  if (scrollEl.dataset.scrollBound === 'true') {
    updateScrollAffordance(scrollEl);
    return;
  }

  scrollEl.dataset.scrollBound = 'true';
  scrollEl.addEventListener('scroll', () => updateScrollAffordance(scrollEl), { passive: true });
  window.addEventListener('resize', () => updateScrollAffordance(scrollEl));
  updateScrollAffordance(scrollEl);
};

export const scrollRowIntoView = (row, { smooth = false } = {}) => {
  const container = row?.closest('.data-grid-scroll');
  if (!container) return;

  const containerRect = container.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  const headerHeight = container.querySelector('thead')?.getBoundingClientRect().height || 0;

  let delta = 0;
  if (rowRect.top < containerRect.top + headerHeight) {
    delta = rowRect.top - (containerRect.top + headerHeight);
  } else if (rowRect.bottom > containerRect.bottom) {
    delta = rowRect.bottom - containerRect.bottom;
  }

  if (delta !== 0) container.scrollBy({ top: delta, behavior: smooth ? 'smooth' : 'auto' });
};

export const syncColumnHeights = () => {
  const columnsEl = document.querySelector('.dashboard-columns');
  const main = document.querySelector('.dashboard-columns__main');
  const side = document.querySelector('.dashboard-columns__side');
  if (!columnsEl || !main || !side) return;

  const isTwoColumn =
    getComputedStyle(columnsEl).gridTemplateColumns.trim().split(/\s+/).length >= 2;
  if (!isTwoColumn) {
    main.style.height = '';
    side.style.height = '';
    return;
  }

  const prevTarget = main.style.height;

  // Reset first so the offsetHeight reads below reflect natural content,
  // not a height we applied on a previous pass.
  main.style.height = '';
  side.style.height = '';
  const target = `${Math.max(main.offsetHeight, side.offsetHeight)}px`;

  if (target === prevTarget) return;
  main.style.height = target;
  side.style.height = target;
};

const getFocusableEls = (container) =>
  Array.from(container.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])'));

export const makeDrawerEls = (prefix) => ({
  trigger: document.querySelector(`#${prefix}-mobile-trigger`),
  triggerValue: document.querySelector(`#${prefix}-mobile-trigger-value`),
  triggerDot: document.querySelector(`#${prefix}-mobile-trigger-dot`),
  triggerClear: document.querySelector(`#${prefix}-mobile-trigger-clear`),
  overlay: document.querySelector(`#${prefix}-drawer-overlay`),
  panel: document.querySelector(`#${prefix}-drawer`),
  closeBtn: document.querySelector(`#${prefix}-drawer-close`),
  search: document.querySelector(`#${prefix}-drawer-search`),
  theadRow: document.querySelector(`#${prefix}-drawer-thead-row`),
  tbody: document.querySelector(`#${prefix}-drawer-tbody`),
});

export const makeOverlayEls = (prefix) => ({
  trigger: document.querySelector(`#${prefix}-expand-trigger`),
  scrim: document.querySelector(`#${prefix}-overlay-scrim`),
  panel: document.querySelector(`#${prefix}-overlay`),
  body: document.querySelector(`#${prefix}-overlay-body`),
  closeBtn: document.querySelector(`#${prefix}-overlay-close`),
  tabsSlot: document.querySelector(`#${prefix}-overlay-tabs-slot`),
});

// Generic popup "chrome" shared by all 4 popups (2 drawers, 2 overlays).
// Popup-specific behavior (render a list, reparent a DOM node) comes in via hooks.
export const createPopup = ({
  scrim,
  panel,
  trigger,
  isDisabled = () => false,
  bodyLockClass,
  focusOnOpen,
  onBeforeOpen,
  onOpen,
  onClose,
}) => {
  let lastFocusedEl = null;
  let onKeydown;

  const isOpen = () => Boolean(panel?.classList.contains('is-open'));

  const close = () => {
    if (!isOpen()) return;
    onClose?.();
    scrim.classList.remove('is-open');
    panel.classList.remove('is-open');
    trigger?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove(bodyLockClass);
    document.removeEventListener('keydown', onKeydown);
    (lastFocusedEl || trigger)?.focus();
  };

  onKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab' || !panel) return;
    const focusable = getFocusableEls(panel);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const open = () => {
    if (!panel || !scrim || isDisabled()) return;
    onBeforeOpen?.();
    lastFocusedEl = document.activeElement;
    onOpen?.();
    scrim.classList.add('is-open');
    panel.classList.add('is-open');
    trigger?.setAttribute('aria-expanded', 'true');
    document.body.classList.add(bodyLockClass);
    document.addEventListener('keydown', onKeydown);
    focusOnOpen?.();
  };

  return { open, close, isOpen };
};

export const renderSortableDrawerHead = (theadRow, cols, sortState, onSortClick) => {
  if (!theadRow) return;
  theadRow.innerHTML = '';

  cols.forEach((col, index) => {
    const th = document.createElement('th');
    th.scope = 'col';

    const isActive = sortState.index === index;
    let ariaSortValue = 'none';
    let arrow = '';
    if (isActive) {
      ariaSortValue = sortState.direction === 'asc' ? 'ascending' : 'descending';
      arrow = sortState.direction === 'asc' ? ' ▲' : ' ▼';
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'data-grid-sort-button';
    button.classList.toggle('is-active', isActive);
    th.setAttribute('aria-sort', ariaSortValue);
    button.innerHTML = `${col.label}<span aria-hidden="true">${arrow}</span>`;
    button.addEventListener('click', () => onSortClick(index));

    th.appendChild(button);
    theadRow.appendChild(th);
  });
};

// isRowSelectable defaults to "no restriction" (county's case); the
// state grid overrides it with a mappable-state check.
export const renderDrawerRows = (
  tbody,
  rows,
  cols,
  { emptyMessage, isRowSelectable = () => true, isRowSelected = () => false, onSelectRow },
) => {
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.className = 'data-grid-drawer__empty';
    td.colSpan = cols.length;
    td.textContent = emptyMessage;
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement('tr');
    const selectable = isRowSelectable(row);
    tr.classList.toggle('is-selected', isRowSelected(row));

    cols.forEach((col) => {
      const td = document.createElement('td');
      const cellHtml = col.html ? col.html(row) : null;
      if (cellHtml != null) {
        td.innerHTML = cellHtml;
      } else {
        td.textContent = col.value(row);
      }
      tr.appendChild(td);
    });

    if (selectable) {
      tr.tabIndex = 0;
      tr.classList.add('is-clickable');

      const selectRow = () => onSelectRow(row);
      tr.addEventListener('click', selectRow);
      tr.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectRow();
        }
      });
    } else {
      tr.classList.add('is-unselectable');
    }

    tbody.appendChild(tr);
  });
};

export const filterAndSortDrawerRows = (rows, cols, sortState, searchTerm, matchesSearch) => {
  const term = searchTerm.trim().toLowerCase();
  const filtered = term ? rows.filter((row) => matchesSearch(row, term)) : rows;
  return sortRows(filtered, cols, sortState);
};


// Converts column defs + row data into a CSV file and triggers a browser
// download. Reuses the same {label, value} column shape as renderTable.
export const downloadTableAsCsv = (filename, columnDefs, data) => {
  const escapeCsvValue = (value) => {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = columnDefs.map((col) => escapeCsvValue(col.label)).join(',');
  const bodyRows = data.map((row) =>
    columnDefs.map((col) => escapeCsvValue(col.value ? col.value(row) : '')).join(','),
  );
  const csvContent = [headerRow, ...bodyRows].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};