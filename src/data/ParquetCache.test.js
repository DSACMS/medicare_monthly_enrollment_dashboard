/** @jest-environment jsdom */

import ParquetCache from './ParquetCache';

function response(body, ok = true) {
  const bytes = body instanceof Uint8Array ? body : null;
  return {
    ok,
    status: ok ? 200 : 500,
    clone: () => response(body, ok),
    json: async () => body,
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

function makeCacheStorage() {
  const caches = new Map();
  return {
    open: jest.fn(async (name) => {
      if (!caches.has(name)) {
        const entries = new Map();
        caches.set(name, {
          match: jest.fn(async (key) => entries.get(key)),
          put: jest.fn(async (key, value) => entries.set(key, value)),
        });
      }
      return caches.get(name);
    }),
    keys: jest.fn(async () => [...caches.keys()]),
    delete: jest.fn(async (name) => caches.delete(name)),
  };
}

const manifest = {
  schema_version: '1',
  files: { summary: { sha256: 'abc123', size_bytes: 3 } },
};

describe('ParquetCache', () => {
  test('caches successful manifest and summary responses', async () => {
    const cacheStorage = makeCacheStorage();
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(response(manifest))
      .mockResolvedValueOnce(response(new Uint8Array([1, 2, 3])));
    const cache = new ParquetCache({
      cacheStorage,
      fetchFn,
      storageManager: { estimate: async () => ({ quota: 10, usage: 0 }) },
    });

    await expect(cache.loadManifest('data/v1/manifest.json')).resolves.toEqual(manifest);
    await expect(cache.loadFile('data/v1/summary.parquet', manifest)).resolves.toEqual(
      new Uint8Array([1, 2, 3]).buffer,
    );
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  test('uses cached manifest and summary when offline', async () => {
    const cacheStorage = makeCacheStorage();
    const online = new ParquetCache({
      cacheStorage,
      fetchFn: jest
        .fn()
        .mockResolvedValueOnce(response(manifest))
        .mockResolvedValueOnce(response(new Uint8Array([1, 2, 3]))),
      storageManager: { estimate: async () => ({ quota: 10, usage: 0 }) },
    });
    await online.loadManifest('data/v1/manifest.json');
    await online.loadFile('data/v1/summary.parquet', manifest);
    const offline = new ParquetCache({
      cacheStorage,
      fetchFn: jest.fn(async () => {
        throw new Error('offline');
      }),
      storageManager: { estimate: async () => ({ quota: 10, usage: 0 }) },
    });

    await expect(offline.loadManifest('data/v1/manifest.json')).resolves.toEqual(manifest);
    await expect(offline.loadFile('data/v1/summary.parquet', manifest)).resolves.toEqual(
      new Uint8Array([1, 2, 3]).buffer,
    );
  });

  test('does not cache when quota is insufficient', async () => {
    const cacheStorage = makeCacheStorage();
    const cache = new ParquetCache({
      cacheStorage,
      fetchFn: jest.fn(async () => response(new Uint8Array([1, 2, 3]))),
      storageManager: { estimate: async () => ({ quota: 2, usage: 0 }) },
    });

    await cache.loadFile('data/v1/summary.parquet', manifest);
    const versionedCache = await cacheStorage.open(ParquetCache.cacheName(manifest));
    await expect(versionedCache.match('data/v1/summary.parquet')).resolves.toBeUndefined();
  });

  test('removes older versioned data after caching the active version', async () => {
    const cacheStorage = makeCacheStorage();
    const oldManifest = { ...manifest, files: { summary: { sha256: 'old', size_bytes: 3 } } };
    await cacheStorage.open(ParquetCache.cacheName(oldManifest));
    const cache = new ParquetCache({
      cacheStorage,
      fetchFn: jest.fn(async () => response(new Uint8Array([1, 2, 3]))),
      storageManager: { estimate: async () => ({ quota: 10, usage: 0 }) },
    });

    await cache.loadFile('data/v1/summary.parquet', manifest);
    expect(cacheStorage.delete).toHaveBeenCalledWith(ParquetCache.cacheName(oldManifest));
  });

  test('keeps current-version county partitions when another partition is cached', async () => {
    const cacheStorage = makeCacheStorage();
    const county = { path: 'v1/counties/ND.parquet', sha256: 'nd123', size_bytes: 3 };
    const cache = new ParquetCache({
      cacheStorage,
      fetchFn: jest.fn(async () => response(new Uint8Array([1, 2, 3]))),
      storageManager: { estimate: async () => ({ quota: 10, usage: 0 }) },
    });

    await cache.loadFile('data/v1/summary.parquet', manifest);
    await cache.loadFile('data/v1/counties/ND.parquet', manifest, county);

    const summaryCache = await cacheStorage.open(ParquetCache.cacheName(manifest));
    await expect(summaryCache.match('data/v1/summary.parquet')).resolves.toBeDefined();
  });
});
