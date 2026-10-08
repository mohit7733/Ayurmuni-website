import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import consultImg from '/images/login/10.png';
import medicineImg from '/images/login/9.png';
import deliveryImg from '/images/login/delivery.png';
import dietImg from '/images/login/14.jpg';
import yogaImg from '/images/login/8.png';
import login2Img from '/images/login/2.png';
import login11Img from '/images/login/11.png';
import login12Img from '/images/login/12.png';
import login13Img from '/images/login/13.png';
import logoImg from '/greenlogo.png';
import { Utils } from '../common/utils';
import { showSuccessToast } from '../config/key';
import MarqueeCollage from '../components/MarqueeCollage';
import * as AuthService from '../services/authService';
import { parseDeletedAccountInfo } from '../services/profileService';
import { Button, Modal } from '../components/ui';
import PolicyContent from '../components/PolicyContent';
import { AUTH_COPY as T } from '../content/auth';
import {
  getPoliciesList,
  getPolicyDocument,
  getRequiredPolicies,
  normalizePolicyContent,
} from '../services/policyService';
import '../design/pages/auth.css';
import '../design/pages/static.css';

const COLUMNS = [
  {
    id: 'left',
    direction: 'up',
    images: [consultImg, medicineImg, deliveryImg, dietImg, yogaImg],
  },
  {
    id: 'center',
    direction: 'down',
    images: [login11Img, login12Img, login13Img, login2Img, consultImg],
  },
  {
    id: 'right',
    direction: 'up',
    images: [yogaImg, dietImg, consultImg, dietImg, login11Img],
  },
];

