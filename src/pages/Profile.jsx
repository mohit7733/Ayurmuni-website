import { useEffect, useMemo, useRef, useState } from 'react';
import { logoutOneSignalUser } from '../services/pushNotificationService';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Bookmark,
  CalendarCheck,
  Camera,
  ImagePlus,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  CreditCard,
  Eye,
  FileHeart,
  FileText,
  Flower2,
  Gift,
  Heart,
  HeartHandshake,
  History,
  Leaf,
  LogOut,
  MapPin,
  MessageCircle,
  MessageSquare,
  Package,
  Pencil,
  Pill,
  Settings,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Stethoscope,
  Trash2,
  UserRound,
  Users,
  Utensils,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import ProfileCamera, { wantsNativeCamera } from '../components/ProfileCamera';
import PageHeader from '../components/PageHeader';
import { Utils } from '../common/utils';
import { showSuccessToast } from '../config/key';
import {
  getAccessLevel,
  isProfileComplete,
  navigateToCompleteDetails,
  persistProfileAndSyncAccess,
  requireAuth,
  resolveAccessLikeProfile,
} from '../services/guestAuth';
import DiseaseSelectionModal from '../components/DiseaseSelectionModal';
import { getHomeCategory } from '../services/homeService';
import { getServiceCategoryId, normalizeServiceCategories } from '../home/serviceCategories';
import { diseaseIdsOf, resolveDiseaseList } from '../profile/healthConcerns';
import { update_Profile, UploadProfilePhoto } from '../services/profileService';
import useProfileDashboardStats from '../hooks/useProfileDashboardStats';
import { LOGGED_OUT_STATS, buildPhotoOptions, buildProfilePayload } from '../profile/dashboardStats';
import { useLocation as useDeliveryLocation } from '../context/LocationContext';
import { Button, Modal, SectionHold } from '../components/ui';
import { PROFILE_BOARDS, PROFILE_COPY as T, PROFILE_EXPLORE } from '../content/profile';
import '../design/pages/profile.css';

const PROFILE_ICONS = {
  activity: Activity,
  bag: ShoppingBag,
  bookmark: Bookmark,
  calendar: CalendarCheck,
  card: CreditCard,
  cart: ShoppingCart,
  chat: MessageCircle,
  diet: Utensils,
  feedback: MessageSquare,
  file: FileText,
  gift: Gift,
  heart: Heart,
  help: CircleHelp,
  history: History,
  leaf: Leaf,
  mentor: UserRound,
  package: Package,
  pill: Pill,
  pin: MapPin,
  plans: ClipboardList,
  records: FileHeart,
  settings: Settings,
  shield: Shield,
  stethoscope: Stethoscope,
  users: Users,
  yoga: Flower2,
};

function ProfileIcon({ name, size = 18 }) {
  const Icon = PROFILE_ICONS[name] || Leaf;
  return <Icon size={size} strokeWidth={1.75} aria-hidden />;
}

