const num = d3.format(",");
const pct = (v) => `${v}%`;

// ── Hospital / Medical ───────────────────────────────────────────────

export const hospitalYearly = [
  { label: "Year", value: (d) => d.year },
  { label: "Total Enrolled", value: (d) => num(d.totalEnrollees) },
  { label: "FFS", value: (d) => num(d.ffsCount) },
  { label: "MA", value: (d) => num(d.maCount) },
  { label: "FFS %", value: (d) => pct(d.ffsPercent) },
  { label: "MA %", value: (d) => pct(d.maPercent) },
];

export const hospitalMonthly = [
  { label: "Year", value: (d) => d.year },
  { label: "Month", value: (d) => d.month },
  { label: "Total Enrolled", value: (d) => num(d.totalEnrollees) },
  { label: "FFS", value: (d) => num(d.ffsCount) },
  { label: "MA", value: (d) => num(d.maCount) },
  { label: "FFS %", value: (d) => pct(d.ffsPercent) },
  { label: "MA %", value: (d) => pct(d.maPercent) },
];

// ── Prescription Drug ────────────────────────────────────────────────

export const drugYearly = [
  { label: "Year", value: (d) => d.year },
  { label: "Total Enrolled", value: (d) => num(d.drugTotal) },
  { label: "PDP", value: (d) => num(d.pdpCount) },
  { label: "MAPD", value: (d) => num(d.mapdCount) },
  { label: "PDP %", value: (d) => pct(d.pdpPercent) },
  { label: "MAPD %", value: (d) => pct(d.mapdPercent) },
];

export const drugMonthly = [
  { label: "Year", value: (d) => d.year },
  { label: "Month", value: (d) => d.month },
  { label: "Total Enrolled", value: (d) => num(d.drugTotal) },
  { label: "PDP", value: (d) => num(d.pdpCount) },
  { label: "MAPD", value: (d) => num(d.mapdCount) },
  { label: "PDP %", value: (d) => pct(d.pdpPercent) },
  { label: "MAPD %", value: (d) => pct(d.mapdPercent) },
];
