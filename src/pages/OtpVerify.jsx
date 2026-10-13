import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import consultImg from '/images/login/10.png';
import medicineImg from '/images/login/9.png';
import deliveryImg from '/images/login/delivery.png';
import dietImg from '/images/login/14.jpg';
import yogaImg from '/images/login/8.png';
import login11Img from '/images/login/11.png';
import login12Img from '/images/login/12.png';
import login13Img from '/images/login/13.png';
import logoImg from '/greenlogo.png';
import { Utils } from '../common/utils';
import { showSuccessToast } from '../config/key';
import MarqueeCollage from '../components/MarqueeCollage';
import * as AuthService from '../services/authService';
import * as ProfileServices from '../services/profileService';
import { acceptPolicies } from '../services/policyService';
import { isProfileComplete, markAsGuest, syncAccessFromProfile } from '../services/guestAuth';
import { parsePolicyAcceptedCustomer } from '../utils/policyUtils';
import { Button, Modal } from '../components/ui';
import { AUTH_COPY as T } from '../content/auth';
import '../design/pages/auth.css';

const OTP_LEN = 4;

const COLUMNS = [
  {
    id: 'left',
    direction: 'up',
    images: [consultImg, medicineImg, deliveryImg, consultImg, medicineImg],
  },
  {
    id: 'center',
    direction: 'down',
    images: [dietImg, yogaImg, login11Img, dietImg, yogaImg],
  },
  {
    id: 'right',
    direction: 'up',
    images: [login12Img, login13Img, deliveryImg, consultImg, yogaImg],
  },
];

