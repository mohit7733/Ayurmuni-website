import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Utils } from '../common/utils';
import {
  getCurrentPosition,
  reverseGeocode,
  savedAddressToParsed,
} from '../services/locationService';

const LocationContext = createContext(null);
const DELIVERY_KEY = '_DELIVERY_LOCATION';

export function LocationProvider({ children }) {
  const [currentAddress, setCurrentAddress] = useState(null);
  const [deliveryLocation, setDeliveryLocationState] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);

  const setDeliveryLocation = useCallback(async (address) => {
    setDeliveryLocationState(address);
    if (address) {
      await Utils.storeData(DELIVERY_KEY, address);
    } else {
      await Utils.removeData(DELIVERY_KEY);
    }
  }, []);

  const clearLocationSession = useCallback(async () => {
    setCurrentAddress(null);
    setDeliveryLocationState(null);
    setLoadingLocation(false);
    setLocationEnabled(false);
    await Utils.removeData(DELIVERY_KEY);
  }, []);

  const refreshCurrentLocation = useCallback(async () => {
    setLoadingLocation(true);
    try {
      const coords = await getCurrentPosition();
      const address = await reverseGeocode(coords);
      setCurrentAddress(address);
      setLocationEnabled(true);
      const saved = await Utils.getData(DELIVERY_KEY);
      if (!saved) {
        await setDeliveryLocation(address);
      }
      return address;
    } catch {
      setLocationEnabled(false);
      return null;
    } finally {
      setLoadingLocation(false);
    }
  }, [setDeliveryLocation]);

  useEffect(() => {
    (async () => {
      const saved = await Utils.getData(DELIVERY_KEY);
      if (saved?.formatted_address || saved?.city || saved?.address_line_1) {
        setDeliveryLocationState(savedAddressToParsed(saved));
      }
    })();
  }, []);

  const value = useMemo(
    () => ({
      currentAddress,
      deliveryLocation,
      loadingLocation,
      locationEnabled,
      refreshCurrentLocation,
      setDeliveryLocation,
      clearLocationSession,
    }),
    [
      currentAddress,
      deliveryLocation,
      loadingLocation,
      locationEnabled,
      refreshCurrentLocation,
      setDeliveryLocation,
      clearLocationSession,
    ],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export const useLocation = () => {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    return {
      currentAddress: null,
      deliveryLocation: null,
      loadingLocation: false,
      locationEnabled: false,
      refreshCurrentLocation: async () => null,
      setDeliveryLocation: async () => {},
      clearLocationSession: async () => {},
    };
  }
  return ctx;
};
