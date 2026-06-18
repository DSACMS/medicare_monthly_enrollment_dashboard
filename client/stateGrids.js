import { fetchStateData } from './stateData.js';
import { renderTable } from './tables/renderTable.js';
import { hospitalYearly, hospitalMonthly, drugYearly, drugMonthly } from './tables/stateColumns.js';
import {
  renderHospitalYearlyLineChart,
  renderHospitalMonthlyLineChart,
  renderHospitalYearlyStackedBarChart,
  renderHospitalMonthlyStackedBarChart,
  renderDrugYearlyLineChart,
  renderDrugMonthlyLineChart,
  renderDrugYearlyStackedBarChart,
  renderDrugMonthlyStackedBarChart,
} from './charts/index.js';

async function renderStateGrids(state) {
  const { yearly, monthly } = await fetchStateData(state);

  renderHospitalYearlyLineChart('#state-hospital-yearly-line', yearly);
  renderHospitalYearlyStackedBarChart('#state-hospital-yearly-bar', yearly);
  renderHospitalMonthlyLineChart('#state-hospital-monthly-line', monthly);
  renderHospitalMonthlyStackedBarChart('#state-hospital-monthly-bar', monthly);

  renderDrugYearlyLineChart('#state-drug-yearly-line', yearly);
  renderDrugYearlyStackedBarChart('#state-drug-yearly-bar', yearly);
  renderDrugMonthlyLineChart('#state-drug-monthly-line', monthly);
  renderDrugMonthlyStackedBarChart('#state-drug-monthly-bar', monthly);

  renderTable('#state-hospital-yearly',  hospitalYearly,  yearly);
  renderTable('#state-hospital-monthly', hospitalMonthly, monthly);
  renderTable('#state-drug-yearly',      drugYearly,      yearly);
  renderTable('#state-drug-monthly',     drugMonthly,     monthly);
}

renderStateGrids('NY');
