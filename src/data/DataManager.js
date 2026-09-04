/**
 * DataManager — orchestrates the data-source abstraction (ADR-0001).
 *
 * Responsibilities (Phase 3):
 *   - choose the primary source when its initialize() resolves;
 *   - fall back to the secondary source on primary init failure;
 *   - preserve per-caller AbortSignal cancellation semantics;
 *   - deduplicate concurrent identical requests within a session;
 *   - opportunistically cache successful results in sessionStorage;
 *   - never interpret suppressed values as zero (upstream sources do
 *     that already; we just avoid re-encoding null-vs-zero on cache);
 *   - expose the active source, dataset version and freshness metadata
 *     without leaking DuckDB-specifics to consumers.
 *
 * The public contract is intentionally identical to the pre-Phase-3
 * requestDataset(serviceName, options, { signal }) function so map, grid,
 * hero and trend code paths do not need to change.
 */

const CACHE_MAX_AGE_MS = 60 * 60 * 1000;

function safeStorageGet(key) {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, value);
  } catch {
    // sessionStorage full/unavailable — caching is best-effort.
  }
}

export default class DataManager {
  constructor({ primary, fallback, cacheMaxAgeMs = CACHE_MAX_AGE_MS } = {}) {
    if (!fallback) {
      throw new Error('DataManager requires a fallback data source');
    }
    this.primary = primary || null;
    this.fallback = fallback;
    this.cacheMaxAgeMs = cacheMaxAgeMs;
    this.active = null;
    this.pending = new Map();
    this.initPromise = null;
    this.initErrors = [];
  }

  async initialize() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      if (this.primary) {
        try {
          await this.primary.initialize();
          this.active = this.primary;
          return;
        } catch (error) {
          this.initErrors.push({ source: this.primary.constructor.sourceName, error });
        }
      }
      await this.fallback.initialize();
      this.active = this.fallback;
    })();
    return this.initPromise;
  }

  getActiveSource() {
    return this.active;
  }

  getInfo() {
    const meta = this.active
      ? this.active.getMetadata()
      : { source: null, datasetVersion: null, freshness: null };
    return {
      ...meta,
      initErrors: this.initErrors.map(({ source, error }) => ({
        source,
        message: error?.message || String(error),
      })),
    };
  }

  async fetch(serviceName, options = {}, { signal } = {}) {
    await this.initialize();

    const cacheKey = `${serviceName}:${JSON.stringify(options)}`;
    // Each AbortSignal owns its request lifecycle. Sharing a pending request
    // would make a later selection inherit an earlier selection's abort.
    const pendingKey = signal ? null : cacheKey;

    const cached = safeStorageGet(cacheKey);
    if (cached) {
      try {
        const { data, cachedAt } = JSON.parse(cached);
        if (Date.now() - cachedAt < this.cacheMaxAgeMs) return data;
      } catch {
        // Malformed cache entry — ignore.
      }
    }

    if (pendingKey && this.pending.has(pendingKey)) {
      return this.pending.get(pendingKey);
    }

    const promise = (async () => {
      let data;
      try {
        data = await this.active.fetch(serviceName, options, { signal });
      } catch (error) {
        if (this.active === this.primary) {
          data = await this.fallback.fetch(serviceName, options, { signal });
        } else {
          throw error;
        }
      }
      safeStorageSet(cacheKey, JSON.stringify({ data, cachedAt: Date.now() }));
      return data;
    })();

    if (pendingKey) this.pending.set(pendingKey, promise);
    try {
      return await promise;
    } finally {
      if (pendingKey) this.pending.delete(pendingKey);
    }
  }
}
