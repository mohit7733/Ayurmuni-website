import { useEffect, useState } from 'react';
import { Bell, BellOff, Mail, Package, Calendar, Heart } from 'lucide-react';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { Utils } from '../common/utils';
import { showSuccessToast } from '../config/key';
import { requireAuth } from '../services/guestAuth';
import { Disclaimer, Skeleton, SkeletonText } from '../components/ui';
// import '../design/pages/notification-settings.css';

const NOTIFICATION_TYPES = [
  {
    id: 'orders',
    label: 'Order Updates',
    description: 'Get notified about order status, shipping, and delivery',
    icon: Package,
    color: '#0D614E',
  },
  {
    id: 'appointments',
    label: 'Appointment Reminders',
    description: 'Reminders for upcoming consultations and follow-ups',
    icon: Calendar,
    color: '#1D4ED8',
  },
  {
    id: 'promotions',
    label: 'Offers & Promotions',
    description: 'Exclusive deals, discounts, and new product launches',
    icon: Heart,
    color: '#DC2626',
  },
  {
    id: 'newsletter',
    label: 'Health & Wellness Tips',
    description: 'Ayurvedic health tips, recipes, and lifestyle advice',
    icon: Mail,
    color: '#7C3AED',
  },
  {
    id: 'reminders',
    label: 'Medicine Reminders',
    description: 'Reminders to take your prescribed medicines on time',
    icon: Bell,
    color: '#EA580C',
  },
];

const STORAGE_KEY = '_NOTIFICATION_PREFERENCES';

export default function NotificationSettings() {
  const [preferences, setPreferences] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (!(await requireAuth('Please login to manage notification settings'))) return;
      await loadPreferences();
    })();
  }, []);

  const loadPreferences = async () => {
    setLoading(true);
    try {
      const stored = await Utils.getData(STORAGE_KEY);
      if (stored && typeof stored === 'object') {
        setPreferences(stored);
      } else {
        // Default: all enabled
        const defaults = {};
        NOTIFICATION_TYPES.forEach((type) => {
          defaults[type.id] = true;
        });
        setPreferences(defaults);
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
      // Set defaults on error
      const defaults = {};
      NOTIFICATION_TYPES.forEach((type) => {
        defaults[type.id] = true;
      });
      setPreferences(defaults);
    } finally {
      setLoading(false);
    }
  };

  const togglePreference = async (typeId) => {
    if (saving) return;

    const newPreferences = {
      ...preferences,
      [typeId]: !preferences[typeId],
    };

    setPreferences(newPreferences);
    setSaving(true);

    try {
      await Utils.setData(STORAGE_KEY, newPreferences);
      showSuccessToast('Notification settings updated', 'success');
    } catch (error) {
      console.error('Failed to save preferences:', error);
      // Revert on error
      setPreferences(preferences);
      showSuccessToast('Failed to update settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const enableAll = async () => {
    if (saving) return;
    setSaving(true);

    const allEnabled = {};
    NOTIFICATION_TYPES.forEach((type) => {
      allEnabled[type.id] = true;
    });

    setPreferences(allEnabled);

    try {
      await Utils.setData(STORAGE_KEY, allEnabled);
      showSuccessToast('All notifications enabled', 'success');
    } catch (error) {
      console.error('Failed to save preferences:', error);
      showSuccessToast('Failed to update settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const disableAll = async () => {
    if (saving) return;
    setSaving(true);

    const allDisabled = {};
    NOTIFICATION_TYPES.forEach((type) => {
      allDisabled[type.id] = false;
    });

    setPreferences(allDisabled);

    try {
      await Utils.setData(STORAGE_KEY, allDisabled);
      showSuccessToast('All notifications disabled', 'success');
    } catch (error) {
      console.error('Failed to save preferences:', error);
      showSuccessToast('Failed to update settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell tab="profile">
        <section className="ns-page">
          <PageHeader
            title="Notification Settings"
            subtitle="Manage your notification preferences"
            backTo="/settings"
          />
          <div className="ns-skel">
            <Skeleton style={{ height: 80, borderRadius: 'var(--am-radius-lg)' }} />
            <Skeleton style={{ height: 80, borderRadius: 'var(--am-radius-lg)' }} />
            <Skeleton style={{ height: 80, borderRadius: 'var(--am-radius-lg)' }} />
            <SkeletonText lines={2} />
          </div>
        </section>
      </AppShell>
    );
  }

  const allEnabled = NOTIFICATION_TYPES.every((type) => preferences[type.id]);
  const allDisabled = NOTIFICATION_TYPES.every((type) => !preferences[type.id]);

  return (
    <AppShell tab="profile">
      <section className="ns-page">
        <PageHeader
          title="Notification Settings"
          subtitle="Manage your notification preferences"
          backTo="/settings"
        />

        <div className="ns-quick-actions">
          <button
            type="button"
            onClick={enableAll}
            disabled={allEnabled || saving}
            className="ns-quick-action"
          >
            <Bell size={18} />
            <span>Enable All</span>
          </button>
          <button
            type="button"
            onClick={disableAll}
            disabled={allDisabled || saving}
            className="ns-quick-action ns-quick-action--danger"
          >
            <BellOff size={18} />
            <span>Disable All</span>
          </button>
        </div>

        <div className="ns-list">
          {NOTIFICATION_TYPES.map((type) => {
            const Icon = type.icon;
            const isEnabled = preferences[type.id];

            return (
              <div key={type.id} className="ns-item">
                <div className="ns-item-icon" style={{ backgroundColor: `${type.color}15`, color: type.color }}>
                  <Icon size={24} />
                </div>
                <div className="ns-item-content">
                  <h3>{type.label}</h3>
                  <p>{type.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => togglePreference(type.id)}
                  disabled={saving}
                  className={`ns-toggle ${isEnabled ? 'ns-toggle--on' : ''}`}
                  aria-label={`Toggle ${type.label}`}
                  role="switch"
                  aria-checked={isEnabled}
                >
                  <span className="ns-toggle-track">
                    <span className="ns-toggle-thumb" />
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        <div className="ns-note">
          <h4>About Notifications</h4>
          <p>
            These settings control in-app and email notifications. To manage browser push notifications,
            please check your browser settings.
          </p>
          <p>
            Important notifications regarding your orders, appointments, and account security will always be sent
            regardless of these preferences.
          </p>
        </div>

        <Disclaimer />
      </section>
    </AppShell>
  );
}