export default function Profile() {
  const navigate = useNavigate();
  const { clearLocationSession } = useDeliveryLocation();
  const [level, setLevel] = useState(null);
  const [user, setUser] = useState(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [photoSheet, setPhotoSheet] = useState(false);
  const [photoViewer, setPhotoViewer] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [showDiseaseModal, setShowDiseaseModal] = useState(false);
  const [medicineCategoryId, setMedicineCategoryId] = useState(null);
  const fileRef = useRef(null);
  const cameraFileRef = useRef(null);
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

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await getHomeCategory();
        if (!alive) return;
        const list = normalizeServiceCategories(res?.data ?? res);
        setMedicineCategoryId(getServiceCategoryId(list, 'medicine') || null);
      } catch {
        /* modal still works with the unscoped diseases catalog */
      }
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

  const uploadPickedFile = async (file) => {
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

  const onPickPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) await uploadPickedFile(file);
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
    else if (key === 'camera') {
      if (wantsNativeCamera()) cameraFileRef.current?.click();
      else setCameraOpen(true);
    } else if (key === 'remove') setRemoveOpen(true);
  };

  const go = (item) => {
    if (item.soon) {
      navigate(item.to);
      return;
    }
    navigate(item.to, item.state ? { state: item.state } : undefined);
  };

  const diseases = useMemo(() => resolveDiseaseList(user), [user]);
  const selectedDiseaseIds = useMemo(() => diseaseIdsOf(diseases), [diseases]);

  const openConcernsEditor = async () => {
    if (!(await requireAuth('Sign in to update your health concerns'))) return;
    setShowDiseaseModal(true);
  };

  const onDiseaseSaved = async (saved) => {
    setShowDiseaseModal(false);
    if (!saved) return;
    const resolved = await resolveAccessLikeProfile();
    if (resolved.profile) setUser(resolved.profile);
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
      <section className="pf-page pf-hub" aria-label={T.title}>
        <article className="pf-identity">
          <div className="pf-identity__person">
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
            <input
              ref={cameraFileRef}
              type="file"
              accept="image/*"
              capture="user"
              hidden
              onChange={onPickPhoto}
            />
            <div className="pf-identity__copy">
              <p className="pf-identity__eyebrow">Ayurmuni member</p>
              <h1>{name}</h1>
              <p className="pf-identity__meta">
                {phone ? <span>+91 {phone}</span> : null}
                {user?.email ? <span>{user.email}</span> : null}
              </p>
              <div className="pf-identity__actions">
                <Button
                  variant="secondary"
                  size="sm"
                  leadingIcon={<Pencil size={15} aria-hidden />}
                  onClick={() => navigate('/profile/edit')}
                >
                  {T.edit} Profile
                </Button>
                <button
                  type="button"
                  className="pf-identity__link"
                  onClick={() => navigate('/prakriti-profile')}
                >
                  <Leaf size={15} aria-hidden />
                  {T.viewPrakriti}
                </button>
              </div>
            </div>
          </div>

          <div className="pf-identity__stats" role="group" aria-label="Your activity">
            {(dashboardStats || LOGGED_OUT_STATS).map((stat) => (
              <button key={stat.key} type="button" className="pf-stat" onClick={() => navigate(stat.to)}>
                <strong>{stat.value}</strong>
                <small>{stat.label}</small>
              </button>
            ))}
          </div>
        </article>

        <section className="pf-concerns" aria-label="Health concerns">
          <header className="pf-concerns__head">
            <span className="pf-concerns__icon" aria-hidden>
              <HeartHandshake size={18} />
            </span>
            <h2>Health concerns</h2>
            <button type="button" className="pf-concerns__edit" onClick={openConcernsEditor}>
              <Pencil size={14} aria-hidden />
              {diseases.length ? 'Edit' : 'Add'}
            </button>
          </header>
          <div className="pf-concerns__body">
            {diseases.length ? (
              <ul className="pf-concerns__chips">
                {diseases.map((item) => (
                  <li key={item.id}>
                    <span className="pf-concerns__chip">{item.name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pf-concerns__empty">Add concerns to personalize care</p>
            )}
          </div>
        </section>

        <DiseaseSelectionModal
          visible={showDiseaseModal}
          serviceCategoryId={medicineCategoryId}
          initialSelectedIds={selectedDiseaseIds}
          isEditMode={diseases.length > 0}
          title={diseases.length ? 'Update health concerns' : 'Personalize your Ayurmuni'}
          subtitle={
            diseases.length
              ? 'Personalize doctors, diet & products'
              : 'Tell us your health concerns'
          }
          onDone={onDiseaseSaved}
        />

        <section className="pf-block" aria-label={T.exploreLabel}>
          <header className="pf-block__head">
            <h2>Continue your care</h2>
            <p>Doctors, medicines, yoga and the plan built around your prakriti.</p>
          </header>
          <div className="pf-explore">
            {PROFILE_EXPLORE.map((item) => (
              <button
                key={item.title}
                type="button"
                className="pf-explore__card"
                onClick={() => navigate(item.to)}
              >
                <span className="pf-explore__icon">
                  <ProfileIcon name={item.icon} size={20} />
                </span>
                <strong>{item.title}</strong>
                <small>{item.subtitle}</small>
              </button>
            ))}
          </div>
        </section>

        <div className="pf-boards">
          {PROFILE_BOARDS.map((board) => (
            <section key={board.title} className="pf-board" aria-label={board.title}>
              <header className="pf-board__head">
                <h2>{board.title}</h2>
                <p>{board.hint}</p>
              </header>
              <div className="pf-menu__list">
                {board.items.map((item) => (
                  <button key={item.title} type="button" className="pf-menu__row" onClick={() => go(item)}>
                    <span className="pf-menu__icon">
                      <ProfileIcon name={item.icon} />
                    </span>
                    <span>{item.title}</span>
                    <em aria-hidden>
                      <ChevronRight size={16} />
                    </em>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="pf-foot">
          <div className="pf-foot__actions">
            <Button
              variant="secondary"
              leadingIcon={<LogOut size={18} aria-hidden />}
              onClick={() => setLogoutOpen(true)}
            >
              {T.logout}
            </Button>
          </div>
        </div>
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
      <ProfileCamera
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onPhoto={uploadPickedFile}
        onChooseFile={() => {
          setCameraOpen(false);
          fileRef.current?.click();
        }}
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
              {option.key === 'camera' ? <Camera size={18} aria-hidden /> : null}
              {option.key === 'change' ? <ImagePlus size={18} aria-hidden /> : null}
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
    </AppShell>
  );
}
