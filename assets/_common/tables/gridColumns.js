import * as d3 from 'd3';
import DASHBOARD_LABELS from '../labels';
import usStates from '../../../_data/usStates.json';
import { formatCount, NO_DATA_LABEL, SUPPRESSED_LABEL } from '../charts/utils';

const formatNum = d3.format(',');

// API's "State" geo level includes territories (e.g. Puerto Rico) --
// can't be handed off to the map, so grid/drawer render them disabled
// with a warning label instead.
const mappableStateNames = new Set(usStates);

const hospitalLabels = DASHBOARD_LABELS.hospitalMedical;
const drugLabels = DASHBOARD_LABELS.prescriptionDrug;
const dashboardLabelsFor = (type) => (type === 'drug' ? drugLabels : hospitalLabels);

export const rowTotal = (type, d) => (type === 'drug' ? d.drugTotal : d.totalEnrollees);

// Grid rounds to a whole percent for compact display, unlike the map/sr
// table's formatPercent -- kept separate for that reason, but shares
// NO_DATA_LABEL so both stay in sync.
const roundPct = (v) => (Number.isFinite(v) ? `${Math.round(v)}%` : NO_DATA_LABEL);

const compactNum = (value) => {
  if (value >= 1e6) return `${(value / 1e6).toFixed(value >= 1e7 ? 1 : 2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(value >= 1e4 ? 0 : 1)}K`;
  return formatNum(value);
};

const countCol = (label, getter) => ({
  label,
  html: (d) => {
    const n = getter(d);
    if (!Number.isFinite(n)) return `<span class="num-full">${formatCount(n)}</span>`;
    return `<span class="num-full">${formatNum(n)}</span><span class="num-abbr">${compactNum(n)}</span>`;
  },
  sortValue: getter,
});

const stateNameColumn = {
  label: 'State',
  value: (d) => d.stateName,
  sortValue: (d) => d.stateName,
  html: (d) =>
    mappableStateNames.has(d.stateName)
      ? d.stateName
      : `${d.stateName} <span class="data-grid-unmappable-note" title="Not part of the state map — this area can't be selected."><svg class="data-grid-unmappable-note__icon" aria-hidden="true" focusable="false"><use xlink:href="#svg-warning"></use></svg>Not on map</span>`,
};

// Counties with no usable total (ex. Kalawao County, HI, where CMS
// suppresses even TOT_BENES) still show up here, flagged -- but selectable,
// matching the map -- rather than silently dropped. A suppressed total
// (null) gets its own "Suppressed" flag distinct from a genuinely
// missing/zero total's "No data" -- otherwise the tag next to the county
// name would contradict what its own TOTAL/MA/OM cells say.
const countyNameColumnFor = (type) => ({
  label: 'County',
  value: (d) => d.county,
  sortValue: (d) => d.county,
  html: (d) => {
    const total = rowTotal(type, d);
    if (total > 0) return d.county;

    const isSuppressed = total === null;
    const label = isSuppressed ? SUPPRESSED_LABEL : 'No data';
    const title = isSuppressed
      ? 'CMS suppressed enrollment data for this county.'
      : 'No enrollment data available for this county.';

    return `${d.county} <span class="data-grid-unmappable-note" title="${title}"><svg class="data-grid-unmappable-note__icon" aria-hidden="true" focusable="false"><use xlink:href="#svg-warning"></use></svg>${label}</span>`;
  },
});

function buildMetricColumns(labels) {
  return [
    countCol('TOTAL', (d) => d[labels.total.key]),
    countCol(labels.type1.label, (d) => d[labels.type1.key]),
    countCol(labels.type2.label, (d) => d[labels.type2.key]),
    {
      label: `${labels.type1.label} %`,
      value: (d) => roundPct(d[labels.type1.percentKey]),
      sortValue: (d) => d[labels.type1.percentKey],
    },
    {
      label: `${labels.type2.label} %`,
      value: (d) => roundPct(d[labels.type2.percentKey]),
      sortValue: (d) => d[labels.type2.percentKey],
    },
  ];
}

function buildAreaColumns(labels) {
  return [stateNameColumn, ...buildMetricColumns(labels)];
}

function buildCountyColumns(type, labels) {
  return [countyNameColumnFor(type), ...buildMetricColumns(labels)];
}

const hospitalAreaColumns = buildAreaColumns(hospitalLabels);
const drugAreaColumns = buildAreaColumns(drugLabels);
const hospitalCountyColumns = buildCountyColumns('hospital', hospitalLabels);
const drugCountyColumns = buildCountyColumns('drug', drugLabels);

export const areaColumnsFor = (type) => (type === 'drug' ? drugAreaColumns : hospitalAreaColumns);
export const countyColumnsFor = (type) =>
  type === 'drug' ? drugCountyColumns : hospitalCountyColumns;

// range is passed explicitly (rather than read from caller-side state) so
// this stays a pure function of its arguments.
export function buildTrendGridColumns(type, range) {
  const periodCols =
    range === 'monthly'
      ? [
          { label: 'Year', value: (d) => d.year, sortValue: (d) => d.year },
          { label: 'Month', value: (d) => d.month, sortValue: (d) => d.month },
        ]
      : [{ label: 'Year', value: (d) => d.year, sortValue: (d) => d.year }];

  const { total, type1, type2 } = dashboardLabelsFor(type);

  return [
    ...periodCols,
    { label: 'Total', value: (d) => formatCount(d[total.key]), sortValue: (d) => d[total.key] },
    { label: type1.label, value: (d) => formatCount(d[type1.key]), sortValue: (d) => d[type1.key] },
    { label: type2.label, value: (d) => formatCount(d[type2.key]), sortValue: (d) => d[type2.key] },
    { label: `${type1.label} %`, value: (d) => roundPct(d[type1.percentKey]), sortValue: (d) => d[type1.percentKey] },
    { label: `${type2.label} %`, value: (d) => roundPct(d[type2.percentKey]), sortValue: (d) => d[type2.percentKey] },
  ];
}
