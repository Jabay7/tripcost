import type { LatLng, Place, StateCode } from '../types';

/**
 * Major US freight origins and destinations.
 *
 * This is the searchable place list for the trip form. When a real geocoder is
 * wired in (`services/routing.ts`), this becomes the offline fallback.
 */
export const CITIES: Place[] = [
  { id: 'atl', name: 'Atlanta, GA', city: 'Atlanta', state: 'GA', lat: 33.749, lon: -84.388 },
  { id: 'aus', name: 'Austin, TX', city: 'Austin', state: 'TX', lat: 30.267, lon: -97.743 },
  { id: 'bal', name: 'Baltimore, MD', city: 'Baltimore', state: 'MD', lat: 39.29, lon: -76.612 },
  { id: 'bhm', name: 'Birmingham, AL', city: 'Birmingham', state: 'AL', lat: 33.521, lon: -86.802 },
  { id: 'bos', name: 'Boston, MA', city: 'Boston', state: 'MA', lat: 42.36, lon: -71.058 },
  { id: 'buf', name: 'Buffalo, NY', city: 'Buffalo', state: 'NY', lat: 42.886, lon: -78.878 },
  { id: 'cha', name: 'Charlotte, NC', city: 'Charlotte', state: 'NC', lat: 35.227, lon: -80.843 },
  { id: 'chi', name: 'Chicago, IL', city: 'Chicago', state: 'IL', lat: 41.878, lon: -87.63 },
  { id: 'cin', name: 'Cincinnati, OH', city: 'Cincinnati', state: 'OH', lat: 39.103, lon: -84.512 },
  { id: 'cle', name: 'Cleveland, OH', city: 'Cleveland', state: 'OH', lat: 41.499, lon: -81.694 },
  { id: 'clb', name: 'Columbus, OH', city: 'Columbus', state: 'OH', lat: 39.961, lon: -82.999 },
  { id: 'dal', name: 'Dallas, TX', city: 'Dallas', state: 'TX', lat: 32.777, lon: -96.797 },
  { id: 'den', name: 'Denver, CO', city: 'Denver', state: 'CO', lat: 39.739, lon: -104.99 },
  { id: 'des', name: 'Des Moines, IA', city: 'Des Moines', state: 'IA', lat: 41.586, lon: -93.625 },
  { id: 'det', name: 'Detroit, MI', city: 'Detroit', state: 'MI', lat: 42.331, lon: -83.046 },
  { id: 'elp', name: 'El Paso, TX', city: 'El Paso', state: 'TX', lat: 31.759, lon: -106.487 },
  { id: 'fre', name: 'Fresno, CA', city: 'Fresno', state: 'CA', lat: 36.738, lon: -119.787 },
  { id: 'hou', name: 'Houston, TX', city: 'Houston', state: 'TX', lat: 29.76, lon: -95.37 },
  { id: 'ind', name: 'Indianapolis, IN', city: 'Indianapolis', state: 'IN', lat: 39.769, lon: -86.158 },
  { id: 'jax', name: 'Jacksonville, FL', city: 'Jacksonville', state: 'FL', lat: 30.332, lon: -81.656 },
  { id: 'kcm', name: 'Kansas City, MO', city: 'Kansas City', state: 'MO', lat: 39.1, lon: -94.579 },
  { id: 'lar', name: 'Laredo, TX', city: 'Laredo', state: 'TX', lat: 27.506, lon: -99.507 },
  { id: 'lsv', name: 'Las Vegas, NV', city: 'Las Vegas', state: 'NV', lat: 36.17, lon: -115.14 },
  { id: 'lit', name: 'Little Rock, AR', city: 'Little Rock', state: 'AR', lat: 34.746, lon: -92.29 },
  { id: 'lax', name: 'Los Angeles, CA', city: 'Los Angeles', state: 'CA', lat: 34.052, lon: -118.244 },
  { id: 'lou', name: 'Louisville, KY', city: 'Louisville', state: 'KY', lat: 38.253, lon: -85.758 },
  { id: 'lub', name: 'Lubbock, TX', city: 'Lubbock', state: 'TX', lat: 33.578, lon: -101.855 },
  { id: 'mem', name: 'Memphis, TN', city: 'Memphis', state: 'TN', lat: 35.149, lon: -90.049 },
  { id: 'mia', name: 'Miami, FL', city: 'Miami', state: 'FL', lat: 25.762, lon: -80.192 },
  { id: 'mil', name: 'Milwaukee, WI', city: 'Milwaukee', state: 'WI', lat: 43.039, lon: -87.906 },
  { id: 'msp', name: 'Minneapolis, MN', city: 'Minneapolis', state: 'MN', lat: 44.978, lon: -93.265 },
  { id: 'nsh', name: 'Nashville, TN', city: 'Nashville', state: 'TN', lat: 36.163, lon: -86.781 },
  { id: 'nol', name: 'New Orleans, LA', city: 'New Orleans', state: 'LA', lat: 29.951, lon: -90.072 },
  { id: 'nyc', name: 'Newark, NJ', city: 'Newark', state: 'NJ', lat: 40.736, lon: -74.172 },
  { id: 'okc', name: 'Oklahoma City, OK', city: 'Oklahoma City', state: 'OK', lat: 35.468, lon: -97.516 },
  { id: 'oma', name: 'Omaha, NE', city: 'Omaha', state: 'NE', lat: 41.257, lon: -95.934 },
  { id: 'onT', name: 'Ontario, CA', city: 'Ontario', state: 'CA', lat: 34.064, lon: -117.651 },
  { id: 'orl', name: 'Orlando, FL', city: 'Orlando', state: 'FL', lat: 28.538, lon: -81.379 },
  { id: 'phi', name: 'Philadelphia, PA', city: 'Philadelphia', state: 'PA', lat: 39.953, lon: -75.165 },
  { id: 'phx', name: 'Phoenix, AZ', city: 'Phoenix', state: 'AZ', lat: 33.448, lon: -112.074 },
  { id: 'pit', name: 'Pittsburgh, PA', city: 'Pittsburgh', state: 'PA', lat: 40.441, lon: -79.996 },
  { id: 'por', name: 'Portland, OR', city: 'Portland', state: 'OR', lat: 45.515, lon: -122.678 },
  { id: 'ral', name: 'Raleigh, NC', city: 'Raleigh', state: 'NC', lat: 35.779, lon: -78.638 },
  { id: 'ren', name: 'Reno, NV', city: 'Reno', state: 'NV', lat: 39.53, lon: -119.814 },
  { id: 'ric', name: 'Richmond, VA', city: 'Richmond', state: 'VA', lat: 37.541, lon: -77.436 },
  { id: 'slc', name: 'Salt Lake City, UT', city: 'Salt Lake City', state: 'UT', lat: 40.761, lon: -111.891 },
  { id: 'sat', name: 'San Antonio, TX', city: 'San Antonio', state: 'TX', lat: 29.424, lon: -98.494 },
  { id: 'sbd', name: 'San Bernardino, CA', city: 'San Bernardino', state: 'CA', lat: 34.108, lon: -117.29 },
  { id: 'sdg', name: 'San Diego, CA', city: 'San Diego', state: 'CA', lat: 32.716, lon: -117.161 },
  { id: 'sfo', name: 'Stockton, CA', city: 'Stockton', state: 'CA', lat: 37.958, lon: -121.291 },
  { id: 'sav', name: 'Savannah, GA', city: 'Savannah', state: 'GA', lat: 32.081, lon: -81.091 },
  { id: 'sea', name: 'Seattle, WA', city: 'Seattle', state: 'WA', lat: 47.606, lon: -122.332 },
  { id: 'stl', name: 'St. Louis, MO', city: 'St. Louis', state: 'MO', lat: 38.627, lon: -90.199 },
  { id: 'tam', name: 'Tampa, FL', city: 'Tampa', state: 'FL', lat: 27.951, lon: -82.457 },
  { id: 'tol', name: 'Toledo, OH', city: 'Toledo', state: 'OH', lat: 41.654, lon: -83.538 },
  { id: 'tul', name: 'Tulsa, OK', city: 'Tulsa', state: 'OK', lat: 36.154, lon: -95.993 },
  { id: 'wic', name: 'Wichita, KS', city: 'Wichita', state: 'KS', lat: 37.687, lon: -97.336 },
  { id: 'bil', name: 'Billings, MT', city: 'Billings', state: 'MT', lat: 45.783, lon: -108.5 },
  { id: 'boi', name: 'Boise, ID', city: 'Boise', state: 'ID', lat: 43.615, lon: -116.202 },
  { id: 'chy', name: 'Cheyenne, WY', city: 'Cheyenne', state: 'WY', lat: 41.14, lon: -104.82 },
  { id: 'abq', name: 'Albuquerque, NM', city: 'Albuquerque', state: 'NM', lat: 35.084, lon: -106.651 },
  { id: 'fgo', name: 'Fargo, ND', city: 'Fargo', state: 'ND', lat: 46.877, lon: -96.79 },
  { id: 'sfl', name: 'Sioux Falls, SD', city: 'Sioux Falls', state: 'SD', lat: 43.55, lon: -96.7 },
  { id: 'jck', name: 'Jackson, MS', city: 'Jackson', state: 'MS', lat: 32.299, lon: -90.185 },
  { id: 'chs', name: 'Charleston, WV', city: 'Charleston', state: 'WV', lat: 38.349, lon: -81.633 },
  { id: 'har', name: 'Harrisburg, PA', city: 'Harrisburg', state: 'PA', lat: 40.273, lon: -76.885 },
  { id: 'alb', name: 'Albany, NY', city: 'Albany', state: 'NY', lat: 42.652, lon: -73.756 },
  { id: 'har2', name: 'Hartford, CT', city: 'Hartford', state: 'CT', lat: 41.764, lon: -72.685 },
  { id: 'pwt', name: 'Portland, ME', city: 'Portland', state: 'ME', lat: 43.661, lon: -70.255 },
  { id: 'grn', name: 'Greenville, SC', city: 'Greenville', state: 'SC', lat: 34.853, lon: -82.394 },
];

