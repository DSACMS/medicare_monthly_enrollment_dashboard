const datasetId = 'd7fabe1e-d19b-4333-9eff-e80e0643f2fd';
const baseUrl = `https://data.cms.gov/data-api/v1/dataset/${datasetId}/data`;

/**
 * Dynamic Data Fetcher Router
 * @param {string} serviceName - The name of the dataset/function you want to request
 * @param {Object} [options] - Optional arguments (like query limits, dates, filters)
 */
async function requestDataset(serviceName, options = {}) {
  
  // 1. Map string names to the actual functions that return specific data
  const functionRegistry = {
    // CHANGE THESE NAMES TO WHATEVER FUNCTIONS YOU MAKE 
    nationalEnrollment: fetchNationalData,
  };

  // 2. Look up the requested function in our registry
  const targetFunction = functionRegistry[serviceName];

  // 3. Safety check: If the function name doesn't exist, throw a clear error
  if (!targetFunction) {
    throw new Error(`Dataset function '${serviceName}' not found. Available options: ${Object.keys(functionRegistry).join(', ')}`);
  }

  // 4. Execute the targeted function and return its unique data
  try {
    return await targetFunction(options);
  } catch (error) {
    console.error(`Error executing dataset request for: ${serviceName}`, error);
    throw error;
  }
}

// =========================================================================
//  INDIVIDUAL NAMED FUNCTIONS (Each returns completely different data) EDIT BELOW YOU CAN MAKE YOUR OWN FUNCTIONS
// =========================================================================

async function fetchNationalData(options) {
  const type = options.type || 'monthly'; 
  
  // 1. Tell the API to filter by National AND sort by Year/Month descending
  const queryParams = new URLSearchParams({
    'filter[BENE_GEO_LVL]': 'National',
    'sort[YEAR]': 'DESC',
    'sort[MONTH]': 'DESC',
    'size': '100' // This will now catch the 100 most recent rows!
  });

  const response = await fetch(`${baseUrl}?${queryParams.toString()}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`CMS API responded with status: ${response.status}`);
  }

  const rawData = await response.json();

  // Helper function to safely parse numbers
  const num = (val) => parseInt(val, 10) || 0;

  // 2. Map raw rows into clean objects
  const parsedRows = rawData.map(row => {
    const total = num(row.TOT_BENES);
    const ffs = num(row.ORGNL_MDCR_BENES);
    const ma = num(row.MA_AND_OTH_BENES);

    return {
      year: row.YEAR,
      month: row.MONTH,
      totalEnrollees: total,
      ffsCount: ffs,
      maCount: ma,
      ffsPercent: total > 0 ? parseFloat(((ffs / total) * 100).toFixed(2)) : 0,
      maPercent: total > 0 ? parseFloat(((ma / total) * 100).toFixed(2)) : 0
    };
  });

  // =========================================================================
  //  BRANCHING LOGIC: YEARLY VS MONTHLY
  // =========================================================================

  if (type === 'yearly') {
    const yearlyMap = {};

    parsedRows.forEach(row => {
      // Skip rows where month is literally text "Year" if we want to calculate purely from monthly snapshots,
      // or keep them if you want to use CMS's built-in annual rows.
      if (!yearlyMap[row.year]) {
        yearlyMap[row.year] = { totalEnrollees: 0, ffsCount: 0, maCount: 0, count: 0 };
      }
      yearlyMap[row.year].totalEnrollees += row.totalEnrollees;
      yearlyMap[row.year].ffsCount += row.ffsCount;
      yearlyMap[row.year].maCount += row.maCount;
      yearlyMap[row.year].count += 1;
    });

    return Object.keys(yearlyMap).map(year => {
      const agg = yearlyMap[year];
      const avgTotal = Math.round(agg.totalEnrollees / agg.count);
      const avgFfs = Math.round(agg.ffsCount / agg.count);
      const avgMa = Math.round(agg.maCount / agg.count);

      return {
        year: year,
        totalEnrollees: avgTotal,
        ffsCount: avgFfs,
        maCount: avgMa,
        ffsPercent: avgTotal > 0 ? parseFloat(((avgFfs / avgTotal) * 100).toFixed(2)) : 0,
        maPercent: avgTotal > 0 ? parseFloat(((avgMa / avgTotal) * 100).toFixed(2)) : 0
      };
    }).sort((a, b) => b.year - a.year); 
  }

  if (type === 'monthly') {
    // Helper map to convert month names to chronological numbers
    const monthOrder = {
      'January': 1, 'February': 2, 'March': 3, 'April': 4, 'May': 5, 'June': 6,
      'July': 7, 'August': 8, 'September': 9, 'October': 10, 'November': 11, 'December': 12
    };

    return parsedRows
      .filter(row => row.month !== 'Year') // Filter out annual summary rows
      .sort((a, b) => {
        // First, sort by Year descending (2026 down to 2025)
        if (b.year !== a.year) {
          return parseInt(b.year, 10) - parseInt(a.year, 10);
        }
        // If the years are identical, sort by calendar month descending (Feb -> Jan)
        return monthOrder[b.month] - monthOrder[a.month];
      })
      .slice(0, 12); // Grab the crisp, sorted trailing 12 months
  }
}

// function for county that requests a state and then returns all of the total enrollment for each county 

const dashboardYearlyComparison = await requestDataset('nationalEnrollment', { type: 'yearly' });
//console.log("Yearly view:", dashboardYearlyComparison);

const dashboardMonthlyComparison = await requestDataset('nationalEnrollment', { type: 'monthly' });
//console.log("Monthly view:", dashboardMonthlyComparison);