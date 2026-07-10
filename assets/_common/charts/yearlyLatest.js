// This function simply merges the first row of the monthly dataset onto the yearly dataset
// Reasoning for this is that yearly dataset lags behind a year and some months until data is finalized
// Only by using monthly data we are able to get current year data. 


function mergeLatestMonthlyIntoYearly(yearly, monthly) {
  const latestMonthly = monthly[0];
  const latestYearly = yearly[0];

  if (!latestMonthly) {
  return yearly;
}

if (!latestYearly) {
  return monthly;
}

  if (Number(latestMonthly.year) > Number(latestYearly.year)) {
    return [latestMonthly, ...yearly];
  }

  return yearly;
}

export default mergeLatestMonthlyIntoYearly;