import { requestDataset } from './src/router.js';

const dashboardYearlyComparison = await requestDataset('nationalEnrollment', { type: 'yearly' });
// console.log("Yearly view:", dashboardYearlyComparison);

const dashboardMonthlyComparison = await requestDataset('nationalEnrollment', { type: 'monthly' });
// console.log("Monthly view:", dashboardMonthlyComparison);
