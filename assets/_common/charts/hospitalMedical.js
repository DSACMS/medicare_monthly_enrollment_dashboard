import renderLineChart from './lineChart';
import renderStackedBarChart from './stackedBarChart';
import {
  sortYearlyAscending,
  sortMonthlyAscending,
  formatPeriod,
  LINE_CHART_COLORS
} from './utils';
import { hospitalYearly, hospitalMonthly } from '../tables/hospitalMedical/tableColumns';

const HOSPITAL_LINE_SERIES = [
  { key: 'totalEnrollees', label: 'TOTAL', color: LINE_CHART_COLORS.total, primary: true },
  { key: 'maCount', label: 'MA', color: LINE_CHART_COLORS.ma },
  { key: 'ffsCount', label: 'FFS', color: LINE_CHART_COLORS.ffs },
];

const HOSPITAL_STACK_SEGMENTS = [
  { key: 'ffsPercent', countKey: 'ffsCount', label: 'FFS', color: LINE_CHART_COLORS.ffs },
  { key: 'maPercent', countKey: 'maCount', label: 'MA', color: LINE_CHART_COLORS.ma },
];

const monthTick = (d) => d.month.slice(0, 3);

/**
 * Hospital/Medical — yearly enrollment count line chart.
 * @param {string} selector
 * @param {Array} data
 * @param {Object} [extra]
 */
export function renderHospitalYearlyLineChart(selector, data, extra = {}) {
  const sorted = sortYearlyAscending(data);
  renderLineChart(selector, sorted, {
    series: HOSPITAL_LINE_SERIES,
    xAccessor: (d) => String(d.year),
    title: 'Hospital/Medical Enrollment Count Yearly Trend',
    tableColumns: hospitalYearly,
    ...extra,
  });
}

/**
 * Hospital/Medical — 12-month enrollment count line chart.
 * @param {string} selector
 * @param {Array} data
 * @param {Object} [extra]
 */
export function renderHospitalMonthlyLineChart(selector, data, extra = {}) {
  const sorted = sortMonthlyAscending(data);
  renderLineChart(selector, sorted, {
    series: HOSPITAL_LINE_SERIES,
    xAccessor: formatPeriod,
    xTickFormat: monthTick,
    title: 'Hospital/Medical Enrollment Count 12-Month Trend',
    tableColumns: hospitalMonthly,
    ...extra,
  });
}

/**
 * Hospital/Medical — yearly percent-of-total stacked bar chart.
 * @param {string} selector
 * @param {Array} data
 * @param {Object} [extra]
 */
export function renderHospitalYearlyStackedBarChart(selector, data, extra = {}) {
  const sorted = sortYearlyAscending(data);
  renderStackedBarChart(selector, sorted, {
    segments: HOSPITAL_STACK_SEGMENTS,
    xAccessor: (d) => String(d.year),
    title: 'Hospital/Medical Percent of Total Enrollment Yearly Trend',
    tableColumns: hospitalYearly,
    ...extra,
  });
}

/**
 * Hospital/Medical — 12-month percent-of-total stacked bar chart.
 * @param {string} selector
 * @param {Array} data
 * @param {Object} [extra]
 */
export function renderHospitalMonthlyStackedBarChart(selector, data, extra = {}) {
  const sorted = sortMonthlyAscending(data);
  renderStackedBarChart(selector, sorted, {
    segments: HOSPITAL_STACK_SEGMENTS,
    xAccessor: formatPeriod,
    xTickFormat: monthTick,
    title: 'Hospital/Medical Percent of Total Enrollment 12-Month Trend',
    tableColumns: hospitalMonthly,
    ...extra,
  });
}
