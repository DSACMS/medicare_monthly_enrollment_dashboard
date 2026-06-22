import { requestDataset } from '../../../../src/router.js';

export async function fetchStateData(state) {
  const [yearly, monthly] = await Promise.all([
    requestDataset('stateEnrollment', { state, type: 'yearly' }),
    requestDataset('stateEnrollment', { state, type: 'monthly' }),
  ]);
  return { yearly, monthly };
}
