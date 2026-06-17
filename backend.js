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
    stateBreakdown: fetchStateData,
    demographicsSummary: fetchDemographicsData,
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
  // Logic specifically for national API queries
  const datasetId = 'd7fabe1e-d19b-4333-9eff-e80e0643f2fd';
  const size = options.limit || 10;
  
  const response = await fetch(`https://data.cms.gov/data-api/v1/dataset/${datasetId}/data?filter[BENE_GEO_LVL]=National&size=${size}`);
  const data = await response.json();
  
  return data.map(row => ({
    year: row.YEAR,
    total: parseInt(row.TOT_BENES, 10)
  }));
}

async function fetchStateData(options) {
  // Logic specifically for state-level API queries
  const stateCode = options.state || 'MI';
  // You would put your fetch call targeting states here...
  return { message: `This would return data filtered specifically for state: ${stateCode}` };
}

async function fetchDemographicsData(options) {
  // Logic parsing specific age/race metrics out of the dataset
  return { message: "This would return parsed numeric keys like MALE_TOT_BENES and FEMALE_TOT_BENES" };
}