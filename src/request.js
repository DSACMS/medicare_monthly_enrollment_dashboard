// request.js
import { requestDataset } from "./router.js"; // Adjust the relative path if your router file is in a different folder

async function runDashboardRequests() {
  try {
    // 1. National Yearly Request
    const nationalYearly = await requestDataset("nationalEnrollment", {
      type: "yearly",
    });
    //console.log("National Yearly Data:", nationalYearly);

    // 2. National Monthly Request
    const nationalMonthly = await requestDataset("nationalEnrollment", {
      type: "monthly",
    });
    //console.log("National Monthly Data:", nationalMonthly);

    // 3. County Request (Example using New York for 2023)
    const countyData = await requestDataset("countyEnrollment", {
      state: "NY",
      year: "2023",
    });
    //console.log("County Data (NY 2024):", countyData);

    // 4. All States Snapshot (for All Areas map + country-by-state table)
    const allStates = await requestDataset("allStates", {
      year: "2024",
      month: "Year",
    });
    //console.log("All States Snapshot:", allStates);

    // 5. Single State Yearly Trend (for Counties View yearly trend charts)
    const stateYearly = await requestDataset("stateEnrollment", {
      state: "NY",
      type: "yearly",
    });
    //console.log("NY Yearly Trend:", stateYearly);

    // 6. Single State 12-Month Trend (for Counties View 12-month trend charts)
    const stateMonthly = await requestDataset("stateEnrollment", {
      state: "NY",
      type: "monthly",
    });
    //console.log("NY 12-Month Trend:", stateMonthly);
  } catch (error) {
    console.error("An error occurred during data retrieval:", error.message);
  }
}

// Execute the calls
runDashboardRequests();
