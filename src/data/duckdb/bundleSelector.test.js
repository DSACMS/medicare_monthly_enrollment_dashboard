import { selectDuckDbBundle, supportsWasmExceptions } from './bundleSelector';

describe('DuckDB bundle selection', () => {
  test('selects the exceptions-enabled self-hosted bundle when supported', () => {
    function Exception() {}
    function Tag() {}

    expect(
      selectDuckDbBundle({
        assetBaseUrl: '/dashboard/assets/duckdb/',
        webAssembly: { Exception, Tag },
      }),
    ).toEqual({
      module: '/dashboard/assets/duckdb/duckdb-browser.mjs',
      mainModule: '/dashboard/assets/duckdb/duckdb-eh.wasm',
      mainWorker: '/dashboard/assets/duckdb/duckdb-browser-eh.worker.js',
    });
  });

  test('falls back to the MVP bundle without wasm exceptions', () => {
    expect(supportsWasmExceptions({})).toBe(false);
    expect(selectDuckDbBundle({ assetBaseUrl: 'assets/duckdb', webAssembly: {} })).toEqual({
      module: 'assets/duckdb/duckdb-browser.mjs',
      mainModule: 'assets/duckdb/duckdb-mvp.wasm',
      mainWorker: 'assets/duckdb/duckdb-browser-mvp.worker.js',
    });
  });
});
