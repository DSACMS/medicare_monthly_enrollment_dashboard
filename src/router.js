import { fetchNationalData } from './datasets/nationalEnrollment.js';
import { fetchCountiesForState } from './datasets/countyEnrollment.js';
import { fetchAllStates, fetchStateEnrollment } from './datasets/stateEnrollment.js';

const functionRegistry = {
  nationalEnrollment: fetchNationalData,
  countyEnrollment: fetchCountiesForState,
  allStates: fetchAllStates,
  stateEnrollment: fetchStateEnrollment,
};

export async function requestDataset(serviceName, options = {}) {
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
