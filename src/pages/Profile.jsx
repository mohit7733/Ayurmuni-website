import { useEffect, useRef, useState } from 'react';
import { logoutOneSignalUser } from '../services/pushNotificationService';
import { useNavigate } from 'react-router-dom';
import { Camera, ChevronRight, Eye, LogOut, Trash2 } from 'lucide-react';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { Utils } from '../common/utils';
import { showSuccessToast } from '../config/key';
import {
  getAccessLevel,
  isProfileComplete,
  navigateToCompleteDetails,
  persistProfileAndSyncAccess,
  resolveAccessLikeProfile,
} from '../services/guestAuth';
import { deleteAccount, update_Profile, UploadProfilePhoto } from '../services/profileService';
import useProfileDashboardStats from '../hooks/useProfileDashboardStats';
import { LOGGED_OUT_STATS, buildPhotoOptions, buildProfilePayload } from '../profile/dashboardStats';
import { useLocation as useDeliveryLocation } from '../context/LocationContext';
import { Button, Disclaimer, Modal, SectionHold } from '../components/ui';
import {
  PROFILE_ACCOUNT,
  PROFILE_COPY as T,
  PROFILE_EXPLORE,
  PROFILE_PREFERENCE,
} from '../content/profile';
import '../design/pages/profile.css';

