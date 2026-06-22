import { baseUrl } from '../config.js';

export async function cmsGet(queryParams) {
  const url = `${baseUrl}?${queryParams.toString()}`;
  const cacheKey = `cms:${url}`;

  const cached = sessionStorage.getItem(cacheKey);
  if (cached) return JSON.parse(cached);

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`CMS API responded with status: ${response.status}`);
  }

  const data = await response.json();
  sessionStorage.setItem(cacheKey, JSON.stringify(data));
  return data;
}
