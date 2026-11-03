import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation as useRouterLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Hash, Loader2, LocateFixed, MapPin, RotateCw, Search } from 'lucide-react';
import AppShell from '../components/AppShell';
import '../design/pages/location-picker.css';
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
  GEOCODE_UNAVAILABLE_MESSAGE,
  isAbortError,
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
  const [retryable, setRetryable] = useState(false);
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

  const geocodeControllerRef = useRef(null);
  const moveTimerRef = useRef(null);
  const lastCoordsRef = useRef(null);

  // Resolve an address for coords. A newer call aborts the older request, and
  // aborts are never shown to the user.
  const updateLocation = useCallback(
    async (coords) => {
      clearTimeout(moveTimerRef.current);
      geocodeControllerRef.current?.abort();
      const controller = new AbortController();
      geocodeControllerRef.current = controller;
      lastCoordsRef.current = coords;
      setGeocoding(true);
      setLocationError('');
      setRetryable(false);
      try {
        const parsed = await reverseGeocode(coords, { signal: controller.signal });
        // Reverse geocoding already returns a postcode; only fall back to a pincode lookup when missing.
        const enriched = parsed.zipcode ? parsed : await enrichAddressWithPincode(parsed);
        if (controller.signal.aborted) return;
        applyParsedAddress(enriched);
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) return;
        setMarker(coords);
        setLocationError(GEOCODE_UNAVAILABLE_MESSAGE);
        setRetryable(true);
      } finally {
        if (geocodeControllerRef.current === controller) setGeocoding(false);
      }
    },
    [applyParsedAddress],
  );

  // Map moves are debounced (~600ms) so dragging doesn't hammer the geocoder.
  const handleMapMove = useCallback(
    (coords) => {
      clearTimeout(moveTimerRef.current);
      moveTimerRef.current = setTimeout(() => updateLocation(coords), 600);
    },
    [updateLocation],
  );

  useEffect(
    () => () => {
      clearTimeout(moveTimerRef.current);
      geocodeControllerRef.current?.abort();
    },
    [],
  );

  const retryGeocode = () => {
    if (lastCoordsRef.current) updateLocation(lastCoordsRef.current);
  };

  const loadCurrentLocation = useCallback(async () => {
    setLoading(true);
    setLocationError('');
    setRetryable(false);
    let coords;
    try {
      coords = await getCurrentPosition();
    } catch (error) {
      setLocationError(error?.message || 'Location unavailable. Search, enter a pincode, or move the map.');
      setLoading(false);
      return;
    }
    setMarker(coords);
    setLoading(false);
    await updateLocation(coords);
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
    // Debounced; a newer query aborts the older lookup so its results never replace newer ones.
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const places = await searchPlaces(q, { signal: controller.signal });
        if (!controller.signal.aborted) setSuggestions(places);
      } catch {
        if (!controller.signal.aborted) setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
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
      <section className="catalog-page loc-page loc-premium">
        <header className="locp-head">
          <button type="button" className="locp-back" onClick={() => navigate(-1)} aria-label="Back">
            <ArrowLeft size={18} aria-hidden />
          </button>
          <div>
            <h1>Pin your location</h1>
            <p>Search, enter a pincode or move the map</p>
          </div>
        </header>

        <div className="locp-fields">
          <label className="locp-field">
            <Search size={16} aria-hidden />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search area, street, landmark..."
              aria-label="Search location"
            />
            {searching ? <Loader2 size={16} className="locp-spin" aria-hidden /> : null}
          </label>

          <label className="locp-field locp-field--pin">
            <Hash size={16} aria-hidden />
            <input
              value={pincodeInput}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                if (cleaned !== pincodeInput) lastPincodeLookupRef.current = '';
                setPincodeInput(cleaned);
              }}
              placeholder="Pincode"
              inputMode="numeric"
              maxLength={6}
              aria-label="Pincode"
            />
            {pincodeLoading ? <Loader2 size={16} className="locp-spin" aria-hidden /> : null}
          </label>
        </div>

        {suggestions.length > 0 ? (
          <div className="locp-suggestions" role="listbox">
            {suggestions.map((item) => (
              <button
                key={item.place_id}
                type="button"
                className="locp-suggestion"
                onClick={() => handleSelectSuggestion(item)}
              >
                <MapPin size={16} aria-hidden />
                <span>
                  <strong>{item.main_text}</strong>
                  {item.secondary_text ? <small>{item.secondary_text}</small> : null}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        <InteractiveMapPicker center={marker} onCenterChange={handleMapMove} loading={loading}>
          <span className="locp-chip">Move the map · pin stays at centre</span>
          <button
            type="button"
            className="locp-gps"
            onClick={loadCurrentLocation}
            disabled={loading}
          >
            <LocateFixed size={16} aria-hidden />
            {loading ? 'Locating…' : 'Use my current location'}
          </button>
        </InteractiveMapPicker>

        {locationError ? (
          <div className="locp-alert" role="alert">
            <AlertCircle size={16} aria-hidden />
            <span>{locationError}</span>
            {retryable ? (
              <button type="button" onClick={retryGeocode} disabled={geocoding}>
                <RotateCw size={14} aria-hidden />
                Retry
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="locp-address">
          <span className="locp-address__icon" aria-hidden>
            <MapPin size={18} />
          </span>
          <div className="locp-address__text">
            <small className="locp-address__eyebrow">Delivering to</small>
            {geocoding ? (
              <p className="locp-address__muted">Fetching address…</p>
            ) : (
              <>
                <strong>
                  {address?.address_line_1 || address?.formatted_address || 'Move map, search, or enter pincode'}
                </strong>
                {address ? (
                  <p className="locp-address__muted">
                    {[address.address_line_2, address.city, address.state, address.zipcode]
                      .filter(Boolean)
                      .join(', ') || address.formatted_address}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          className="locp-cta"
          disabled={!address || geocoding}
          onClick={handleContinue}
        >
          Confirm location
        </button>
      </section>
    </AppShell>
  );
}
