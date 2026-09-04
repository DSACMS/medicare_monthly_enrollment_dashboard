const CACHE_PREFIX = 'medicare-enrollment-parquet';

export default class ParquetCache {
  constructor({
    cacheStorage = globalThis.caches,
    storageManager = globalThis.navigator?.storage,
    fetchFn = globalThis.fetch,
  } = {}) {
    this.cacheStorage = cacheStorage;
    this.storageManager = storageManager;
    this.fetchFn = fetchFn;
  }

  async loadManifest(url) {
    const cache = await this.openCache(`${CACHE_PREFIX}-manifest`);
    try {
      const response = await this.fetchFn(url);
      if (!response.ok) throw new Error(`Manifest request failed with ${response.status}.`);
      if (cache && (await this.hasCapacity(0))) await cache.put(url, response.clone());
      return response.json();
    } catch (error) {
      const cached = cache && (await cache.match(url));
      if (cached) return cached.json();
      throw error;
    }
  }

  async loadFile(url, manifest, file = manifest.files.summary) {
    const cacheName = ParquetCache.cacheName(manifest, file);
    const cache = await this.openCache(cacheName);
    const cached = cache && (await cache.match(url));
    if (cached) return cached.arrayBuffer();

    const response = await this.fetchFn(url);
    if (!response.ok) throw new Error(`Parquet request failed with ${response.status}.`);
    const cacheableResponse = response.clone();
    const buffer = await response.arrayBuffer();
    if (cache && (await this.hasCapacity(file.size_bytes))) {
      await cache.put(url, cacheableResponse);
      await this.removeObsoleteCaches(ParquetCache.cacheVersion(manifest));
    }
    return buffer;
  }

  static cacheVersion(manifest) {
    const { schema_version: schemaVersion, generated_at: generatedAt, files } = manifest;
    return `${CACHE_PREFIX}-${schemaVersion}-${generatedAt || files.summary.sha256}`;
  }

  static cacheName(manifest, file = manifest.files.summary) {
    return `${ParquetCache.cacheVersion(manifest)}-${file.sha256}`;
  }

  async openCache(name) {
    try {
      return this.cacheStorage ? await this.cacheStorage.open(name) : null;
    } catch {
      return null;
    }
  }

  async hasCapacity(requiredBytes) {
    try {
      const estimate = await this.storageManager?.estimate();
      return Boolean(estimate && estimate.quota - estimate.usage >= requiredBytes);
    } catch {
      return false;
    }
  }

  async removeObsoleteCaches(activeCacheVersion) {
    try {
      const cacheNames = await this.cacheStorage.keys();
      await Promise.all(
        cacheNames
          .filter(
            (name) =>
              name.startsWith(`${CACHE_PREFIX}-`) &&
              !name.startsWith(activeCacheVersion) &&
              name !== `${CACHE_PREFIX}-manifest`,
          )
          .map((name) => this.cacheStorage.delete(name)),
      );
    } catch {
      // Cache cleanup is best-effort.
    }
  }
}
