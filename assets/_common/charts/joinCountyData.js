/**
 * Joins county TopoJSON features with CMS enrollment rows by FIPS code.
 *
 * Both sides use zero-padded 5-digit FIPS strings (confirmed against a live
 * CMS API sample: e.g. "01001" for Autauga County, AL) so this is a plain
 * string-keyed lookup — no padding or type coercion needed.
 *
 * Defensive note: the CMS API mixes National/State/County-level rows in its
 * raw response even when filter[BENE_GEO_LVL]=County is requested server-side.
 * National rows carry a blank/space BENE_FIPS_CD ("     "), and State rows
 * carry a 2-digit code. Both would either fail to match or false-match here,
 * so rows without a valid 5-digit fips are skipped rather than trusted.
 *
 * @param {Object[]} countyFeatures - GeoJSON Feature[] from
 *   topojson.feature(us, us.objects.counties).features, already filtered to
 *   one state (see filterCountiesByState below).
 * @param {Object[]} countyRows - output of fetchCountiesForState(), i.e. rows
 *   shaped like { fips, county, totalEnrollees, maPercent, mapdPercent, ... }.
 * @returns {Object[]} one entry PER countyFeature, always — including
 *   counties with no matching row, which get `data: undefined`. This
 *   mirrors renderStateMap's own dataByName.get() pattern (no-data states
 *   still render, just gray) rather than silently dropping them, so callers
 *   that want to render every county boundary — even ones missing CMS
 *   data — don't have to re-derive the full feature list themselves.
 *   Callers that want to skip no-data counties can `.filter(e => e.data)`.
 */
function joinCountyData(countyFeatures, countyRows) {
  const rowByFips = new Map(
    countyRows
      .filter((row) => typeof row.fips === 'string' && /^\d{5}$/.test(row.fips))
      .map((row) => [row.fips, row])
  );

  return countyFeatures.map((feature) => ({
    feature,
    data: rowByFips.get(String(feature.id).padStart(5, '0')),
  }));
}

/**
 * Filters a full counties FeatureCollection down to one state's counties,
 * using the FIPS-prefix relationship documented by us-atlas: the first two
 * digits of a county's 5-digit FIPS code are the state's 2-digit FIPS code.
 *
 * @param {Object[]} countyFeatures - all counties, e.g.
 *   topojson.feature(us, us.objects.counties).features.
 * @param {string} stateFips - 2-digit state FIPS code (the clicked state
 *   feature's `.id`).
 * @returns {Object[]} just that state's county features.
 */
function filterCountiesByState(countyFeatures, stateFips) {
  const stateFipsString = String(stateFips).padStart(2, '0');

  return countyFeatures.filter((county) =>
    String(county.id).padStart(5, '0').slice(0, 2) === stateFipsString
  );
}

export { joinCountyData, filterCountiesByState };