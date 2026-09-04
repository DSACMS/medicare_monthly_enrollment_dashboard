export default function createDashboardState() {
  return {
    activeDashboardType: 'hospital',
    selectedState: null,
    selectedCounty: null,
    // Built once by loadStateMap; read by both the map and the county grid's
    // fetch (needs .options.year/.month).
    mapConfigs: null,

    grid: {
      allStatesRows: [],
      currentCountyRows: [],
      activeView: 'state',
      setActiveView: null,
      allAreasSort: { index: 0, direction: 'asc' },
      countyGridSort: { index: 0, direction: 'asc' },
    },

    trend: {
      nationalTrendData: null, // set once after the initial national fetch
      stateTrendCache: new Map(),
      countyTrendCache: new Map(),
      activeTrendType: 'hospital',
      activeTrendRange: 'yearly',
      setRange: null,
      activeTrendView: 'line', // mobile carousel: 'line' | 'bar' | 'grid'
      trendScope: 'national',
      trendArea: null,
      overlayTrendView: 'line',
      trendOverlayOpen: false,
      trendDrawerOpen: false,
      trendGridSort: { index: 0, direction: 'desc' },
    },

    resetMapToNational: null,
    clearSelectedState: null,
    popups: {
      closeDrawer: null,
      closeCountyDrawer: null,
      closeOverlay: null,
      closeTrendOverlay: null,
      closeTrendDrawer: null,
    },
  };
}
