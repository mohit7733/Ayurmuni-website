import { useNavigate } from 'react-router-dom';
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

  const signOut = async () => {
    await clearLocationSession();
    await Utils.clearAllData();
    showSuccessToast('Signed out successfully', 'success');
    navigate('/welcome', { replace: true });
  };

  return (
    <AppShell tab="profile">
      <section className="pf-page">
        <PageHeader title={T.settingsTitle} subtitle={T.settingsSubtitle} backTo="/profile" />

        <div className="pf-menus pf-menus--stack">
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
