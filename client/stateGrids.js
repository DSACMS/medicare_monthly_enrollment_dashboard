import { fetchStateData } from './stateData.js';
import { renderTable } from './tables/renderTable.js';
import { hospitalYearly, hospitalMonthly, drugYearly, drugMonthly } from './tables/stateColumns.js';

async function renderStateGrids(state) {
  const { yearly, monthly } = await fetchStateData(state);

  renderTable('#state-hospital-yearly',  hospitalYearly,  yearly);
  renderTable('#state-hospital-monthly', hospitalMonthly, monthly);
  renderTable('#state-drug-yearly',      drugYearly,      yearly);
  renderTable('#state-drug-monthly',     drugMonthly,     monthly);
}

renderStateGrids('NY');
