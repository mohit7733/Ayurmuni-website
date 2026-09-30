import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { LocateFixed, MapPinned } from 'lucide-react';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { showSuccessToast } from '../config/key';
import { useLocation as useDeliveryLocation } from '../context/LocationContext';
import { requireAuth } from '../services/guestAuth';
import { geocodePincode, savedAddressToParsed } from '../services/locationService';
import {
  addAddress,
  getAddresses,
  listAddresses,
  updateAddress,
} from '../services/profileService';
import { Button, Chip, Disclaimer, Input } from '../components/ui';
import { PROFILE_COPY as T } from '../content/profile';
import '../design/pages/profile.css';

export default function AddressForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { addressId } = useParams();
  const isNew = !addressId || addressId === 'new';
  const existing = location.state?.address;
  const selectedLocation = location.state?.selectedLocation;
  const { setDeliveryLocation } = useDeliveryLocation();
  const [form, setForm] = useState({
    address_type: existing?.address_type || 'home',
    address_line_1: selectedLocation?.address_line_1 || existing?.address_line_1 || '',
    address_line_2: selectedLocation?.address_line_2 || existing?.address_line_2 || '',
    city: selectedLocation?.city || existing?.city || '',
    state: selectedLocation?.state || existing?.state || '',
    zipcode: selectedLocation?.zipcode || existing?.zipcode || existing?.pincode || '',
    is_default: existing?.is_default ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const lastPincodeLookupRef = useRef('');
  const [cityStateLocked, setCityStateLocked] = useState(
    Boolean((selectedLocation?.city || existing?.city) && (selectedLocation?.state || existing?.state)),
  );

  useEffect(() => {
    (async () => {
      if (!(await requireAuth('Please login to save an address'))) return;
      if (isNew || existing) return;
      const res = await getAddresses();
      const found = listAddresses(res).find((item) => String(item.id) === String(addressId));
      if (found) {
        setForm({
          address_type: found.address_type || 'home',
          address_line_1: found.address_line_1 || '',
          address_line_2: found.address_line_2 || '',
          city: found.city || '',
          state: found.state || '',
          zipcode: found.zipcode || found.pincode || '',
          is_default: found.is_default ?? true,
        });
        if (found.city && found.state) setCityStateLocked(true);
      }
    })();
  }, [addressId, existing, isNew]);

  useEffect(() => {
    if (!selectedLocation) return;
    setForm((prev) => ({
      ...prev,
      address_line_1: selectedLocation.address_line_1 || prev.address_line_1,
      address_line_2: selectedLocation.address_line_2 || prev.address_line_2,
      city: selectedLocation.city || prev.city,
      state: selectedLocation.state || prev.state,
      zipcode: selectedLocation.zipcode || prev.zipcode,
    }));
    if (selectedLocation.city || selectedLocation.state) {
      setCityStateLocked(true);
    }
  }, [selectedLocation]);

  useEffect(() => {
    const cleaned = String(form.zipcode || '').replace(/[^0-9]/g, '');
    if (cleaned.length !== 6 || cleaned === lastPincodeLookupRef.current) return undefined;
    const timer = setTimeout(async () => {
      setPincodeLoading(true);
      try {
        const result = await geocodePincode(cleaned);
        if (result) {
          lastPincodeLookupRef.current = cleaned;
          setForm((prev) => ({
            ...prev,
            city: result.city || prev.city,
            state: result.state || prev.state,
            address_line_1: prev.address_line_1.trim()
              ? prev.address_line_1
              : result.address_line_1 || prev.address_line_1,
          }));
          if (result.city || result.state) setCityStateLocked(true);
        }
      } finally {
        setPincodeLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [form.zipcode]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const setZipcode = (value) => {
    const cleaned = String(value || '').replace(/[^0-9]/g, '').slice(0, 6);
    if (cleaned !== form.zipcode) lastPincodeLookupRef.current = '';
    if (String(form.zipcode).length === 6 && cleaned.length < 6) {
      setCityStateLocked(false);
    }
    setField('zipcode', cleaned);
  };

  const mapState = {
    returnScreen: 'AddEditAddress',
    returnTo: location.state?.returnTo,
    returnParams: {
      type: isNew ? 'ADD' : 'EDIT',
      addressId,
      data: existing,
      returnTo: location.state?.returnTo,
    },
  };

  const save = async () => {
    if (!form.address_line_1.trim() || !form.city.trim() || !form.zipcode.trim()) {
      showSuccessToast('Please fill address, city and pincode', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        address_type: form.address_type,
        address_line_1: form.address_line_1,
        address_line_2: form.address_line_2,
        city: form.city,
        state: form.state,
        zipcode: form.zipcode,
        is_default: true,
        country: 'India',
      };
      const res = isNew ? await addAddress(payload) : await updateAddress(addressId, payload);
      if (res?.success === false) {
        showSuccessToast(res?.message || 'Unable to save address', 'error');
        return;
      }
      showSuccessToast(
        isNew ? 'Address added successfully' : 'Address updated successfully',
        'success',
      );
      await setDeliveryLocation(
        savedAddressToParsed({
          address_line_1: form.address_line_1,
          address_line_2: form.address_line_2,
          city: form.city,
          state: form.state,
          zipcode: form.zipcode,
          country: 'India',
        }),
      );
      const saved =
        (res?.data && !Array.isArray(res.data) && (res.data.id || res.data.address_id)
          ? res.data
          : res?.data?.address) || { ...payload, id: addressId };
      const from = location.state?.returnTo;
      navigate(from || '/profile/addresses', from ? { state: { selectedAddress: saved } } : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell tab="profile">
      <section className="pf-page">
        <PageHeader
          title={isNew ? T.formAddTitle : T.formEditTitle}
          subtitle={T.formSubtitle}
          onBack={() => navigate(-1)}
        />

        <div className="pf-map-actions">
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<MapPinned size={16} aria-hidden />}
            onClick={() => navigate('/location-picker', { state: mapState })}
          >
            {T.pickOnMap}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<LocateFixed size={16} aria-hidden />}
            onClick={() => navigate('/location-picker', { state: { ...mapState, useGps: true } })}
          >
            {T.useCurrentLocation}
          </Button>
        </div>

        {selectedLocation?.formatted_address || form.city ? (
          <p className="pf-preview">
            {selectedLocation?.formatted_address ||
              [form.address_line_1, form.city, form.state, form.zipcode].filter(Boolean).join(', ')}
          </p>
        ) : null}

        <div className="pf-gender" role="group" aria-label="Address type">
          {T.addressTypes.map((item) => (
            <Chip
              key={item.value}
              selected={form.address_type === item.value}
              onClick={() => setField('address_type', item.value)}
            >
              {item.label}
            </Chip>
          ))}
        </div>

        <div className="pf-form-grid">
          <Input
            label={T.addressLine1}
            required
            value={form.address_line_1}
            onChange={(e) => setField('address_line_1', e.target.value)}
          />
          <Input
            label={T.addressLine2}
            value={form.address_line_2}
            onChange={(e) => setField('address_line_2', e.target.value)}
          />
          <Input
            label={T.city}
            required
            value={form.city}
            disabled={cityStateLocked}
            onChange={(e) => setField('city', e.target.value)}
          />
          <Input
            label={T.state}
            value={form.state}
            disabled={cityStateLocked}
            onChange={(e) => setField('state', e.target.value)}
          />
          <Input
            label={T.pincode}
            required
            hint={pincodeLoading ? T.pincodeLookingUp : cityStateLocked ? T.cityStateLockedHint : undefined}
            inputMode="numeric"
            value={form.zipcode}
            onChange={(e) => setZipcode(e.target.value)}
          />
        </div>

        <div className="pf-form-actions">
          <Button variant="primary" block loading={saving} onClick={save}>
            {saving ? T.saving : T.saveAddress}
          </Button>
        </div>

        <Disclaimer />
      </section>
    </AppShell>
  );
}
