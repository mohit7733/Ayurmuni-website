import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { Utils } from '../common/utils';
import { showSuccessToast } from '../config/key';
import { persistProfileAndSyncAccess, requireAuth } from '../services/guestAuth';
import { update_Profile, UploadProfilePhoto, user_profile } from '../services/profileService';
import { Button, Chip, Disclaimer, Input } from '../components/ui';
import { PROFILE_COPY as T } from '../content/profile';
import '../design/pages/profile.css';

const toText = (value) => {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') return String(value.url || value.uri || value.label || '');
  return '';
};

const normalize = (user) => ({
  first_name: toText(user?.first_name),
  last_name: toText(user?.last_name),
  email: toText(user?.email),
  profile_picture: toText(user?.profile_picture),
  secondary_number: toText(user?.secondary_number),
  gender: toText(user?.gender).toLowerCase(),
  date_of_birth: toText(user?.date_of_birth),
});

export default function EditProfile() {
  const navigate = useNavigate();
  const [form, setForm] = useState(normalize({}));
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      if (!(await requireAuth('Please login to edit your profile'))) return;
      const cached = await Utils.getData('_USER_INFO');
      if (cached) setForm(normalize(cached));
      const res = await user_profile();
      if (res?.success !== false && res?.data) setForm(normalize(res.data));
    })();
  }, []);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const onImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append('image', file);
      body.append('dir', 'customer_avatar');
      const res = await UploadProfilePhoto(body);
      const url = res?.data?.url || res?.url || '';
      if (res?.success === false || !url) {
        showSuccessToast(res?.message || 'Unable to upload photo', 'error');
        return;
      }
      setField('profile_picture', url);
      showSuccessToast('Photo uploaded', 'success');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.first_name.trim()) {
      showSuccessToast('Please enter your first name', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await update_Profile({
        first_name: form.first_name,
        last_name: String(form.last_name || '').trim(),
        email: form.email,
        secondary_number: form.secondary_number,
        gender: form.gender,
        profile_picture: form.profile_picture,
        date_of_birth: form.date_of_birth,
      });
      if (res?.success === false) {
        showSuccessToast(res?.message || 'Unable to update profile', 'error');
        return;
      }
      await persistProfileAndSyncAccess(res?.data || form);
      showSuccessToast('Profile updated successfully', 'success');
      navigate('/profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell tab="profile">
      <section className="pf-page">
        <PageHeader title={T.editTitle} subtitle={T.editSubtitle} backTo="/profile" />

        <div className="pf-edit">
          <aside>
            <label className="pf-avatar-upload">
              <div className="pf-hero__avatar" aria-hidden>
                {form.profile_picture ? (
                  <img src={form.profile_picture} alt="" />
                ) : (
                  <span>{(form.first_name || 'U').charAt(0)}</span>
                )}
              </div>
              <span className="am-btn am-btn--secondary am-btn--sm" aria-hidden>
                <span className="am-btn__label">{uploading ? T.uploading : T.changePhoto}</span>
              </span>
              <input type="file" accept="image/*" onChange={onImage} disabled={uploading} />
            </label>
          </aside>

          <div>
            <div className="pf-form-grid">
              <Input
                label={T.firstName}
                required
                value={form.first_name}
                onChange={(e) => setField('first_name', e.target.value)}
              />
              <Input
                label={T.lastName}
                value={form.last_name}
                onChange={(e) => setField('last_name', e.target.value)}
              />
              <Input
                label={T.email}
                type="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
              />
              <Input
                label={T.secondaryNumber}
                inputMode="numeric"
                value={form.secondary_number}
                onChange={(e) =>
                  setField('secondary_number', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))
                }
              />
              <Input
                label={T.dateOfBirth}
                type="date"
                value={form.date_of_birth}
                onChange={(e) => setField('date_of_birth', e.target.value)}
              />
              <div className="am-field">
                <span className="am-field__label">{T.gender}</span>
                <div className="pf-gender" role="group" aria-label={T.gender}>
                  {T.genders.map((item) => (
                    <Chip
                      key={item.value}
                      selected={form.gender === item.value}
                      onClick={() => setField('gender', item.value)}
                    >
                      {item.label}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
            <div className="pf-form-actions">
              <Button variant="primary" block loading={loading} onClick={save}>
                {loading ? T.saving : T.saveProfile}
              </Button>
            </div>
          </div>
        </div>

        <Disclaimer />
      </section>
    </AppShell>
  );
}
