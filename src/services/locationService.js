import { fetchWithTimeout } from './apiClient';

export const getDefaultRegion = () => ({
  latitude: 28.4595,
  longitude: 77.0266,
});

const parseNominatim = (item, coords) => {
  const addr = item?.address || {};
  const city =
    addr.city ||
    addr.town ||
    addr.village ||
    addr.suburb ||
    addr.county ||
    '';
  const state = addr.state || '';
  const zipcode = String(addr.postcode || '').replace(/[^0-9]/g, '').slice(0, 6);
  const line1 =
    [addr.house_number, addr.road, addr.neighbourhood, addr.suburb]
      .filter(Boolean)
      .join(', ') ||
    item?.display_name?.split(',')[0] ||
    '';

  return {
    address_line_1: line1,
    address_line_2: addr.suburb && addr.suburb !== line1 ? addr.suburb : '',
    city,
    state,
    zipcode,
    country: addr.country || 'India',
    formatted_address: item?.display_name || [line1, city, state, zipcode].filter(Boolean).join(', '),
    latitude: coords.latitude,
    longitude: coords.longitude,
  };
};

export const GEOCODE_UNAVAILABLE_MESSAGE =
  "Couldn't fetch the address right now. Please try again, search, or enter a pincode.";

export const isAbortError = (error) =>
  error?.name === 'AbortError' || error?.code === 20;

const geocodeError = (cause) => {
  const err = new Error(GEOCODE_UNAVAILABLE_MESSAGE);
  err.code = 'geocode_unavailable';
  err.retryable = true;
  err.cause = cause;
  return err;
};

const abortError = () => {
  const err = new Error('Aborted');
  err.name = 'AbortError';
  return err;
};

// Nominatim usage policy: max 1 request/second. Requests over the limit get a
// 429 with no CORS headers, which the browser surfaces as "Failed to fetch".
const NOMINATIM_MIN_GAP_MS = 1100;
let nominatimQueue = Promise.resolve();
let nominatimLastAt = 0;

const waitForNominatimSlot = (signal) => {
  const slot = nominatimQueue.then(
    () =>
      new Promise((resolve, reject) => {
        if (signal?.aborted) {
          reject(abortError());
          return;
        }
        const wait = Math.max(0, nominatimLastAt + NOMINATIM_MIN_GAP_MS - Date.now());
        const timer = setTimeout(() => {
          signal?.removeEventListener?.('abort', onAbort);
          nominatimLastAt = Date.now();
          resolve();
        }, wait);
        function onAbort() {
          clearTimeout(timer);
          reject(abortError());
        }
        signal?.addEventListener?.('abort', onAbort, { once: true });
      }),
  );
  nominatimQueue = slot.catch(() => {});
  return slot;
};

const nominatim = async (path, signal) => {
  await waitForNominatimSlot(signal);
  const sep = path.includes('?') ? '&' : '?';
  let response;
  try {
    response = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org${path}${sep}accept-language=en`,
      { headers: { Accept: 'application/json' }, signal },
    );
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) throw abortError();
    throw geocodeError(error);
  }
  if (!response.ok) {
    throw geocodeError(new Error(`Nominatim HTTP ${response.status}`));
  }
  return response.json();
};

// Fallback OSM-based reverse geocoder (CORS-enabled, no key) used when
// Nominatim is rate-limited or unreachable.
const photonReverse = async (coords, signal) => {
  let response;
  try {
    response = await fetchWithTimeout(
      `https://photon.komoot.io/reverse?lat=${coords.latitude}&lon=${coords.longitude}&lang=en`,
      { headers: { Accept: 'application/json' }, signal },
    );
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) throw abortError();
    throw geocodeError(error);
  }
  if (!response.ok) throw geocodeError(new Error(`Photon HTTP ${response.status}`));
  const data = await response.json();
  const p = data?.features?.[0]?.properties;
  if (!p) throw geocodeError(new Error('Photon: no result'));
  const address = {
    house_number: p.housenumber,
    road: p.street || (p.type === 'street' ? p.name : undefined),
    neighbourhood: p.locality,
    suburb: p.district,
    city: p.city,
    county: p.county,
    state: p.state,
    postcode: p.postcode,
    country: p.country,
  };
  const display_name = [p.name, p.street, p.locality, p.district, p.city, p.state, p.postcode, p.country]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(', ');
  return { address, display_name };
};

const reverseCache = new Map();

const geocodePincodeIndiaPost = async (pincode) => {
  try {
    const response = await fetchWithTimeout(`https://api.postalpincode.in/pincode/${pincode}`);
    const data = await response.json();
    const office = Array.isArray(data) ? data[0]?.PostOffice?.[0] : null;
    if (!office) return null;
    const city = office.District || office.Block || office.Name || '';
    const state = office.State || '';
    return {
      address_line_1: office.Name || city || pincode,
      address_line_2: office.Block || '',
      city,
      state,
      zipcode: pincode,
      country: 'India',
      formatted_address: [office.Name, city, state, pincode].filter(Boolean).join(', '),
      latitude: getDefaultRegion().latitude,
      longitude: getDefaultRegion().longitude,
    };
  } catch {
    return null;
  }
};

export const reverseGeocode = async (coords, { signal } = {}) => {
  const key = `${Number(coords.latitude).toFixed(5)},${Number(coords.longitude).toFixed(5)}`;
  if (reverseCache.has(key)) return { ...reverseCache.get(key), ...coords };

  let data;
  try {
    data = await nominatim(
      `/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}&addressdetails=1&zoom=18`,
      signal,
    );
    if (!data?.address) throw geocodeError(new Error('Nominatim: no address'));
  } catch (error) {
    if (isAbortError(error)) throw error;
    data = await photonReverse(coords, signal);
  }
  const parsed = parseNominatim(data, coords);
  if (reverseCache.size > 200) reverseCache.clear();
  reverseCache.set(key, parsed);
  return parsed;
};

