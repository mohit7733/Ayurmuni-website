import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation as useRouterLocation, useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import InteractiveMapPicker from '../components/InteractiveMapPicker';
import { useLocation } from '../context/LocationContext';
import { showSuccessToast } from '../config/key';
import {
  enrichAddressWithPincode,
  geocodePincode,
  getCurrentPosition,
  getDefaultRegion,
  getPlaceDetails,
  reverseGeocode,
  searchPlaces,
} from '../services/locationService';

export default function LocationPicker() {
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();
  const params = routerLocation.state || {};
  const useGpsOnly = params.useGps === true;
  const { currentAddress, deliveryLocation, setDeliveryLocation } = useLocation();

  const initialCoords =
    currentAddress ||
    (deliveryLocation?.latitude && deliveryLocation?.longitude ? deliveryLocation : null);

  const [marker, setMarker] = useState(
    initialCoords
      ? { latitude: initialCoords.latitude, longitude: initialCoords.longitude }
      : getDefaultRegion(),
  );
  const [address, setAddress] = useState(currentAddress || deliveryLocation);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [pincodeInput, setPincodeInput] = useState(
    String(currentAddress?.zipcode || deliveryLocation?.zipcode || '').replace(/[^0-9]/g, '').slice(0, 6),
  );
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const lastPincodeLookupRef = useRef('');
  const gpsStarted = useRef(false);

  const applyParsedAddress = useCallback((parsed) => {
    setAddress(parsed);
    setMarker({ latitude: parsed.latitude, longitude: parsed.longitude });
    if (parsed.zipcode) {
      setPincodeInput(String(parsed.zipcode).replace(/[^0-9]/g, '').slice(0, 6));
    }
  }, []);

  const updateLocation = useCallback(
    async (coords) => {
      setGeocoding(true);
      setLocationError('');
      try {
        const parsed = await reverseGeocode(coords);
        const enriched = await enrichAddressWithPincode(parsed);
        applyParsedAddress(enriched);
      } catch (error) {
        setMarker(coords);
        setLocationError(error?.message || 'Could not fetch address. Try search or enter a pincode.');
      } finally {
        setGeocoding(false);
      }
    },
    [applyParsedAddress],
  );

  const loadCurrentLocation = useCallback(async () => {
    setLoading(true);
    setLocationError('');
    try {
      const coords = await getCurrentPosition();
      await updateLocation(coords);
    } catch {
      setLocationError('Location unavailable. Search, enter a pincode, or move the map.');
    } finally {
      setLoading(false);
    }
  }, [updateLocation]);

  useEffect(() => {
    if (useGpsOnly && !gpsStarted.current) {
      gpsStarted.current = true;
      loadCurrentLocation();
    }
  }, [useGpsOnly, loadCurrentLocation]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSuggestions([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        setSuggestions(await searchPlaces(q));
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const cleaned = pincodeInput.replace(/[^0-9]/g, '');
    if (cleaned.length !== 6 || cleaned === lastPincodeLookupRef.current) return undefined;
    const timer = setTimeout(async () => {
      setPincodeLoading(true);
      setLocationError('');
      try {
        const parsed = await geocodePincode(cleaned);
        if (!parsed) {
          setLocationError('Invalid pincode. Please check and try again.');
          return;
        }
        lastPincodeLookupRef.current = cleaned;
        setAddress((prev) => ({
          ...parsed,
          address_line_1: prev?.address_line_1 || parsed.address_line_1,
          address_line_2: prev?.address_line_2 || parsed.address_line_2,
          formatted_address:
            parsed.formatted_address ||
            [parsed.city, parsed.state, cleaned].filter(Boolean).join(', '),
        }));
        setMarker({ latitude: parsed.latitude, longitude: parsed.longitude });
      } catch {
        setLocationError('Could not fetch address for this pincode.');
      } finally {
        setPincodeLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [pincodeInput]);

  const handleSelectSuggestion = async (item) => {
    setSearchQuery(item.main_text);
    setSuggestions([]);
    setGeocoding(true);
    try {
      const parsed = await getPlaceDetails(item);
      applyParsedAddress(parsed);
    } catch {
      showSuccessToast('Could not load this place. Please try again.', 'error');
    } finally {
      setGeocoding(false);
    }
  };

  const handleContinue = async () => {
    if (!address) {
      showSuccessToast('Move the map or search to pick your address.', 'error');
      return;
    }
    const selectedLocation = {
      address_line_1: address.address_line_1,
      address_line_2: address.address_line_2,
      city: address.city,
      state: address.state,
      zipcode: address.zipcode,
      country: address.country,
      latitude: address.latitude,
      longitude: address.longitude,
      formatted_address: address.formatted_address,
    };
    await setDeliveryLocation(address);

    const returnParams = params.returnParams || {};
    const returnTo = params.returnTo || returnParams.returnTo;
    if (params.returnScreen === 'AddEditAddress' || params.returnScreen === 'address-form') {
      const addressId = returnParams.addressId || (returnParams.type === 'EDIT' ? returnParams.data?.id : 'new');
      navigate(addressId && addressId !== 'new' ? `/profile/addresses/${addressId}` : '/profile/addresses/new', {
        state: {
          selectedLocation,
          address: returnParams.data || returnParams.address,
          returnTo,
        },
      });
      return;
    }

    navigate('/profile/addresses/new', {
      state: { selectedLocation, returnTo },
    });
  };

  return (
    <AppShell tab="home">
      <section className="catalog-page loc-page">
        <header className="catalog-head">
          <button type="button" className="text-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <div>
            <h1>Pin Your Location</h1>
            <p>Enter a pincode or move the map</p>
          </div>
        </header>

        <label className="loc-search">
          <span>⌕</span>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search area, street, landmark..."
          />
          {searching ? <em>…</em> : null}
        </label>

        <label className="loc-search">
          <span>📍</span>
          <input
            value={pincodeInput}
            onChange={(e) => {
              const cleaned = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
              if (cleaned !== pincodeInput) lastPincodeLookupRef.current = '';
              setPincodeInput(cleaned);
            }}
            placeholder="Enter 6-digit pincode"
            inputMode="numeric"
            maxLength={6}
          />
          {pincodeLoading ? <em>…</em> : null}
        </label>

        {suggestions.length > 0 ? (
          <div className="privacy-card loc-suggestions">
            {suggestions.map((item) => (
              <button
                key={item.place_id}
                type="button"
                className="privacy-row"
                onClick={() => handleSelectSuggestion(item)}
              >
                <span>
                  <strong>{item.main_text}</strong>
                  {item.secondary_text ? <small>{item.secondary_text}</small> : null}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        <InteractiveMapPicker center={marker} onCenterChange={updateLocation} loading={loading} />

        <button
          type="button"
          className="ghost loc-gps"
          onClick={loadCurrentLocation}
          disabled={loading}
        >
          Use my current location
        </button>
        <p className="loc-hint">Move the map — pin stays at center</p>
        {locationError ? <p className="loc-error">{locationError}</p> : null}

        <div className="loc-address">
          {geocoding ? (
            <p className="muted">Fetching address…</p>
          ) : (
            <>
              <strong>{address?.formatted_address || 'Move map, search, or enter pincode'}</strong>
              {address?.city ? (
                <small>
                  {[address.city, address.state, address.zipcode].filter(Boolean).join(', ')}
                </small>
              ) : null}
            </>
          )}
        </div>

        <button
          type="button"
          className="cta"
          disabled={!address || geocoding}
          onClick={handleContinue}
        >
          Continue
        </button>
      </section>
    </AppShell>
  );
}
