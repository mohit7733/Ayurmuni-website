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

const nominatim = async (path) => {
  const response = await fetch(`https://nominatim.openstreetmap.org${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error('Location lookup failed');
  }
  return response.json();
};

const geocodePincodeIndiaPost = async (pincode) => {
  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
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

export const reverseGeocode = async (coords) => {
  const data = await nominatim(
    `/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&addressdetails=1&zoom=18`,
  );
  if (!data?.address) {
    throw new Error('Could not resolve address for this pin.');
  }
  return parseNominatim(data, coords);
};

export const geocodePincode = async (pincode) => {
  const cleaned = String(pincode || '').replace(/[^0-9]/g, '');
  if (cleaned.length !== 6) return null;

  try {
    const data = await nominatim(
      `/search?postalcode=${encodeURIComponent(cleaned)}&country=India&format=json&addressdetails=1&limit=1`,
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

export const searchPlaces = async (query) => {
  const q = String(query || '').trim();
  if (!q) return [];
  const data = await nominatim(
    `/search?q=${encodeURIComponent(q)}&countrycodes=in&format=json&addressdetails=1&limit=6`,
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

export const getCurrentPosition = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
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
