/** @jest-environment jsdom */

import DataManager from './DataManager';

function makeSource(name, overrides = {}) {
  class FakeSource {
    static get sourceName() {
      return name;
    }
  }
  const instance = new FakeSource();
  instance.initialize = jest.fn(overrides.initialize || (async () => {}));
  instance.fetch = jest.fn(overrides.fetch || (async () => ({ ok: true, name })));
  instance.getMetadata = jest.fn(
    overrides.getMetadata || (() => ({ source: name, datasetVersion: null, freshness: null })),
  );
  return instance;
}

describe('DataManager', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  test('initialize resolves once and picks primary when it succeeds', async () => {
    const primary = makeSource('primary');
    const fallback = makeSource('fallback');
    const mgr = new DataManager({ primary, fallback });

    await mgr.initialize();
    await mgr.initialize();

    expect(primary.initialize).toHaveBeenCalledTimes(1);
    expect(fallback.initialize).not.toHaveBeenCalled();
    expect(mgr.getActiveSource()).toBe(primary);
    expect(mgr.getInfo().source).toBe('primary');
  });

  test('falls back to secondary when primary initialize throws', async () => {
    const primary = makeSource('primary', {
      initialize: async () => {
        throw new Error('duckdb unavailable');
      },
    });
    const fallback = makeSource('fallback');
    const mgr = new DataManager({ primary, fallback });

    await mgr.initialize();

    expect(fallback.initialize).toHaveBeenCalled();
    expect(mgr.getActiveSource()).toBe(fallback);
    expect(mgr.getInfo().source).toBe('fallback');
    expect(mgr.getInfo().initErrors).toEqual([
      { source: 'primary', message: 'duckdb unavailable' },
    ]);
  });

  test('works with no primary (fallback-only setup)', async () => {
    const fallback = makeSource('fallback');
    const mgr = new DataManager({ fallback });

    await mgr.initialize();

    expect(fallback.initialize).toHaveBeenCalled();
    expect(mgr.getActiveSource()).toBe(fallback);
  });

  test('requires a fallback source', () => {
    expect(() => new DataManager({ primary: makeSource('a') })).toThrow(/fallback data source/);
  });

  test('delegates fetch to the active source and returns its data', async () => {
    const fallback = makeSource('fallback', {
      fetch: async (svc, opts) => ({ svc, opts }),
    });
    const mgr = new DataManager({ fallback });

    const result = await mgr.fetch('nationalEnrollment', { type: 'yearly' });
    expect(result).toEqual({ svc: 'nationalEnrollment', opts: { type: 'yearly' } });
  });

  test('falls back when the active primary does not support a service', async () => {
    const primary = makeSource('primary', {
      fetch: async () => {
        throw new Error('unsupported service');
      },
    });
    const fallback = makeSource('fallback', {
      fetch: async (svc, opts) => ({ svc, opts, source: 'fallback' }),
    });
    const mgr = new DataManager({ primary, fallback });

    await expect(mgr.fetch('allStates', { year: '2024' })).resolves.toEqual({
      svc: 'allStates',
      opts: { year: '2024' },
      source: 'fallback',
    });
  });

  test('deduplicates concurrent identical fetches', async () => {
    let resolveFetch;
    const pendingResult = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    const fallback = makeSource('fallback', {
      fetch: () => pendingResult,
    });
    const mgr = new DataManager({ fallback });

    const a = mgr.fetch('allStates', { year: '2024' });
    const b = mgr.fetch('allStates', { year: '2024' });
    // Let the pending fetch actually enter the deferred promise.
    await Promise.resolve();
    resolveFetch({ shared: true });

    const [ra, rb] = await Promise.all([a, b]);
    expect(ra).toEqual({ shared: true });
    expect(rb).toEqual({ shared: true });
    expect(fallback.fetch).toHaveBeenCalledTimes(1);
  });

  test('does not share a pending request across distinct AbortSignals', async () => {
    const pending = [];
    const fallback = makeSource('fallback', {
      fetch: jest.fn(
        () =>
          new Promise((resolve) => {
            pending.push(resolve);
          }),
      ),
    });
    const mgr = new DataManager({ fallback });
    const first = mgr.fetch(
      'stateEnrollment',
      { state: 'NJ' },
      { signal: new AbortController().signal },
    );
    const second = mgr.fetch(
      'stateEnrollment',
      { state: 'NJ' },
      { signal: new AbortController().signal },
    );

    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(fallback.fetch).toHaveBeenCalledTimes(2);
    pending.forEach((resolve) => resolve({ ok: true }));
    await expect(Promise.all([first, second])).resolves.toEqual([{ ok: true }, { ok: true }]);
  });

  test('distinct option payloads do not share a dedup slot', async () => {
    const fallback = makeSource('fallback');
    const mgr = new DataManager({ fallback });

    await Promise.all([
      mgr.fetch('stateEnrollment', { state: 'CA' }),
      mgr.fetch('stateEnrollment', { state: 'NY' }),
    ]);
    expect(fallback.fetch).toHaveBeenCalledTimes(2);
  });

  test('caches successful results in sessionStorage within TTL', async () => {
    const fallback = makeSource('fallback', {
      fetch: async () => ({ hits: 1 }),
    });
    const mgr = new DataManager({ fallback });

    const first = await mgr.fetch('nationalEnrollment', { type: 'yearly' });
    const second = await mgr.fetch('nationalEnrollment', { type: 'yearly' });

    expect(first).toEqual({ hits: 1 });
    expect(second).toEqual({ hits: 1 });
    expect(fallback.fetch).toHaveBeenCalledTimes(1);
  });

  test('expired cache entries are re-fetched', async () => {
    const fallback = makeSource('fallback', {
      fetch: async () => ({ ok: true }),
    });
    const mgr = new DataManager({ fallback, cacheMaxAgeMs: 1 });

    await mgr.fetch('allStates', { year: '2024' });
    await new Promise((r) => {
      setTimeout(r, 5);
    });
    await mgr.fetch('allStates', { year: '2024' });

    expect(fallback.fetch).toHaveBeenCalledTimes(2);
  });

  test('propagates AbortSignal through to the active source', async () => {
    const fallback = makeSource('fallback', {
      fetch: async (_svc, _opts, { signal }) => {
        expect(signal).toBeInstanceOf(AbortSignal);
        return { signalPresent: true };
      },
    });
    const mgr = new DataManager({ fallback });

    const controller = new AbortController();
    const result = await mgr.fetch(
      'countyEnrollment',
      { state: 'SD' },
      { signal: controller.signal },
    );
    expect(result).toEqual({ signalPresent: true });
  });

  test('does not swallow errors from the active source', async () => {
    const fallback = makeSource('fallback', {
      fetch: async () => {
        throw new Error('CMS API 500');
      },
    });
    const mgr = new DataManager({ fallback });

    await expect(mgr.fetch('nationalEnrollment', {})).rejects.toThrow(/CMS API 500/);
    // Failed fetch must clear its dedup slot so the next caller can retry.
    expect(mgr.pending.size).toBe(0);
  });

  test('getInfo returns null-shaped metadata before initialize', () => {
    const fallback = makeSource('fallback');
    const mgr = new DataManager({ fallback });
    expect(mgr.getInfo()).toEqual({
      source: null,
      datasetVersion: null,
      freshness: null,
      initErrors: [],
    });
  });
});
