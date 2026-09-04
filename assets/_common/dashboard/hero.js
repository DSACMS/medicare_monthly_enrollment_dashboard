import DASHBOARD_LABELS from '../labels';
import { renderEnrollmentHero } from '../charts/index';

const hospitalLabels = DASHBOARD_LABELS.hospitalMedical;
const drugLabels = DASHBOARD_LABELS.prescriptionDrug;

// IMPORTANT: keep MA/MAPD SECOND in each array below — renderEnrollmentHero
// maps data[1] to slot B, which hero-card.njk renders as the upper bar.
function buildHeroCardConfigs(yearlyWithLatest) {
  const currentYear = yearlyWithLatest[0];

  return {
    hospital: {
      data: [
        {
          name: hospitalLabels.type2.label,
          label: hospitalLabels.type2.labelLong,
          value: currentYear[hospitalLabels.type2.percentKey],
        },
        {
          name: hospitalLabels.type1.label,
          label: hospitalLabels.type1.labelLong,
          value: currentYear[hospitalLabels.type1.percentKey],
        },
      ],
      total: currentYear[hospitalLabels.total.key],
      options: {
        colors: [hospitalLabels.type2.color, hospitalLabels.type1.color],
        title: `${hospitalLabels.heroTitle}, ${currentYear.year}`,
        tableColumns: [
          { label: 'Program', value: (d) => d.name },
          { label: 'Percent of total', value: (d) => `${Math.round(d.value)}%` },
        ],
      },
    },
    drug: {
      data: [
        {
          name: drugLabels.type2.label,
          label: drugLabels.type2.labelLong,
          value: currentYear[drugLabels.type2.percentKey],
        },
        {
          name: drugLabels.type1.label,
          label: drugLabels.type1.labelLong,
          value: currentYear[drugLabels.type1.percentKey],
        },
      ],
      total: currentYear[drugLabels.total.key],
      options: {
        colors: [drugLabels.type2.color, drugLabels.type1.color],
        title: `${drugLabels.heroTitle}, ${currentYear.year}`,
        tableColumns: [
          { label: 'Plan type', value: (d) => d.name },
          { label: 'Percent of total', value: (d) => `${Math.round(d.value)}%` },
        ],
      },
    },
  };
}

// Wires up the swappable hero card at #medicare-enrollment-hero and the
// .dashboard-type-button toggles that drive it. Dispatches dashboard:typechange
// on click so other cards (map/grid/trend) can react without this module
// needing to know they exist.
export default function initHeroCard(yearlyWithLatest) {
  const heroCardConfigs = buildHeroCardConfigs(yearlyWithLatest);

  const renderEnrollmentHeroCard = (type) => {
    const config = heroCardConfigs[type];
    if (!config) return;

    renderEnrollmentHero('#medicare-enrollment-hero', config.data, config.total, config.options);

    document.querySelectorAll('.dashboard-type-button').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.dashboardType === type));
    });
  };

  renderEnrollmentHeroCard('hospital');

  document.addEventListener('dashboard:typechange', (event) => {
    renderEnrollmentHeroCard(event.detail?.type);
  });

  document.querySelectorAll('.dashboard-type-button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const { dashboardType } = btn.dataset;
      document.dispatchEvent(
        new CustomEvent('dashboard:typechange', {
          detail: { type: dashboardType, source: 'human', moveFocus: true, announce: true },
        }),
      );
    });
  });
}
