export async function fetchStateData(state) {
  const data = await fetch(`/client/data/states/${state}.json`).then(r => r.json());
  return data;
}
