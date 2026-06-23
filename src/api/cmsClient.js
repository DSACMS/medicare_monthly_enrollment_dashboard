import { baseUrl } from '../config';

async function cmsGet(queryParams) {
  const response = await fetch(`${baseUrl}?${queryParams.toString()}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`CMS API responded with status: ${response.status}`);
  }

  return response.json();
}

export default cmsGet;