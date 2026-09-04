const DEFAULT_ASSET_BASE_URL = 'assets/duckdb';

export function supportsWasmExceptions(webAssembly = globalThis.WebAssembly) {
  return typeof webAssembly?.Exception === 'function' && typeof webAssembly?.Tag === 'function';
}

export function selectDuckDbBundle({
  assetBaseUrl = DEFAULT_ASSET_BASE_URL,
  webAssembly = globalThis.WebAssembly,
} = {}) {
  const baseUrl = assetBaseUrl.replace(/\/$/, '');
  const variant = supportsWasmExceptions(webAssembly) ? 'eh' : 'mvp';

  return {
    module: `${baseUrl}/duckdb-browser.mjs`,
    mainModule: `${baseUrl}/duckdb-${variant}.wasm`,
    mainWorker: `${baseUrl}/duckdb-browser-${variant}.worker.js`,
  };
}