export default function Profile() {
  const navigate = useNavigate();
  const { clearLocationSession } = useDeliveryLocation();
  const [level, setLevel] = useState(null);
  const [user, setUser] = useState(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteDone, setDeleteDone] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [retentionDays, setRetentionDays] = useState(30);
  const [photoSheet, setPhotoSheet] = useState(false);
  const [photoViewer, setPhotoViewer] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef(null);
  const { stats: dashboardStats } = useProfileDashboardStats(level === 'full');

  useEffect(() => {
    let alive = true;
    (async () => {
      const access = await getAccessLevel();
      if (access === 'logged_out') {
        if (alive) {
          setLevel('logged_out');
          setUser(null);
        }
        return;
      }
      const resolved = await resolveAccessLikeProfile();
      if (!alive) return;
      if (resolved.isComplete || resolved.level === 'full' || isProfileComplete(resolved.profile)) {
        setLevel('full');
        setUser(resolved.profile);
        return;
      }
      setLevel(resolved.level === 'guest' ? 'guest' : 'full');
      setUser(resolved.profile);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const logout = async () => {
    await clearLocationSession();
    logoutOneSignalUser();
    await Utils.clearAllData();
    showSuccessToast('Signed out successfully', 'success');
    navigate('/welcome', { replace: true });
  };

  const onDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    const res = await deleteAccount();
    setDeleting(false);
    if (res?.success === false) {
      showSuccessToast(res?.message || 'Unable to delete account', 'error');
      return;
    }
    const days = Number(res?.data?.retention_days ?? res?.retention_days ?? 30);
    setRetentionDays(Number.isFinite(days) && days > 0 ? days : 30);
    setDeleteOpen(false);
    setDeleteDone(true);
  };

  const finishDelete = async () => {
    await clearLocationSession();
    logoutOneSignalUser();
    await Utils.clearAllData();
    navigate('/welcome', { replace: true });
  };

  // Persist a new (or removed) profile picture. Optimistic, reverted on failure (app ProfileHeader).
  const saveProfilePicture = async (nextUrl, message) => {
    const previous = user;
    setUser((prev) => ({ ...(prev || {}), profile_picture: nextUrl }));
    try {
      const res = await update_Profile(buildProfilePayload(previous, nextUrl));
      if (res?.success === false) {
        setUser(previous);
        showSuccessToast(res?.message || 'Could not update profile photo', 'error');
        return;
      }
      const next = { ...(previous || {}), ...(res?.data || {}), profile_picture: nextUrl };
      await persistProfileAndSyncAccess(next);
      setUser(next);
      showSuccessToast(message, 'success');
    } catch {
      setUser(previous);
      showSuccessToast('Could not update profile photo', 'error');
    }
  };

  const onPickPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || photoBusy) return;
    setPhotoBusy(true);
    try {
      const body = new FormData();
      body.append('image', file);
      body.append('dir', 'customer_avatar');
      const res = await UploadProfilePhoto(body);
      const url = String(res?.data?.url || res?.url || '').trim();
      if (res?.success === false || !url) {
        showSuccessToast('Image upload failed. Please try again.', 'error');
        return;
      }
      await saveProfilePicture(url, 'Profile photo updated');
    } finally {
      setPhotoBusy(false);
    }
  };

  const confirmRemovePhoto = async () => {
    setPhotoBusy(true);
    try {
      await saveProfilePicture('', 'Profile photo removed');
    } finally {
      setPhotoBusy(false);
      setRemoveOpen(false);
    }
  };

  const onPhotoAction = (key) => {
    setPhotoSheet(false);
    if (key === 'view') setPhotoViewer(true);
    else if (key === 'change') fileRef.current?.click();
    else if (key === 'remove') setRemoveOpen(true);
  };

  const go = (item) => {
    if (item.soon) {
      navigate(item.to);
      return;
    }
    navigate(item.to, item.state ? { state: item.state } : undefined);
  };

  if (level === null) {
    return (
      <AppShell tab="profile">
        <section className="pf-page" aria-busy="true" aria-label={T.loading}>
          <PageHeader title={T.title} subtitle={T.subtitle} hideBack />
          <SectionHold label={T.loading} minHeight={320} scale="page" />
        </section>
      </AppShell>
    );
  }

  if (level === 'logged_out') {
    return (
      <AppShell tab="profile">
        <section className="pf-page pf-gate">
          <PageHeader title={T.gateTitle} hideBack />
          <p className="pf-guest__text">{T.gateText}</p>
          <Button variant="primary" onClick={() => navigate('/login')}>
            {T.logIn}
          </Button>
        </section>
      </AppShell>
    );
  }

  if (level === 'guest') {
    return (
      <AppShell tab="profile">
        <section className="pf-page pf-gate">
          <p className="pf-guest__brand">{T.guestBrand}</p>
          <h1 className="pf-guest__title">{T.guestTitle}</h1>
          <p className="pf-guest__text">{T.guestText}</p>
          <div className="pf-unlock">
            <h2>{T.unlockTitle}</h2>
            <p>{T.unlockStep1}</p>
            <p>{T.unlockStep2}</p>
            <Button
              variant="primary"
              block
              onClick={() =>
                navigateToCompleteDetails(
                  'Complete your profile and prakriti assessment to continue.',
                )
              }
            >
              {T.completeDetails}
            </Button>
          </div>
          <Button variant="ghost" onClick={() => setLogoutOpen(true)}>
            {T.guestSignOut}
          </Button>
        </section>

        <Modal
          open={logoutOpen}
          onClose={() => setLogoutOpen(false)}
          title={T.logoutTitle}
          description={T.logoutText}
          footer={
            <>
              <Button variant="secondary" onClick={() => setLogoutOpen(false)}>
                {T.logoutCancel}
              </Button>
              <Button variant="primary" onClick={logout}>
                {T.logoutConfirm}
              </Button>
            </>
          }
        />
      </AppShell>
    );
  }

  const name = `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Member';
  const photo = String(user?.profile_picture || '').trim();
  const phone = String(user?.phone_number || '').slice(-10);

  return (
    <AppShell tab="profile">
      <section className="pf-page pf-hub">
        <PageHeader
          title={T.title}
          subtitle={T.subtitle}
          hideBack
          actions={
            <Button variant="secondary" size="sm" onClick={() => navigate('/profile/edit')}>
              {T.edit}
            </Button>
          }
        />

        <div className="pf-hero">
          <button
            type="button"
            className="pf-hero__avatar pf-hero__avatar--btn"
            aria-label={photo ? 'Profile photo options' : 'Add profile photo'}
            aria-busy={photoBusy}
            disabled={photoBusy}
            onClick={() => (photo ? setPhotoSheet(true) : fileRef.current?.click())}
          >
            {photo ? <img src={photo} alt="" /> : <span>{name.charAt(0)}</span>}
            <i className="pf-hero__camera" aria-hidden>
              <Camera size={12} />
            </i>
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickPhoto} />
          <div className="pf-hero__copy">
            <h2>{name}</h2>
            <p className="pf-hero__meta">
              {phone ? `+91 ${phone}` : ''}
              {user?.email ? `${phone ? ' · ' : ''}${user.email}` : ''}
            </p>
            <Button
              className="pf-hero__link"
              variant="ghost"
              size="sm"
              onClick={() => navigate('/prakriti-profile')}
            >
              {T.viewPrakriti}
            </Button>
          </div>
        </div>

        <div className="pf-stats" role="group" aria-label="Your activity">
          {(dashboardStats || LOGGED_OUT_STATS).map((stat) => (
            <button key={stat.key} type="button" className="pf-stat" onClick={() => navigate(stat.to)}>
              <strong>{stat.value}</strong>
              <small>{stat.label}</small>
            </button>
          ))}
        </div>

        <div className="pf-explore" aria-label={T.exploreLabel}>
          {PROFILE_EXPLORE.map((item) => (
            <button
              key={item.title}
              type="button"
              className="pf-explore__card"
              onClick={() => navigate(item.to)}
            >
              <strong>{item.title}</strong>
              <small>{item.subtitle}</small>
            </button>
          ))}
        </div>

        {/* Refer & Earn (ReferralCard) removed per Rohit. */}

        <div className="pf-menus">
          <div className="pf-menu">
            <h3>{T.accountSection}</h3>
            <div className="pf-menu__list">
              {PROFILE_ACCOUNT.map((item) => (
                <button key={item.title} type="button" className="pf-menu__row" onClick={() => go(item)}>
                  <span>{item.title}</span>
                  <em aria-hidden>
                    <ChevronRight size={18} />
                  </em>
                </button>
              ))}
              <button
                type="button"
                className="pf-menu__row is-danger"
                onClick={() => setDeleteOpen(true)}
              >
                <span>{T.deleteAccount}</span>
                <em aria-hidden>
                  <ChevronRight size={18} />
                </em>
              </button>
            </div>
          </div>

          <div className="pf-menu">
            <h3>{T.preferenceSection}</h3>
            <div className="pf-menu__list">
              {PROFILE_PREFERENCE.map((item) => (
                <button key={item.title} type="button" className="pf-menu__row" onClick={() => go(item)}>
                  <span>{item.title}</span>
                  <em aria-hidden>
                    <ChevronRight size={18} />
                  </em>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pf-foot">
          <Button
            variant="secondary"
            leadingIcon={<LogOut size={18} aria-hidden />}
            onClick={() => setLogoutOpen(true)}
          >
            {T.logout}
          </Button>
          <p className="pf-version">{T.version}</p>
        </div>

        <Disclaimer />
      </section>

      <Modal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title={T.logoutTitle}
        description={T.logoutText}
        footer={
          <>
            <Button variant="secondary" onClick={() => setLogoutOpen(false)}>
              {T.logoutCancel}
            </Button>
            <Button variant="primary" onClick={logout}>
              {T.logoutConfirm}
            </Button>
          </>
        }
      />
      <Modal open={photoSheet} onClose={() => setPhotoSheet(false)} title="Profile photo" size="sm">
        <div className="pf-photo-actions">
          {buildPhotoOptions(Boolean(photo)).map((option) => (
            <button
              key={option.key}
              type="button"
              className={`pf-photo-actions__row${option.destructive ? ' is-danger' : ''}`}
              onClick={() => onPhotoAction(option.key)}
            >
              {option.key === 'view' ? <Eye size={18} aria-hidden /> : null}
              {option.key === 'change' ? <Camera size={18} aria-hidden /> : null}
              {option.key === 'remove' ? <Trash2 size={18} aria-hidden /> : null}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </Modal>
      <Modal open={photoViewer} onClose={() => setPhotoViewer(false)} title={name} size="sm">
        {photo ? <img className="pf-photo-view" src={photo} alt={`${name} profile`} /> : null}
      </Modal>
      <Modal
        open={removeOpen}
        onClose={() => !photoBusy && setRemoveOpen(false)}
        title="Remove photo?"
        description="Your profile photo will be removed."
        dismissible={!photoBusy}
        footer={
          <>
            <Button variant="secondary" disabled={photoBusy} onClick={() => setRemoveOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={photoBusy} onClick={confirmRemovePhoto}>
              Remove
            </Button>
          </>
        }
      />
      <Modal
        open={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
        title={T.deleteTitle}
        description={T.deleteText}
        dismissible={!deleting}
        footer={
          <>
            <Button variant="secondary" disabled={deleting} onClick={() => setDeleteOpen(false)}>
              {T.deleteCancel}
            </Button>
            <Button variant="danger" loading={deleting} onClick={onDelete}>
              {deleting ? T.pleaseWait : T.deleteConfirm}
            </Button>
          </>
        }
      />
      <Modal
        open={deleteDone}
        onClose={finishDelete}
        title={T.deleteDoneTitle}
        description={T.deleteDoneText(retentionDays)}
        hideClose
        dismissible={false}
        footer={
          <>
            <Button variant="secondary" onClick={finishDelete}>
              {T.deleteDoneStay}
            </Button>
            <Button variant="primary" onClick={finishDelete}>
              {T.deleteDoneContinue}
            </Button>
          </>
        }
      />
    </AppShell>
  );
}
