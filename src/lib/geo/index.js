/**
 * Geolocation & Spatial Utilities — Village Finance
 *
 * Implements high-precision straight-line Haversine distance calculations
 * in meters for field collection sorting and radius filters.
 */

const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculate the great-circle distance between two coordinates in meters.
 *
 * @param {number} lat1 - Latitude of point 1 in degrees
 * @param {number} lon1 - Longitude of point 1 in degrees
 * @param {number} lat2 - Latitude of point 2 in degrees
 * @param {number} lon2 - Longitude of point 2 in degrees
 * @returns {number} Distance in meters (integer)
 */
export function calculateHaversineDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
    return Infinity;
  }

  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_METERS * c);
}

/**
 * Format meters into human-readable distance (e.g. "350 m" or "2.4 km").
 *
 * @param {number|null} meters
 * @returns {string}
 */
export function formatDistance(meters) {
  if (meters == null || !Number.isFinite(meters) || meters === Infinity) {
    return 'Distance unavailable';
  }
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}
