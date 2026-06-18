import { mkdir, writeFile } from "node:fs/promises";
import { requestDataset } from "../src/router.js";

const OUT = "client/data";

async function writeJson(relativePath, data) {
  await writeFile(`${OUT}/${relativePath}`, JSON.stringify(data, null, 2) + "\n");
  const size = Array.isArray(data) ? `${data.length} rows` : "object";
  console.log(`wrote ${relativePath} (${size})`);
}

async function main() {
  await mkdir(`${OUT}/states`, { recursive: true });
  await mkdir(`${OUT}/counties`, { recursive: true });

  const [nationalYearly, nationalMonthly] = await Promise.all([
    requestDataset("nationalEnrollment", { type: "yearly" }),
    requestDataset("nationalEnrollment", { type: "monthly" }),
  ]);
  await writeJson("national.json", { yearly: nationalYearly, monthly: nationalMonthly });

  const allStates = await requestDataset("allStates", {});
  await writeJson("allStates.json", allStates);

  const states = [...new Set(allStates.map((row) => row.state))].filter(Boolean).sort();

  for (const state of states) {
    const [yearly, monthly, counties] = await Promise.all([
      requestDataset("stateEnrollment", { state, type: "yearly" }),
      requestDataset("stateEnrollment", { state, type: "monthly" }),
      requestDataset("countyEnrollment", { state }),
    ]);
    await writeJson(`states/${state}.json`, { yearly, monthly });
    await writeJson(`counties/${state}.json`, counties);
  }

  console.log(`\ndone: national + allStates + ${states.length} states`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
