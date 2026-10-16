/**
 * Data source that talks to the live CMS Provider Data Catalog API via the
 * existing dataset modules under src/datasets/. This is the always-available
 * baseline every DataManager instance must be able to fall back to.
 *
 * No behavioural change vs. the pre-Phase-3 router: this is a thin wrapper
 * so the DataManager can hold multiple sources behind one interface.
 */

import fetchNationalData from '../../datasets/nationalEnrollment';
import fetchCountiesForState, { fetchCountyEnrollment } from '../../datasets/countyEnrollment';
import { fetchAllStates, fetchStateEnrollment } from '../../datasets/stateEnrollment';

const REGISTRY = {
  nationalEnrollment: fetchNationalData,
  countyEnrollment: fetchCountiesForState,
  countyTrend: fetchCountyEnrollment,
  allStates: fetchAllStates,
  stateEnrollment: fetchStateEnrollment,
};

export default class CmsApiDataSource {
  static get sourceName() {
    return 'cms-api';
  }

  // eslint-disable-next-line class-methods-use-this
  async initialize() {
    // The CMS API is always available in principle; individual requests can
    // still fail. No warmup work is required.
  }

  async fetch(serviceName, options, { signal } = {}) {
    const fn = REGISTRY[serviceName];
    if (!fn) {
      throw new Error(
        `CmsApiDataSource: unknown service '${serviceName}'. ` +
          `Available: ${Object.keys(REGISTRY).join(', ')}`,
      );
    }
    // Instance-level dispatch stays trivial for now; a subclass or a
    // subsequent phase may override.
    this.lastServiceName = serviceName;
    return fn(options, { signal });
  }

  // eslint-disable-next-line class-methods-use-this
  getMetadata() {
    return {
      source: CmsApiDataSource.sourceName,
      datasetVersion: null,
      freshness: null,
    };
  }
}

export { REGISTRY as SERVICE_REGISTRY };
