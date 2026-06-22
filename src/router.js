import { fetchNationalData } from './datasets/nationalEnrollment.js';
import { fetchCountiesForState } from './datasets/countyEnrollment.js';
import { fetchAllStates, fetchStateEnrollment } from './datasets/stateEnrollment.js';

const functionRegistry = {
  nationalEnrollment: fetchNationalData,
  countyEnrollment: fetchCountiesForState,
  allStates: fetchAllStates,
  stateEnrollment: fetchStateEnrollment,
};

const cache = new Map();

export async function requestDataset(serviceName, options = {}) {
  const targetFunction = functionRegistry[serviceName];

  if (!targetFunction) {
    throw new Error(`Dataset function '${serviceName}' not found. Available options: ${Object.keys(functionRegistry).join(', ')}`);
  }

  const cacheKey = `${serviceName}:${JSON.stringify(options)}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const request = (async () => {
    try {
      return await targetFunction(options);
    } catch (error) {
      cache.delete(cacheKey);
      console.error(`Error executing dataset request for: ${serviceName}`, error);
      throw error;
    }
  })();

  cache.set(cacheKey, request);
  return request;
}