export default function Login() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [policySheet, setPolicySheet] = useState(null);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policyError, setPolicyError] = useState(null);
  const [policyDoc, setPolicyDoc] = useState(null);

  const canSendOtp = phone.length === 10 && termsAgreed && !isLoading;

  useEffect(() => {
    const timer = setInterval(() => {
      setHeadlineIndex((prev) => (prev + 1) % T.headlines.length);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  const onChangePhone = (text) => {
    setPhone(text.replace(/[^0-9]/g, '').slice(0, 10));
  };

  const openPolicy = async (policyType) => {
    const title = policyType === 'terms_and_conditions' ? T.termsOfUse : T.privacyPolicy;
    setPolicySheet({ type: policyType, title });
    setPolicyLoading(true);
    setPolicyError(null);
    setPolicyDoc(null);
    try {
      const res = await getRequiredPolicies(policyType);
      if (res?.success === false) {
        setPolicyError(res?.message || 'Unable to load this policy right now.');
        return;
      }
      const list = getPoliciesList(res);
      const entry =
        list.find((item) => (item?.policy?.policy_type || item?.policy_type) === policyType) ||
        list[0];
      const doc = getPolicyDocument(entry);
      if (!doc) {
        setPolicyError('Unable to load this policy right now.');
        return;
      }
      setPolicyDoc({
        ...doc,
        content: normalizePolicyContent(doc?.content),
      });
    } catch (error) {
      setPolicyError(error?.message || 'Failed to load policy.');
    } finally {
      setPolicyLoading(false);
    }
  };

  const closePolicySheet = () => {
    setPolicySheet(null);
    setPolicyDoc(null);
    setPolicyError(null);
    setPolicyLoading(false);
  };

  const onLogin = async () => {
    if (phone.length !== 10) {
      showSuccessToast('Please enter a valid 10-digit mobile number', 'error');
      return;
    }
    if (!termsAgreed) {
      showSuccessToast(T.termsRequired, 'error');
      return;
    }

    setIsLoading(true);
    try {
      const fullPhone = `+91${phone}`;
      const hold = await Utils.getData('_DELETED_ACCOUNT_HOLD');
      if (hold?.phone && String(hold.phone) === fullPhone) {
        const days = Number(hold.retention_days) || 30;
        const heldAt = Number(hold.held_at) || 0;
        const msLeft = heldAt + days * 24 * 60 * 60 * 1000 - Date.now();
        if (msLeft <= 0) {
          await Utils.removeData('_DELETED_ACCOUNT_HOLD');
        }
      }

      const response = await AuthService.send_otp({ phone_number: fullPhone });
      const OTP = response?.data?.otp;
      const deletedInfo = parseDeletedAccountInfo(response);
      const isCustomer = response?.data?.user_roles?.some(
        (role) => role?.toLowerCase() === 'customer',
      );
      await Utils.storeData('_POLICY_ACCEPTED_CUSTOMER', true);

      if (deletedInfo) {
        await Utils.storeData('_DELETED_ACCOUNT_HOLD', {
          phone: fullPhone,
          retention_days: deletedInfo.retentionDays,
          held_at: Date.now(),
        });
        Utils.storeData('_OTP', OTP);
        navigate('/otp', {
          state: {
            phone,
            customer: isCustomer,
            accountDeleted: true,
            retentionDays: deletedInfo.retentionDays,
            policyAcceptedCustomer: true,
          },
        });
        return;
      }

      if (response?.success) {
        Utils.storeData('_OTP', OTP);
        showSuccessToast(response.message || 'OTP sent successfully', 'success');
        navigate('/otp', {
          state: {
            phone,
            customer: isCustomer,
            policyAcceptedCustomer: true,
          },
        });
      } else {
        const errorMessage =
          response?.data?.errors?.phone_number?.[0] ||
          response?.message ||
          'Please enter a valid mobile number';
        showSuccessToast(errorMessage, 'error');
      }
    } catch (error) {
      console.error('Send OTP Error:', error);
      showSuccessToast('Something went wrong. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="au-page au-auth au-auth--login">
      <MarqueeCollage columns={COLUMNS} logo={logoImg} hint={T.brandHint} />
      <div className="au-sheet">
        <div className="au-sheet__handle" aria-hidden />
        <div className="au-sheet__intro">
          <p className="au-kicker">{T.loginKicker}</p>
          <div>
            <h2 className="au-headline">{T.headlines[headlineIndex]}</h2>
            <div className="au-dots" aria-hidden>
              {T.headlines.map((_, i) => (
                <i key={i} className={i === headlineIndex ? 'is-on' : ''} />
              ))}
            </div>
          </div>
        </div>

        <div className="au-field">
          <label className="au-label" htmlFor="login-phone">
            {T.mobileLabel}
          </label>
          <div className={`au-phone${focused ? ' is-focus' : ''}`}>
            <div className="au-phone__code">
              <span aria-hidden>IN</span>
              <span>{T.countryCode}</span>
            </div>
            <input
              id="login-phone"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder={T.mobilePlaceholder}
              value={phone}
              onChange={(e) => onChangePhone(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              autoComplete="tel"
            />
            {phone.length === 10 ? (
              <span className="au-phone__ok" aria-hidden>
                <Check size={18} />
              </span>
            ) : null}
          </div>
        </div>

        <label className="au-terms">
          <input
            type="checkbox"
            checked={termsAgreed}
            onChange={(event) => setTermsAgreed(event.target.checked)}
          />
          <span>
            {T.termsAgree}{' '}
            <button
              type="button"
              className="au-terms__link"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openPolicy('terms_and_conditions');
              }}
            >
              {T.termsOfUse}
            </button>{' '}
            {T.and}{' '}
            <button
              type="button"
              className="au-terms__link"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openPolicy('privacy_policy');
              }}
            >
              {T.privacyPolicy}
            </button>
          </span>
        </label>

        <Button
          variant="primary"
          block
          loading={isLoading}
          disabled={!canSendOtp}
          trailingIcon={isLoading ? null : <ArrowRight size={18} aria-hidden />}
          onClick={onLogin}
        >
          {isLoading ? T.sending : T.getOtp}
        </Button>
      </div>

      <Modal
        open={Boolean(policySheet)}
        onClose={closePolicySheet}
        title={policySheet?.title || 'Policy'}
        size="lg"
        footer={
          <Button variant="primary" block onClick={closePolicySheet}>
            {T.policyGotIt}
          </Button>
        }
      >
        {policyLoading ? (
          <p className="au-note">{T.policyLoading}</p>
        ) : policyError ? (
          <div>
            <p className="au-note">{policyError}</p>
            <Button
              variant="secondary"
              onClick={() => policySheet && openPolicy(policySheet.type)}
            >
              {T.policyRetry}
            </Button>
          </div>
        ) : (
          <>
            {policyDoc?.title ? <h3 className="au-title">{policyDoc.title}</h3> : null}
            <PolicyContent content={policyDoc?.content} />
          </>
        )}
      </Modal>
    </section>
  );
}
