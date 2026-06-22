import { fetchStateData } from './countiesData.js';
import { renderTable } from '../tables/renderTable.js';
import { hospitalYearly, hospitalMonthly } from '../tables/hospitalMedical/tableColumns.js';
import { drugYearly, drugMonthly } from '../tables/prescriptionDrug/tableColumns.js';
import {
  renderHospitalYearlyLineChart,
  renderHospitalMonthlyLineChart,
  renderHospitalYearlyStackedBarChart,
  renderHospitalMonthlyStackedBarChart,
  renderDrugYearlyLineChart,
  renderDrugMonthlyLineChart,
  renderDrugYearlyStackedBarChart,
  renderDrugMonthlyStackedBarChart,
} from '../charts/index.js';

async function renderCountiesView(state) {
  try {
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
  } catch (error) {
    console.error(`Failed to load counties view for ${state}:`, error.message);
  }
}

renderCountiesView('NY');
