import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { user_profile, update_Profile } from '../services/profileService';
import {
  logoutOneSignalUser,
  requestNotificationPermission,
  setPushOptIn,
} from '../services/pushNotificationService';
import { ChevronRight, LogOut } from 'lucide-react';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { Utils } from '../common/utils';
import { showSuccessToast } from '../config/key';
import { useLocation as useDeliveryLocation } from '../context/LocationContext';
import { Button, Disclaimer } from '../components/ui';
import { PROFILE_COPY as T } from '../content/profile';
import '../design/pages/profile.css';

export default function Settings() {
  const navigate = useNavigate();
  const { clearLocationSession } = useDeliveryLocation();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSaving, setPushSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    user_profile()
      .then((res) => {
        if (alive) setPushEnabled(res?.data?.is_notification_enabled === true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Mirrors app Settings.persistNotificationPreference (PUT customers/profile/).
  const persistNotificationPreference = async (enabled) => {
    const response = await update_Profile({ is_notification_enabled: enabled });
    if (response?.success === false) {
      throw new Error(response?.message || 'Unable to update notification preference');
    }
  };

  // Mirrors app Settings.handleToggle('Push Notifications').
  const togglePush = async () => {
    if (pushSaving) return;
    const previous = pushEnabled;
    const value = !previous;
    setPushEnabled(value);
    setPushSaving(true);
    try {
      if (value) {
        const granted = await requestNotificationPermission(true);
        if (!granted) {
          setPushEnabled(false);
          await persistNotificationPreference(false);
          showSuccessToast('Notification permission is required', 'error');
          return;
        }
        await setPushOptIn(true, await Utils.getData('_USER_ID'));
        await persistNotificationPreference(true);
      } else {
        await setPushOptIn(false);
        await persistNotificationPreference(false);
      }
    } catch (error) {
      setPushEnabled(previous);
      showSuccessToast(error?.message || 'Unable to update push notifications', 'error');
    } finally {
      setPushSaving(false);
    }
  };

  const signOut = async () => {
    await clearLocationSession();
    logoutOneSignalUser();
    await Utils.clearAllData();
    showSuccessToast('Signed out successfully', 'success');
    navigate('/welcome', { replace: true });
  };

  return (
    <AppShell tab="profile">
      <section className="pf-page">
        <PageHeader title={T.settingsTitle} subtitle={T.settingsSubtitle} backTo="/profile" />

        <div className="pf-menus pf-menus--stack">
          <div className="pf-menu">
            <h3>Notifications</h3>
            <div className="pf-menu__list">
              <label className="pf-menu__row pf-toggle-row">
                <span>
                  Push Notifications
                  <small>Order, appointment and offer updates</small>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  className="pf-switch"
                  checked={pushEnabled}
                  disabled={pushSaving}
                  aria-busy={pushSaving}
                  onChange={togglePush}
                />
              </label>
            </div>
          </div>
          {T.settingsSections.map((section) => (
            <div key={section.title} className="pf-menu">
              <h3>{section.title}</h3>
              <div className="pf-menu__list">
                {section.items.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    className="pf-menu__row"
                    onClick={() => navigate(item.to, item.state ? { state: item.state } : undefined)}
                  >
                    <span>
                      {item.title}
                      <small>{item.subtitle}</small>
                    </span>
                    <em aria-hidden>
                      <ChevronRight size={18} />
                    </em>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="pf-unlock">
          <h2>{T.aboutTitle}</h2>
          <p>{T.aboutText}</p>
        </div>

        <div className="pf-foot">
          <Button
            variant="secondary"
            leadingIcon={<LogOut size={18} aria-hidden />}
            onClick={signOut}
          >
            {T.signOut}
          </Button>
        </div>

        <Disclaimer />
      </section>
    </AppShell>
  );
}
