import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Images } from '../common/images';
import { Utils } from '../common/utils';
import * as ProfileServices from '../services/profileService';
import {
  isGuestUser,
  markAsGuest,
  syncAccessFromProfile,
} from '../services/guestAuth';
import { STATIC_COPY as T } from '../content/static';
import '../design/pages/static.css';

const MIN_SPLASH_MS = 900;

export default function Splash() {
  const navigate = useNavigate();
  const navigatedRef = useRef(false);

  useEffect(() => {
    navigatedRef.current = false;
    const startedAt = Date.now();

    const finish = async (go) => {
      if (navigatedRef.current) return;
      const wait = Math.max(0, MIN_SPLASH_MS - (Date.now() - startedAt));
      if (wait) await new Promise((r) => setTimeout(r, wait));
      if (navigatedRef.current) return;
      navigatedRef.current = true;
      go();
    };

    const routeUser = async () => {
      try {
        const token = await Utils.getData('_TOKEN');
        if (!token) {
          await finish(() => navigate('/welcome', { replace: true }));
          return;
        }

        const result = await ProfileServices.user_profile();
        if (result?.status === 403 || result?.logout) {
          await finish(() => navigate('/login', { replace: true }));
          return;
        }
        if (result?.data) {
          await Utils.storeData('_USER_INFO', result.data);
        }

        if (result?.data?.is_onboarded) {
          await syncAccessFromProfile(result.data);
          await finish(() => navigate('/home', { replace: true }));
          return;
        }

        if (await isGuestUser()) {
          await finish(() => navigate('/home', { replace: true }));
          return;
        }

        const isCustomer = result?.data?.user_roles?.includes('customer');
        if (!isCustomer || result?.data?.is_skipped) {
          await markAsGuest();
          await finish(() => navigate('/home', { replace: true }));
          return;
        }

        if (!result?.data?.is_onboarded) {
          await finish(() => navigate('/assessment', { replace: true }));
          return;
        }

        await finish(() => navigate('/home', { replace: true }));
      } catch (error) {
        if (error?.response?.status === 403 || error?.status === 403) {
          await finish(() => navigate('/login', { replace: true }));
          return;
        }
        await markAsGuest();
        await finish(() => navigate('/home', { replace: true }));
      }
    };

    routeUser();
  }, [navigate]);

  return (
    <section className="sx-splash" aria-busy="true" aria-label={T.splashPrep}>
      <img className="sx-splash__leaf sx-splash__leaf--tl" src={Images.leaf1} alt="" />
      <img className="sx-splash__leaf sx-splash__leaf--br" src={Images.leaf2} alt="" />

      <div className="sx-splash__layout">
        <div>
          <p className="sx-splash__kicker">{T.splashKicker}</p>
          <h1 className="sx-splash__brand">{T.splashBrand}</h1>
          <div className="sx-splash__rule" aria-hidden />
          <p className="sx-splash__tagline">{T.splashTagline}</p>
          <div className="sx-splash__progress" aria-hidden>
            <div className="sx-splash__progress-fill" />
          </div>
          <span className="sx-splash__prep">{T.splashPrep}</span>
        </div>

        <div className="sx-splash__logo-wrap">
          <div className="sx-splash__pulse" aria-hidden />
          <div className="sx-splash__logo">
            <img src={Images.FinalLogo2} alt="Ayurmuni" />
          </div>
        </div>
      </div>
    </section>
  );
}
