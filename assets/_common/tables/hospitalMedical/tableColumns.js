import * as d3 from 'd3';

const num = d3.format(',');
const pct = (v) => `${v}%`;

export const hospitalYearly = [
  { label: 'Year', value: (d) => d.year },
  { label: 'Total Enrolled', value: (d) => num(d.totalEnrollees) },
  { label: 'FFS', value: (d) => num(d.ffsCount) },
  { label: 'MA', value: (d) => num(d.maCount) },
  { label: 'FFS %', value: (d) => pct(d.ffsPercent) },
  { label: 'MA %', value: (d) => pct(d.maPercent) },
];

export const hospitalMonthly = [
  { label: 'Year', value: (d) => d.year },
  { label: 'Month', value: (d) => d.month },
  { label: 'Total Enrolled', value: (d) => num(d.totalEnrollees) },
  { label: 'FFS', value: (d) => num(d.ffsCount) },
  { label: 'MA', value: (d) => num(d.maCount) },
  { label: 'FFS %', value: (d) => pct(d.ffsPercent) },
  { label: 'MA %', value: (d) => pct(d.maPercent) },
];