/** Geographic centroids, used to attribute route mileage to states. */
export const STATE_CENTROIDS: Record<StateCode, LatLng> = {
  AL: { lat: 32.8, lon: -86.8 }, AK: { lat: 64.0, lon: -152.0 }, AZ: { lat: 34.3, lon: -111.7 },
  AR: { lat: 34.9, lon: -92.4 }, CA: { lat: 37.2, lon: -119.3 }, CO: { lat: 39.0, lon: -105.5 },
  CT: { lat: 41.6, lon: -72.7 }, DE: { lat: 39.0, lon: -75.5 }, DC: { lat: 38.9, lon: -77.0 },
  FL: { lat: 28.6, lon: -82.4 }, GA: { lat: 32.6, lon: -83.4 }, HI: { lat: 20.3, lon: -156.4 },
  ID: { lat: 44.4, lon: -114.6 }, IL: { lat: 40.0, lon: -89.2 }, IN: { lat: 39.9, lon: -86.3 },
  IA: { lat: 42.1, lon: -93.5 }, KS: { lat: 38.5, lon: -98.4 }, KY: { lat: 37.5, lon: -85.3 },
  LA: { lat: 31.0, lon: -92.0 }, ME: { lat: 45.4, lon: -69.2 }, MD: { lat: 39.0, lon: -76.8 },
  MA: { lat: 42.3, lon: -71.8 }, MI: { lat: 44.3, lon: -85.4 }, MN: { lat: 46.3, lon: -94.3 },
  MS: { lat: 32.7, lon: -89.7 }, MO: { lat: 38.4, lon: -92.5 }, MT: { lat: 47.0, lon: -109.6 },
  NE: { lat: 41.5, lon: -99.8 }, NV: { lat: 39.3, lon: -116.6 }, NH: { lat: 43.7, lon: -71.6 },
  NJ: { lat: 40.2, lon: -74.7 }, NM: { lat: 34.4, lon: -106.1 }, NY: { lat: 42.9, lon: -75.5 },
  NC: { lat: 35.5, lon: -79.4 }, ND: { lat: 47.4, lon: -100.5 }, OH: { lat: 40.3, lon: -82.8 },
  OK: { lat: 35.6, lon: -97.5 }, OR: { lat: 43.9, lon: -120.6 }, PA: { lat: 40.9, lon: -77.8 },
  RI: { lat: 41.7, lon: -71.6 }, SC: { lat: 33.9, lon: -80.9 }, SD: { lat: 44.4, lon: -100.2 },
  TN: { lat: 35.8, lon: -86.4 }, TX: { lat: 31.5, lon: -99.3 }, UT: { lat: 39.3, lon: -111.7 },
  VT: { lat: 44.1, lon: -72.7 }, VA: { lat: 37.5, lon: -78.9 }, WA: { lat: 47.4, lon: -120.5 },
  WV: { lat: 38.6, lon: -80.6 }, WI: { lat: 44.6, lon: -89.7 }, WY: { lat: 43.0, lon: -107.6 },
};

const R_MILES = 3958.8;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in statute miles. */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_MILES * Math.asin(Math.sqrt(s));
}

/** Linear interpolation between two coordinates. Adequate at highway scale. */
export function interpolate(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
}

const CONTINENTAL = (Object.keys(STATE_CENTROIDS) as StateCode[]).filter(
  (s) => s !== 'AK' && s !== 'HI',
);

/** Nearest state centroid to a point. Approximates which state a mile marker is in. */
export function nearestState(p: LatLng): StateCode {
  let best: StateCode = 'TX';
  let bestD = Infinity;
  for (const s of CONTINENTAL) {
    const d = haversineMiles(p, STATE_CENTROIDS[s]);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

export function searchCities(query: string, limit = 8): Place[] {
  const q = query.trim().toLowerCase();
  if (!q) return CITIES.slice(0, limit);
  return CITIES.filter(
    (c) => c.name.toLowerCase().includes(q) || c.state.toLowerCase() === q,
  ).slice(0, limit);
}

export const cityById = (id: string): Place | undefined => CITIES.find((c) => c.id === id);
