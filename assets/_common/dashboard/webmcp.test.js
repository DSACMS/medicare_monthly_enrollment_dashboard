/** @jest-environment jsdom */

import registerDashboardTools from './webmcp';

const contentText = (result) => result.content[0].text;

describe('WebMCP dashboard tools', () => {
  test('registers typed controller tools when WebMCP is available', async () => {
    const controller = {
      getSnapshot: jest.fn(() => ({ dashboardType: 'hospital' })),
      setDashboardType: jest.fn(() => ({ dashboardType: 'drug' })),
      selectState: jest.fn(() => ({ state: 'ND' })),
      selectCounty: jest.fn(() => ({ county: 'Griggs County' })),
      clearGeography: jest.fn(() => ({ state: null })),
      setTrendRange: jest.fn(() => ({ trendRange: 'monthly' })),
      showTable: jest.fn(() => ({ tableView: 'county' })),
    };
    const modelContext = { registerTool: jest.fn(async () => {}) };

    const registration = await registerDashboardTools({ controller, modelContext });

    expect(modelContext.registerTool).toHaveBeenCalledTimes(7);
    const registered = modelContext.registerTool.mock.calls.map(([tool]) => tool);
    expect(registered.map((tool) => tool.name)).toEqual([
      'get-dashboard-state',
      'set-dashboard-type',
      'select-state',
      'select-county',
      'clear-geography',
      'set-trend-range',
      'show-enrollment-table',
    ]);
    expect(
      registered.find((tool) => tool.name === 'select-state').inputSchema.properties.stateCode,
    ).toEqual(expect.objectContaining({ type: 'string' }));

    await expect(
      registered.find((tool) => tool.name === 'select-state').execute({ stateCode: 'ND' }),
    ).resolves.toEqual({
      content: [{ type: 'text', text: JSON.stringify({ state: 'ND' }) }],
    });
    expect(controller.selectState).toHaveBeenCalledWith('ND', { source: 'webmcp' });
    expect(registration).toBeInstanceOf(AbortController);
  });

  test('does nothing when the browser does not implement WebMCP', async () => {
    await expect(
      registerDashboardTools({ controller: {}, modelContext: null }),
    ).resolves.toBeNull();
  });

  test('returns an actionable tool error for invalid controller input', async () => {
    const modelContext = { registerTool: jest.fn(async () => {}) };
    await registerDashboardTools({
      modelContext,
      controller: {
        getSnapshot: jest.fn(() => ({})),
        setDashboardType: () => {
          throw new Error('Unknown dashboard type');
        },
      },
    });
    const tool = modelContext.registerTool.mock.calls
      .map(([entry]) => entry)
      .find((entry) => entry.name === 'set-dashboard-type');

    const result = await tool.execute({ type: 'invalid' });
    expect(result.isError).toBe(true);
    expect(contentText(result)).toContain('Unknown dashboard type');
  });
});