export const geocodePincode = async (pincode) => {
  const cleaned = String(pincode || '').replace(/[^0-9]/g, '');
  if (cleaned.length !== 6) return null;

  try {
    const data = await nominatim(
      `/search?postalcode=${encodeURIComponent(cleaned)}&country=India&format=jsonv2&addressdetails=1&limit=1`,
    );
    if (Array.isArray(data) && data[0]) {
      const item = data[0];
      return parseNominatim(item, {
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
      });
    }
  } catch {
    // fall through
  }

  return geocodePincodeIndiaPost(cleaned);
};

export const enrichAddressWithPincode = async (address) => {
  const zip = String(address?.zipcode || '').replace(/[^0-9]/g, '');
  if (zip.length !== 6) return address;
  const fromPin = await geocodePincode(zip);
  if (!fromPin) return address;
  return {
    ...address,
    city: fromPin.city || address.city,
    state: fromPin.state || address.state,
    zipcode: fromPin.zipcode || zip,
    country: fromPin.country || address.country,
    latitude: fromPin.latitude || address.latitude,
    longitude: fromPin.longitude || address.longitude,
    formatted_address:
      address.formatted_address ||
      fromPin.formatted_address ||
      [address.address_line_1, fromPin.city, fromPin.state, zip].filter(Boolean).join(', '),
  };
};

export const searchPlaces = async (query, { signal } = {}) => {
  const q = String(query || '').trim();
  if (!q) return [];
  const data = await nominatim(
    `/search?q=${encodeURIComponent(q)}&countrycodes=in&format=jsonv2&addressdetails=1&limit=6`,
    signal,
  );
  if (!Array.isArray(data)) return [];
  return data.map((item) => ({
    place_id: String(item.place_id || item.osm_id),
    description: item.display_name,
    main_text: item.display_name?.split(',')[0] || item.display_name,
    secondary_text: item.display_name?.split(',').slice(1).join(',').trim() || '',
    latitude: parseFloat(item.lat),
    longitude: parseFloat(item.lon),
    raw: item,
  }));
};

export const getPlaceDetails = async (item) => {
  if (item?.latitude && item?.longitude) {
    const parsed = parseNominatim(item.raw || item, {
      latitude: item.latitude,
      longitude: item.longitude,
    });
    return enrichAddressWithPincode(parsed);
  }
  throw new Error('Could not load this place.');
};

const GEO_MESSAGES = {
  1: 'Location permission denied. Allow location access in your browser, or search / enter a pincode.',
  2: 'Your location is unavailable right now. Search, enter a pincode, or move the map.',
  3: 'Getting your location timed out. Please try again, or search / enter a pincode.',
};

const readGeoPosition = (position) => ({
  latitude: position.coords.latitude,
  longitude: position.coords.longitude,
  accuracy: position.coords.accuracy,
});

/**
 * Fresh device fix for "Use my current location".
 * Prefers a watch for a few seconds (better accuracy) then falls back to getCurrentPosition.
 */
export const getCurrentPosition = (options = {}) =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'));
      return;
    }

    const geoOpts = {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0, // never reuse a cached city/IP guess
      ...options,
    };

    let settled = false;
    let watchId = null;
    let best = null;
    let fallbackTimer = null;

    const finish = (result, error) => {
      if (settled) return;
      settled = true;
      if (watchId != null) {
        try {
          navigator.geolocation.clearWatch(watchId);
        } catch {
          /* ignore */
        }
      }
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (result) resolve(result);
      else {
        const err = error instanceof Error ? error : new Error(GEO_MESSAGES[error?.code] || GEO_MESSAGES[2]);
        err.code = error?.code;
        reject(err);
      }
    };

    // Keep watching briefly and take the most accurate sample.
    try {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const next = readGeoPosition(position);
          if (!best || (next.accuracy && (!best.accuracy || next.accuracy < best.accuracy))) {
            best = next;
          }
          // Good enough for pinning a delivery address.
          if (next.accuracy && next.accuracy <= 75) finish(next);
        },
        (error) => {
          // If watch fails, try a one-shot below.
          if (!best) {
            navigator.geolocation.getCurrentPosition(
              (position) => finish(readGeoPosition(position)),
              (err) => finish(null, err),
              geoOpts,
            );
          }
        },
        geoOpts,
      );
    } catch {
      watchId = null;
    }

    // After 8s, accept the best reading we have; otherwise one-shot.
    fallbackTimer = setTimeout(() => {
      if (best) {
        finish(best);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => finish(readGeoPosition(position)),
        (error) => finish(null, error),
        geoOpts,
      );
    }, 8000);
  });

export const savedAddressToParsed = (item) => {
  const line1 = item?.address_line_1 || '';
  const city = item?.city || '';
  const state = item?.state || '';
  const zip = item?.zipcode || item?.pincode || '';
  const formatted = [line1, city, state, zip].filter(Boolean).join(', ');
  return {
    address_line_1: line1,
    address_line_2: item?.address_line_2 || '',
    city,
    state,
    zipcode: zip,
    country: item?.country || 'India',
    formatted_address: formatted || line1 || city || 'Saved address',
    latitude: Number(item?.latitude) || 0,
    longitude: Number(item?.longitude) || 0,
  };
};
