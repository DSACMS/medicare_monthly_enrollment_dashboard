import renderLineChart from './lineChart';
import renderStackedBarChart from './stackedBarChart';
import {
  sortYearlyAscending,
  sortMonthlyAscending,
  formatPeriod,
  formatMillions,
} from './utils';
import { SERIES_COLORS } from './colors';
import { hospitalYearly, hospitalMonthly } from '../tables/hospitalMedical/tableColumns';

const HOSPITAL_LINE_SERIES = [
  { key: 'ffsCount', label: 'FFS', color: SERIES_COLORS.ffs },
  { key: 'maCount', label: 'MA', color: SERIES_COLORS.ma },
  { key: 'totalEnrollees', label: 'TOTAL', color: SERIES_COLORS.total },
];

const HOSPITAL_STACK_SEGMENTS = [
  { key: 'ffsPercent', countKey: 'ffsCount', label: 'FFS', color: SERIES_COLORS.ffs },
  { key: 'maPercent', countKey: 'maCount', label: 'MA', color: SERIES_COLORS.ma },
];

/**
 * Hospital/Medical — yearly enrollment count line chart.
 * @param {string} selector
 * @param {Array} data
 */
export function renderHospitalYearlyLineChart(selector, data) {
  const sorted = sortYearlyAscending(data);
  renderLineChart(selector, sorted, {
    series: HOSPITAL_LINE_SERIES,
    xAccessor: (d) => String(d.year),
    xLabel: 'Year',
    yLabel: 'Enrollment Count',
    title: 'Hospital/Medical Enrollment Count Yearly Trend',
    tableColumns: hospitalYearly,
    yTickFormat: formatMillions,
  });
}

/**
 * Hospital/Medical — 12-month enrollment count line chart.
 * @param {string} selector
 * @param {Array} data
 */
export function renderHospitalMonthlyLineChart(selector, data) {
  const sorted = sortMonthlyAscending(data);
  renderLineChart(selector, sorted, {
    series: HOSPITAL_LINE_SERIES,
    xAccessor: formatPeriod,
    xLabel: 'Month',
    yLabel: 'Enrollment Count',
    title: 'Hospital/Medical Enrollment Count 12-Month Trend',
    tableColumns: hospitalMonthly,
    yTickFormat: formatMillions,
  });
}

/**
 * Hospital/Medical — yearly percent-of-total stacked bar chart.
 * @param {string} selector
 * @param {Array} data
 */
export function renderHospitalYearlyStackedBarChart(selector, data) {
  const sorted = sortYearlyAscending(data);
  renderStackedBarChart(selector, sorted, {
    segments: HOSPITAL_STACK_SEGMENTS,
    xAccessor: (d) => String(d.year),
    xLabel: 'Year',
    yLabel: 'Percent of Total Enrollment',
    title: 'Hospital/Medical Percent of Total Enrollment Yearly Trend',
    tableColumns: hospitalYearly,
  });
}

/**
 * Hospital/Medical — 12-month percent-of-total stacked bar chart.
 * @param {string} selector
 * @param {Array} data
 */
export function renderHospitalMonthlyStackedBarChart(selector, data) {
  const sorted = sortMonthlyAscending(data);
  renderStackedBarChart(selector, sorted, {
    segments: HOSPITAL_STACK_SEGMENTS,
    xAccessor: formatPeriod,
    xLabel: 'Month',
    yLabel: 'Percent of Total Enrollment',
    title: 'Hospital/Medical Percent of Total Enrollment 12-Month Trend',
    tableColumns: hospitalMonthly,
  });
}
