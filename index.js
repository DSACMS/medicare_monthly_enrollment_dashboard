import { readFile } from 'node:fs/promises';

const national = JSON.parse(await readFile('./client/data/national.json', 'utf-8'));

console.log("Yearly view:", JSON.stringify(national.yearly, null, 2));
console.log("Monthly view:", JSON.stringify(national.monthly, null, 2));