export default function OtpVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = location.state || {};
  const phoneNumber = params.phone;
  const NEW_CUSTOMER = params.customer;
  const accountDeleted = params.accountDeleted === true;
  const retentionDays = params.retentionDays;

  const [otp, setOtp] = useState(['', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [notifPromptVisible, setNotifPromptVisible] = useState(false);
  const pendingRegisterOtpRef = useRef('');
  const otpInputRefs = useRef([]);

  useEffect(() => {
    if (!phoneNumber) {
      navigate('/login', { replace: true });
    }
  }, [phoneNumber, navigate]);

  const applyOtpDigits = useCallback((digits) => {
    const cleaned = String(digits).replace(/[^0-9]/g, '').slice(0, OTP_LEN);
    if (!cleaned) return;
    const next = ['', '', '', ''];
    cleaned.split('').forEach((d, i) => {
      next[i] = d;
    });
    setOtp(next);
    const focusAt = Math.min(cleaned.length, OTP_LEN - 1);
    requestAnimationFrame(() => otpInputRefs.current[focusAt]?.focus());
  }, []);

  useEffect(() => {
    (async () => {
      const storedOtp = await Utils.getData('_OTP');
      if (storedOtp) applyOtpDigits(String(storedOtp));
    })();
  }, [applyOtpDigits]);

  useEffect(() => {
    if (resendTimer <= 0) return undefined;
    const timer = setTimeout(() => setResendTimer((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendTimer]);

  const handleOTPChange = (text, index) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length > 1) {
      applyOtpDigits(cleaned);
      return;
    }
    const next = [...otp];
    next[index] = cleaned.slice(-1);
    setOtp(next);
    if (cleaned && index < OTP_LEN - 1) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (event, index) => {
    if (event.key !== 'Backspace') return;
    if (otp[index]) {
      const next = [...otp];
      next[index] = '';
      setOtp(next);
      return;
    }
    if (index > 0) {
      const next = [...otp];
      next[index - 1] = '';
      setOtp(next);
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const requestWebNotification = async () => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  };

  const recordPolicyAcceptance = async () => {
    try {
      await acceptPolicies({ type: 'all' });
      await Utils.storeData('_POLICY_ACCEPTED_CUSTOMER', true);
    } catch {
      try {
        await Utils.storeData('_POLICY_ACCEPTED_CUSTOMER', true);
      } catch {
        // Acceptance is still recorded locally when the request fails.
      }
    }
  };

  const goAfterProfile = async (profile) => {
    const level = await syncAccessFromProfile(profile);
    if (level === 'full' || isProfileComplete(profile)) {
      navigate('/home', { replace: true });
      return;
    }
    await markAsGuest();
    navigate('/access-mode', { replace: true });
  };

  const submitRegisterWithNotificationPreference = async (isNotificationEnabled) => {
    const otpCode = pendingRegisterOtpRef.current || otp.join('');
    if (otpCode.length !== 4) {
      showSuccessToast('Please enter valid OTP', 'error');
      return;
    }

    setNotifPromptVisible(false);
    setIsLoading(true);
    try {
      const send_data = {
        phone_number: `+91${phoneNumber}`,
        otp: otpCode,
        is_notification_enabled: isNotificationEnabled,
      };
      const response = await AuthService.verify_otp(send_data);

      if (response?.success) {
        const userId = response?.data?.user_id;
        const accessToken = response?.data?.access;
        const refreshToken = response?.data?.refresh;

        if (!userId) {
          showSuccessToast('User information not received. Please try again.', 'error');
          return;
        }
        if (!accessToken) {
          showSuccessToast('Authentication token not received.', 'error');
          return;
        }

        await Utils.storeData('_USER_ID', String(userId));
        await Utils.storeData('_TOKEN', accessToken);
        if (refreshToken) {
          await Utils.storeData('_REFRESH_TOKEN', refreshToken);
        }

        await markAsGuest();
        showSuccessToast(response?.message || 'OTP verified successfully', 'success');
        try {
          const profileRes = await ProfileServices.user_profile();
          if (profileRes?.data) {
            await Utils.storeData('_USER_INFO', profileRes.data);
          }
          await recordPolicyAcceptance();
          await goAfterProfile(profileRes?.data);
        } catch {
          await recordPolicyAcceptance();
          await markAsGuest();
          navigate('/access-mode', { replace: true });
        }
      } else {
        showSuccessToast(response?.message || 'Failed to verify OTP', 'error');
      }
    } catch (error) {
      showSuccessToast(error?.message || 'Something went wrong. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const finishLoginSession = async (response) => {
    showSuccessToast(response.message || 'OTP verified successfully', 'success');

    const userId = response?.data?.user_id;
    await Utils.storeData('_USER_ID', userId);
    await Utils.storeData('_TOKEN', response?.data?.access);
    if (response?.data?.refresh) {
      await Utils.storeData('_REFRESH_TOKEN', response.data.refresh);
    }

    if (userId) {
      try {
        await requestWebNotification();
      } catch {
        // Browser notification permission must not block login.
      }
    }

    const customerOnboard = response?.data?.customer;
    const loginFlags = {
      ...(typeof response?.data === 'object' ? response.data : {}),
      ...(typeof customerOnboard === 'object' ? customerOnboard : {}),
    };

    try {
      const profileRes = await ProfileServices.user_profile();
      if (profileRes?.data) {
        await Utils.storeData('_USER_INFO', profileRes.data);
      }
      await recordPolicyAcceptance();
      const mergedProfile = {
        ...loginFlags,
        ...(profileRes?.data || {}),
      };
      await goAfterProfile(mergedProfile);
    } catch {
      await recordPolicyAcceptance();
      if (isProfileComplete(loginFlags)) {
        await syncAccessFromProfile(loginFlags);
        navigate('/home', { replace: true });
      } else {
        await markAsGuest();
        navigate('/access-mode', { replace: true });
      }
    }
  };

  const LoginVerfiyOTP = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 4) {
      showSuccessToast('Please enter valid OTP', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const response = await AuthService.verify_otp_login({
        phone_number: `+91${phoneNumber}`,
        otp: otpCode,
      });

      if (response?.success) {
        await finishLoginSession(response);
      } else {
        showSuccessToast(response?.message || 'Failed to verify OTP', 'error');
      }
    } catch {
      showSuccessToast('Something went wrong. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const recoverDeletedAccount = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 4) {
      showSuccessToast('Please enter valid OTP', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const response = await ProfileServices.recoverAccount({
        phone_number: `+91${phoneNumber}`,
        otp: otpCode,
      });

      if (!response?.success) {
        showSuccessToast(response?.message || 'Unable to recover this account.', 'error');
        return;
      }

      await Utils.removeData('_DELETED_ACCOUNT_HOLD');

      if (!response?.data?.access) {
        showSuccessToast(response?.message || 'Account recovered. Sign in to continue.', 'success');
        navigate('/login', { replace: true });
        return;
      }

      await finishLoginSession(response);
    } catch {
      showSuccessToast('Something went wrong. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 4) {
      showSuccessToast('Please enter valid OTP', 'error');
      return;
    }
    pendingRegisterOtpRef.current = otpCode;
    setNotifPromptVisible(true);
  };

  const onVerify = accountDeleted
    ? recoverDeletedAccount
    : NEW_CUSTOMER
      ? LoginVerfiyOTP
      : handleVerifyOTP;
  const otpComplete = otp.join('').length === OTP_LEN;

  const onResendPress = async () => {
    if (resendTimer > 0) return;
    setResendTimer(60);
    setOtp(['', '', '', '']);
    otpInputRefs.current[0]?.focus();

    try {
      const response = await AuthService.send_otp({
        phone_number: `+91${phoneNumber}`,
      });
      Utils.storeData('_OTP', response?.data?.otp);
      const policyOk = parsePolicyAcceptedCustomer(response);
      await Utils.storeData('_POLICY_ACCEPTED_CUSTOMER', policyOk);
      if (response?.data?.otp) applyOtpDigits(String(response.data.otp));

      if (response?.success) {
        showSuccessToast('New OTP has been send to your mobile number', 'success');
      } else {
        showSuccessToast('Please Resend OTP', 'error');
      }
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <section className="au-page au-auth au-auth--otp">
      <MarqueeCollage columns={COLUMNS} logo={logoImg} hint={T.brandHint} />
      <div className="au-sheet">
        <div className="au-sheet__handle" aria-hidden />
        <p className="au-kicker">{T.otpKicker}</p>
        <h2 className="au-title">{T.otpTitle}</h2>
        {accountDeleted ? (
          <p className="au-alert" role="status">
            <strong>{T.deletedAccountTitle}</strong>
            {T.deletedAccountText(retentionDays)}
          </p>
        ) : null}
        <div className="au-phone-row">
          <span>
            {T.sentTo} <strong>+91 {phoneNumber}</strong>
          </span>
          <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
            {T.edit}
          </Button>
        </div>

        <p className="au-label">{T.otpLabel}</p>
        <div className="au-otp" role="group" aria-label={T.otpLabel}>
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                otpInputRefs.current[index] = el;
              }}
              className={digit ? 'is-filled' : ''}
              value={digit}
              onChange={(e) => handleOTPChange(e.target.value, index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              inputMode="numeric"
              maxLength={index === 0 ? OTP_LEN : 1}
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              autoFocus={index === 0}
              aria-label={`Digit ${index + 1}`}
            />
          ))}
        </div>

        <div className="au-otp-meta">
          <Button variant="ghost" size="sm" onClick={onResendPress} disabled={resendTimer > 0}>
            {resendTimer > 0 ? T.resendIn(resendTimer) : T.resendOtp}
          </Button>
        </div>

        <Button
          variant="primary"
          block
          loading={isLoading}
          disabled={!otpComplete || isLoading}
          trailingIcon={isLoading ? null : <ArrowRight size={18} aria-hidden />}
          onClick={onVerify}
        >
          {isLoading ? T.verifying : T.verifyContinue}
        </Button>
        <p className="au-secure">{T.secureNote}</p>
      </div>

      <Modal
        open={notifPromptVisible}
        onClose={() => submitRegisterWithNotificationPreference(false)}
        title={T.notifTitle}
        description={T.notifText}
        footer={
          <>
            <Button
              variant="primary"
              onClick={async () => {
                const granted = await requestWebNotification();
                await submitRegisterWithNotificationPreference(Boolean(granted));
              }}
            >
              {T.enableAlerts}
            </Button>
            <Button variant="secondary" onClick={() => submitRegisterWithNotificationPreference(false)}>
              {T.notNow}
            </Button>
          </>
        }
      />
    </section>
  );
}
