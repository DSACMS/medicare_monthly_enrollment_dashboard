import renderLineChart from './lineChart';
import { renderStackedBarChart } from './stackedBarChart';
import { sortYearlyAscending, sortMonthlyAscending, formatPeriod } from './utils';
import { drugYearly, drugMonthly } from '../tables/prescriptionDrug/tableColumns';

const DRUG_LINE_SERIES = [
  { key: 'pdpCount', label: 'Standalone PDP' },
  { key: 'mapdCount', label: 'MA-PD Bundled' },
];

const DRUG_STACK_SEGMENTS = [
  { key: 'pdpPercent', label: 'Standalone PDP' },
  { key: 'mapdPercent', label: 'MA-PD Bundled' },
];

/**
 * Prescription Drug — yearly enrollment count line chart.
 * @param {string} selector
 * @param {Array} data
 */
export function renderDrugYearlyLineChart(selector, data) {
  const sorted = sortYearlyAscending(data);
  renderLineChart(selector, sorted, {
    series: DRUG_LINE_SERIES,
    xAccessor: (d) => String(d.year),
    xLabel: 'Year',
    yLabel: 'Enrollment Count',
    title: 'Prescription Drug Enrollment Count Yearly Trend',
    tableColumns: drugYearly,
  });
}

/**
 * Prescription Drug — 12-month enrollment count line chart.
 * @param {string} selector
 * @param {Array} data
 */
export function renderDrugMonthlyLineChart(selector, data) {
  const sorted = sortMonthlyAscending(data);
  renderLineChart(selector, sorted, {
    series: DRUG_LINE_SERIES,
    xAccessor: formatPeriod,
    xLabel: 'Month',
    yLabel: 'Enrollment Count',
    title: 'Prescription Drug Enrollment Count 12-Month Trend',
    tableColumns: drugMonthly,
  });
}

/**
 * Prescription Drug — yearly percent-of-total stacked bar chart.
 * @param {string} selector
 * @param {Array} data
 */
export function renderDrugYearlyStackedBarChart(selector, data) {
  const sorted = sortYearlyAscending(data);
  renderStackedBarChart(selector, sorted, {
    segments: DRUG_STACK_SEGMENTS,
    xAccessor: (d) => String(d.year),
    xLabel: 'Year',
    yLabel: 'Percent of Total Enrollment',
    title: 'Prescription Drug Percent of Total Enrollment Yearly Trend',
    tableColumns: drugYearly,
  });
}

/**
 * Prescription Drug — 12-month percent-of-total stacked bar chart.
 * @param {string} selector
 * @param {Array} data
 */
export function renderDrugMonthlyStackedBarChart(selector, data) {
  const sorted = sortMonthlyAscending(data);
  renderStackedBarChart(selector, sorted, {
    segments: DRUG_STACK_SEGMENTS,
    xAccessor: formatPeriod,
    xLabel: 'Month',
    yLabel: 'Percent of Total Enrollment',
    title: 'Prescription Drug Percent of Total Enrollment 12-Month Trend',
    tableColumns: drugMonthly,
  });
}
