export default function formatFreshnessInfo({ source, freshness } = {}) {
  if (source === 'parquet' && freshness) {
    const date = freshness.slice(0, 10);
    return `Data source: downloaded data, generated ${date}.`;
  }
  if (source === 'cms-api') return 'Data source: CMS API.';
  return null;
}
