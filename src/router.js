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

  try {
    return await targetFunction(options);
  } catch (error) {
    console.error(`Error executing dataset request for: ${serviceName}`, error);
    throw error;
  }
}
