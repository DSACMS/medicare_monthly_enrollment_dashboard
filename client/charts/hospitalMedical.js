import { renderLineChart } from './lineChart.js';
import { renderStackedBarChart, formatPercent } from './stackedBarChart.js';
import { sortYearlyAscending, sortMonthlyAscending, formatPeriod } from './utils.js';

const num = d3.format(',');

const HOSPITAL_LINE_SERIES = [
  { key: 'ffsCount', label: 'Fee-For-Service (FFS)' },
  { key: 'maCount', label: 'Medicare Advantage (MA)' },
];

const HOSPITAL_STACK_SEGMENTS = [
  { key: 'ffsPercent', label: 'Fee-For-Service (FFS)' },
  { key: 'maPercent', label: 'Medicare Advantage (MA)' },
];

const hospitalYearlyTableColumns = [
  { label: 'Year', value: (d) => d.year },
  { label: 'FFS Count', value: (d) => num(d.ffsCount) },
  { label: 'MA Count', value: (d) => num(d.maCount) },
  { label: 'FFS %', value: (d) => formatPercent(d.ffsPercent) },
  { label: 'MA %', value: (d) => formatPercent(d.maPercent) },
];

const hospitalMonthlyTableColumns = [
  { label: 'Year', value: (d) => d.year },
  { label: 'Month', value: (d) => d.month },
  { label: 'FFS Count', value: (d) => num(d.ffsCount) },
  { label: 'MA Count', value: (d) => num(d.maCount) },
  { label: 'FFS %', value: (d) => formatPercent(d.ffsPercent) },
  { label: 'MA %', value: (d) => formatPercent(d.maPercent) },
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
    tableColumns: hospitalYearlyTableColumns,
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
    tableColumns: hospitalMonthlyTableColumns,
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
    tableColumns: hospitalYearlyTableColumns,
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
    tableColumns: hospitalMonthlyTableColumns,
  });
}
