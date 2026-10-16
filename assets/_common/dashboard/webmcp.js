function toolResult(snapshot) {
  return {
    content: [{ type: 'text', text: JSON.stringify(snapshot) }],
  };
}

function toolError(error) {
  return {
    content: [{ type: 'text', text: `Unable to update the dashboard: ${error.message}` }],
    isError: true,
  };
}

function controllerTool(name, description, inputSchema, action) {
  return {
    name,
    description,
    inputSchema,
    execute: async (arguments_) => {
      try {
        return toolResult(action(arguments_));
      } catch (error) {
        return toolError(error);
      }
    },
  };
}

export default async function registerDashboardTools({
  controller,
  modelContext = document.modelContext,
} = {}) {
  if (!controller || typeof modelContext?.registerTool !== 'function') return null;

  const options = { source: 'webmcp' };
  const tools = [
    controllerTool(
      'get-dashboard-state',
      'Get the current dashboard type, selected geography, trend range, and visible table.',
      { type: 'object', properties: {} },
      () => controller.getSnapshot(),
    ),
    controllerTool(
      'set-dashboard-type',
      'Show either Hospital and Medical enrollment or Prescription Drug enrollment.',
      {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['hospital', 'drug'],
            description: 'Dashboard type to show.',
          },
        },
        required: ['type'],
      },
      ({ type }) => controller.setDashboardType(type, options),
    ),
    controllerTool(
      'select-state',
      'Select a U.S. state or territory by its two-letter postal abbreviation.',
      {
        type: 'object',
        properties: {
          stateCode: {
            type: 'string',
            description: 'Two-letter state or territory abbreviation, such as ND or PR.',
          },
        },
        required: ['stateCode'],
      },
      ({ stateCode }) => controller.selectState(stateCode, options),
    ),
    controllerTool(
      'select-county',
      'Select a county or county-equivalent by state abbreviation and five-digit FIPS code.',
      {
        type: 'object',
        properties: {
          stateCode: { type: 'string', description: 'Two-letter state or territory abbreviation.' },
          countyFips: {
            type: 'string',
            description: 'Five-digit county or county-equivalent FIPS code.',
          },
        },
        required: ['stateCode', 'countyFips'],
      },
      ({ stateCode, countyFips }) => controller.selectCounty(stateCode, countyFips, options),
    ),
    controllerTool(
      'clear-geography',
      'Return the dashboard to the national geography.',
      { type: 'object', properties: {} },
      () => controller.clearGeography(options),
    ),
    controllerTool(
      'set-trend-range',
      'Show annual or monthly enrollment trends for the selected geography.',
      {
        type: 'object',
        properties: {
          range: {
            type: 'string',
            enum: ['yearly', 'monthly'],
            description: 'Trend reporting period to show.',
          },
        },
        required: ['range'],
      },
      ({ range }) => controller.setTrendRange(range, options),
    ),
    controllerTool(
      'show-enrollment-table',
      'Show the state or county enrollment table for the current geography.',
      {
        type: 'object',
        properties: {
          view: {
            type: 'string',
            enum: ['state', 'county'],
            description: 'Enrollment table to show.',
          },
        },
        required: ['view'],
      },
      ({ view }) => controller.showTable(view, options),
    ),
  ];

  const abortController = new AbortController();
  await Promise.all(
    tools.map((tool) => modelContext.registerTool(tool, { signal: abortController.signal })),
  );
  return abortController;
}
