import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MapPin, Plus } from 'lucide-react';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { formatAddress } from '../cart/mapCart';
import { useLocation as useDeliveryLocation } from '../context/LocationContext';
import { requireAuth } from '../services/guestAuth';
import { showSuccessToast } from '../config/key';
import { deleteAddress, getAddresses, listAddresses, updateAddress } from '../services/profileService';
import { savedAddressToParsed } from '../services/locationService';
import {
  Badge,
  Button,
  Disclaimer,
  EmptyState,
  Skeleton,
  SkeletonText,
} from '../components/ui';
import { PROFILE_COPY as T } from '../content/profile';
import '../design/pages/profile.css';

export default function Addresses() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.returnTo;
  const { currentAddress, deliveryLocation, setDeliveryLocation } = useDeliveryLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await getAddresses();
    setItems(listAddresses(res));
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      if (!(await requireAuth('Please login to manage addresses'))) return;
      load();
    })();
  }, []);

  const remove = async (id) => {
    const res = await deleteAddress(id);
    if (res?.success === false) {
      showSuccessToast(res?.message || 'Unable to delete address', 'error');
      return;
    }
    showSuccessToast('Address deleted successfully', 'success');
    load();
  };

  const pinLocation = () => {
    navigate('/location-picker', {
      state: {
        returnTo: returnTo || '/profile/addresses',
      },
    });
  };

  const chooseAddress = async (item) => {
    await setDeliveryLocation(savedAddressToParsed(item));
    if (!item?.is_default && item?.id) {
      const res = await updateAddress(item.id, { is_default: true });
      if (res?.success === false) {
        showSuccessToast(res?.message || 'Unable to set default address', 'error');
        return;
      }
    }
    if (returnTo) {
      navigate(returnTo, { state: { selectedAddress: item } });
    } else {
      load();
    }
  };

  const preview = currentAddress?.formatted_address || deliveryLocation?.formatted_address;

  return (
    <AppShell tab="profile">
      <section className="pf-page">
        <PageHeader
          title={T.addressesTitle}
          subtitle={T.addressesSubtitle}
          backTo={returnTo || '/profile'}
          actions={
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<Plus size={16} aria-hidden />}
              onClick={() => navigate('/profile/addresses/new', { state: { returnTo } })}
            >
              {T.add}
            </Button>
          }
        />

        <button type="button" className="pf-loc-card" onClick={pinLocation}>
          <strong className="pf-loc-card__title">
            <MapPin size={14} aria-hidden />
            {T.currentLocation}
          </strong>
          <p>{preview || T.currentLocationHint}</p>
          <small>
            {currentAddress || deliveryLocation
              ? [
                  currentAddress?.city || deliveryLocation?.city,
                  currentAddress?.state || deliveryLocation?.state,
                  currentAddress?.zipcode || deliveryLocation?.zipcode,
                ]
                  .filter(Boolean)
                  .join(', ')
              : T.enableLocation}
          </small>
        </button>

        {loading ? (
          <div className="pf-skel" aria-busy="true" aria-label={T.loadingAddresses}>
            <Skeleton style={{ height: 120, borderRadius: 'var(--am-radius-lg)' }} />
            <SkeletonText lines={3} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title={T.emptyAddressesTitle}
            description={T.emptyAddressesText}
            action={
              <Button
                variant="primary"
                onClick={() => navigate('/profile/addresses/new', { state: { returnTo } })}
              >
                {T.addAddress}
              </Button>
            }
          />
        ) : (
          <div className="pf-addr-list">
            {items.map((item) => (
              <article key={item.id} className="pf-addr-card">
                <div className="pf-addr-card__head">
                  <h3>{item.address_type_name || item.address_type || 'Address'}</h3>
                  {item.is_default ? <Badge tone="success">{T.default}</Badge> : null}
                </div>
                <p>{formatAddress(item)}</p>
                <div className="pf-addr-card__actions">
                  <Button
                    variant={item.is_default ? 'secondary' : 'primary'}
                    size="sm"
                    onClick={() => chooseAddress(item)}
                  >
                    {item.is_default ? T.selected : T.deliverHere}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      navigate(`/profile/addresses/${item.id}`, {
                        state: { address: item, returnTo },
                      })
                    }
                  >
                    {T.editAddress}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(item.id)}>
                    {T.deleteAddress}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}

        <Disclaimer />
      </section>
    </AppShell>
  );
}
