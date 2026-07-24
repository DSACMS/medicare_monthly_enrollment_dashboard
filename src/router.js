import fetchNationalData from './datasets/nationalEnrollment';
import fetchCountiesForState, { fetchCountyEnrollment } from './datasets/countyEnrollment';
import { fetchAllStates, fetchStateEnrollment } from './datasets/stateEnrollment';

const functionRegistry = {
  nationalEnrollment: fetchNationalData,
  countyEnrollment: fetchCountiesForState,
  countyTrend: fetchCountyEnrollment,
  allStates: fetchAllStates,
  stateEnrollment: fetchStateEnrollment,
};

async function requestDataset(serviceName, options = {}) {
  const targetFunction = functionRegistry[serviceName];

  if (!targetFunction) {
    throw new Error(`Dataset function '${serviceName}' not found. Available options: ${Object.keys(functionRegistry).join(', ')}`);
  }

  const cacheKey = `${serviceName}:${JSON.stringify(options)}`;

  const cached = sessionStorage.getItem(cacheKey);
  if (cached) return JSON.parse(cached);

  const data = await targetFunction(options);

  try {
    sessionStorage.setItem(cacheKey, JSON.stringify(data));
  } catch {
    return data;
  }

  return data;
}

export default requestDataset;