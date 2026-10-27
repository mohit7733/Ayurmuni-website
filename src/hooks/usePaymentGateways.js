import { useEffect, useMemo, useState } from 'react';
import { isAuthenticated } from '../services/guestAuth';
import { user_profile } from '../services/profileService';
import { resolveDefaultGateway, resolveEnabledGateways } from '../payment/gateways';

/**
 * Gateways enabled for the signed-in customer (profile `payment_gateways`) plus the selected one.
 * Defaults to Cashfree, exactly like the app, so existing checkout behaviour is unchanged
 * unless the backend disables it or the customer picks another gateway.
 */
export default function usePaymentGateways() {
  const [profile, setProfile] = useState(null);
  const [picked, setPicked] = useState(null);

  useEffect(() => {
    let alive = true;
    // isAuthenticated() is async: it must be awaited, a bare call is always truthy.
    Promise.resolve(isAuthenticated())
      .then((signedIn) => (signedIn ? user_profile() : null))
      .then((res) => {
        if (alive && res && res.success !== false) setProfile(res.data ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const enabled = useMemo(() => resolveEnabledGateways(profile), [profile]);
  const fallback = useMemo(() => resolveDefaultGateway(profile, enabled), [profile, enabled]);
  const gateway = picked && enabled.includes(picked) ? picked : fallback;

  return { gateways: enabled, gateway, setGateway: setPicked };
}