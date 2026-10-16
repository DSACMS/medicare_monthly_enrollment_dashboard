/**
 * Public data-fetching entry point used by every dashboard module.
 *
 * Since PR #3 (ADR-0001) this is a thin adapter over DataManager, which
 * owns source selection, initialization, dedup and caching. The exported
 * requestDataset(serviceName, options, { signal }) signature is preserved
 * so map, grid, hero and trend code paths do not need to change.
 */

import DataManager from './data/DataManager';
import CmsApiDataSource from './data/sources/CmsApiDataSource';
import ParquetDataSource from './data/sources/ParquetDataSource';

const dataManager = new DataManager({
  primary: new ParquetDataSource(),
  fallback: new CmsApiDataSource(),
});

async function requestDataset(serviceName, options = {}, { signal } = {}) {
  return dataManager.fetch(serviceName, options, { signal });
}

export default requestDataset;
export { dataManager };
