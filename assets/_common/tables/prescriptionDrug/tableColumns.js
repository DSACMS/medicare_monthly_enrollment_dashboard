import * as d3 from 'd3';

const num = d3.format(',');
const pct = (v) => `${v}%`;

export const drugYearly = [
  { label: 'Year', value: (d) => d.year },
  { label: 'Total Enrolled', value: (d) => num(d.drugTotal) },
  { label: 'PDP', value: (d) => num(d.pdpCount) },
  { label: 'MAPD', value: (d) => num(d.mapdCount) },
  { label: 'PDP %', value: (d) => pct(d.pdpPercent) },
  { label: 'MAPD %', value: (d) => pct(d.mapdPercent) },
];

export const drugMonthly = [
  { label: 'Year', value: (d) => d.year },
  { label: 'Month', value: (d) => d.month },
  { label: 'Total Enrolled', value: (d) => num(d.drugTotal) },
  { label: 'PDP', value: (d) => num(d.pdpCount) },
  { label: 'MAPD', value: (d) => num(d.mapdCount) },
  { label: 'PDP %', value: (d) => pct(d.pdpPercent) },
  { label: 'MAPD %', value: (d) => pct(d.mapdPercent) },
];
