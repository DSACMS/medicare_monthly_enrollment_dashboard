import renderLineChart from './lineChart';
import renderStackedBarChart from './stackedBarChart';
import {
  sortYearlyAscending,
  sortMonthlyAscending,
  formatPeriod,
} from './utils';
import { SERIES_COLORS } from './colors';
import { drugYearly, drugMonthly } from '../tables/prescriptionDrug/tableColumns';

const DRUG_LINE_SERIES = [
  { key: 'drugTotal', label: 'TOTAL', color: SERIES_COLORS.total, primary: true },
  { key: 'mapdCount', label: 'MA-PD', color: SERIES_COLORS.ma },
  { key: 'pdpCount', label: 'PDP', color: SERIES_COLORS.ffs },
];

const DRUG_STACK_SEGMENTS = [
  { key: 'pdpPercent', countKey: 'pdpCount', label: 'PDP', color: SERIES_COLORS.ffs },
  { key: 'mapdPercent', countKey: 'mapdCount', label: 'MA-PD', color: SERIES_COLORS.ma },
];

const monthTick = (d) => d.month.slice(0, 3);

/**
 * Prescription Drug — yearly enrollment count line chart.
 * @param {string} selector
 * @param {Array} data
 * @param {Object} [extra]
 */
export function renderDrugYearlyLineChart(selector, data, extra = {}) {
  const sorted = sortYearlyAscending(data);
  renderLineChart(selector, sorted, {
    series: DRUG_LINE_SERIES,
    xAccessor: (d) => String(d.year),
    title: 'Prescription Drug Enrollment Count Yearly Trend',
    tableColumns: drugYearly,
    ...extra,
  });
}

/**
 * Prescription Drug — 12-month enrollment count line chart.
 * @param {string} selector
 * @param {Array} data
 * @param {Object} [extra]
 */
export function renderDrugMonthlyLineChart(selector, data, extra = {}) {
  const sorted = sortMonthlyAscending(data);
  renderLineChart(selector, sorted, {
    series: DRUG_LINE_SERIES,
    xAccessor: formatPeriod,
    xTickFormat: monthTick,
    title: 'Prescription Drug Enrollment Count 12-Month Trend',
    tableColumns: drugMonthly,
    ...extra,
  });
}

/**
 * Prescription Drug — yearly percent-of-total stacked bar chart.
 * @param {string} selector
 * @param {Array} data
 * @param {Object} [extra]
 */
export function renderDrugYearlyStackedBarChart(selector, data, extra = {}) {
  const sorted = sortYearlyAscending(data);
  renderStackedBarChart(selector, sorted, {
    segments: DRUG_STACK_SEGMENTS,
    xAccessor: (d) => String(d.year),
    title: 'Prescription Drug Percent of Total Enrollment Yearly Trend',
    tableColumns: drugYearly,
    ...extra,
  });
}

/**
 * Prescription Drug — 12-month percent-of-total stacked bar chart.
 * @param {string} selector
 * @param {Array} data
 * @param {Object} [extra]
 */
export function renderDrugMonthlyStackedBarChart(selector, data, extra = {}) {
  const sorted = sortMonthlyAscending(data);
  renderStackedBarChart(selector, sorted, {
    segments: DRUG_STACK_SEGMENTS,
    xAccessor: formatPeriod,
    xTickFormat: monthTick,
    title: 'Prescription Drug Percent of Total Enrollment 12-Month Trend',
    tableColumns: drugMonthly,
    ...extra,
  });
}
