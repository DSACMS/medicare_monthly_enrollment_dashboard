import DuckDbClient from './DuckDbClient';

describe('DuckDbClient', () => {
  test('uses the selected worker and returns plain query rows', async () => {
    const worker = {};
    const connection = {
      query: jest.fn(async () => ({
        toArray: () => [{ toJSON: () => ({ year: '2024', total: 1 }) }],
      })),
    };
    const database = {
      instantiate: jest.fn(async () => {}),
      connect: jest.fn(async () => connection),
      registerFileBuffer: jest.fn(async () => {}),
    };
    const duckdbModule = {
      VoidLogger: class {},
      AsyncDuckDB: jest.fn(() => database),
    };
    const WorkerClass = jest.fn(() => worker);
    const client = new DuckDbClient({
      bundle: {
        module: '/assets/duckdb/duckdb-browser.mjs',
        mainModule: '/assets/duckdb/duckdb-mvp.wasm',
        mainWorker: '/assets/worker.js',
      },
      duckdbModule,
      WorkerClass,
    });

    await client.initialize();
    await expect(client.query('SELECT 1')).resolves.toEqual([{ year: '2024', total: 1 }]);

    expect(WorkerClass).toHaveBeenCalledWith('/assets/worker.js');
    expect(database.instantiate).toHaveBeenCalledWith('/assets/duckdb/duckdb-mvp.wasm');
    expect(connection.query).toHaveBeenCalledWith('SELECT 1');
    await client.registerFileBuffer('summary.parquet', new Uint8Array([1, 2]));
    expect(database.registerFileBuffer).toHaveBeenCalledWith(
      'summary.parquet',
      new Uint8Array([1, 2]),
    );
  });
});
