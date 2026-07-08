import fetchStateData from './countiesData';
import renderTable from '../../tables/renderTable';
import { hospitalYearly, hospitalMonthly } from '../../tables/hospitalMedical/tableColumns';
import { drugYearly, drugMonthly } from '../../tables/prescriptionDrug/tableColumns';
import {
  renderHospitalYearlyLineChart,
  renderHospitalMonthlyLineChart,
  renderHospitalYearlyStackedBarChart,
  renderHospitalMonthlyStackedBarChart,
  renderDrugYearlyLineChart,
  renderDrugMonthlyLineChart,
  renderDrugYearlyStackedBarChart,
  renderDrugMonthlyStackedBarChart,
  mergeLatestMonthlyIntoYearly
} from '../../charts/index';

async function renderCountiesView(state) {
  try {
    const { yearly, monthly } = await fetchStateData(state);

    const yearlyWithLatest = mergeLatestMonthlyIntoYearly(yearly, monthly);
    console.log('STATE YEARLY:', yearly.slice(0, 3));
    console.log('STATE MONTHLY:', monthly.slice(0, 3));
    console.log('STATE YEARLY WITH LATEST:', yearlyWithLatest.slice(0, 3));

    renderHospitalYearlyLineChart('#state-hospital-yearly-line', yearlyWithLatest);
    renderHospitalYearlyStackedBarChart('#state-hospital-yearly-bar', yearlyWithLatest);
    renderHospitalMonthlyLineChart('#state-hospital-monthly-line', monthly);
    renderHospitalMonthlyStackedBarChart('#state-hospital-monthly-bar', monthly);

    renderDrugYearlyLineChart('#state-drug-yearly-line', yearlyWithLatest);
    renderDrugYearlyStackedBarChart('#state-drug-yearly-bar', yearlyWithLatest);
    renderDrugMonthlyLineChart('#state-drug-monthly-line', monthly);
    renderDrugMonthlyStackedBarChart('#state-drug-monthly-bar', monthly);

    renderTable('#state-hospital-yearly',  hospitalYearly,  yearlyWithLatest);
    renderTable('#state-hospital-monthly', hospitalMonthly, monthly);
    renderTable('#state-drug-yearly',      drugYearly,      yearlyWithLatest);
    renderTable('#state-drug-monthly',     drugMonthly,     monthly);
  } catch (error) {
    console.error(`Failed to load counties view for ${state}:`, error.message);
  }
}

renderCountiesView('NY');
