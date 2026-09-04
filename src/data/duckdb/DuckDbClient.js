export default class DuckDbClient {
  constructor({ bundle, duckdbModule = null, WorkerClass = globalThis.Worker } = {}) {
    this.bundle = bundle;
    this.duckdb = duckdbModule;
    this.WorkerClass = WorkerClass;
    this.database = null;
    this.connection = null;
    this.worker = null;
  }

  async initialize() {
    if (this.connection) return;
    if (
      !this.bundle?.module ||
      !this.bundle?.mainModule ||
      !this.bundle?.mainWorker ||
      !this.WorkerClass
    ) {
      throw new Error('DuckDB-Wasm requires a bundle and browser Worker support.');
    }

    this.duckdb ||= await import(this.bundle.module);
    this.worker = new this.WorkerClass(this.bundle.mainWorker);
    this.database = new this.duckdb.AsyncDuckDB(new this.duckdb.VoidLogger(), this.worker);
    await this.database.instantiate(this.bundle.mainModule);
    this.connection = await this.database.connect();
  }

  async query(sql) {
    if (!this.connection) throw new Error('DuckDB-Wasm has not been initialized.');
    const result = await this.connection.query(sql);
    return result
      .toArray()
      .map((row) => (typeof row.toJSON === 'function' ? row.toJSON() : { ...row }));
  }

  async registerFileBuffer(name, buffer) {
    if (!this.database) throw new Error('DuckDB-Wasm has not been initialized.');
    await this.database.registerFileBuffer(name, new Uint8Array(buffer));
  }
}
