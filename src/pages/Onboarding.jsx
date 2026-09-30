import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Utils } from '../common/utils';
import { EmailValidator, genderOptions } from '../common/validator';
import { showSuccessToast } from '../config/key';
import { persistProfileAndSyncAccess } from '../services/guestAuth';
import * as AuthServices from '../services/authService';
import * as ProfileService from '../services/profileService';

const emptyErrors = {
  firstName: '',
  lastName: '',
  email: '',
  gender: '',
  dob: '',
  terms: '',
};

export default function Onboarding() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const monthRef = useRef(null);
  const yearRef = useRef(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingImage, setImageLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    gender: '',
    profileImageUrl: '',
    profileImage: null,
    user: '',
  });
  const [dob, setDob] = useState({ day: '', month: '', year: '' });
  const [errors, setErrors] = useState(emptyErrors);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const user_id = await Utils.getData('_USER_ID');
        setFormData((prev) => ({ ...prev, user: user_id }));
      } catch (error) {
        console.log(error);
      }
    })();
  }, []);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/access-mode');
  };

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const clearDobError = () => {
    if (errors.dob) {
      setErrors((prev) => ({ ...prev, dob: '' }));
    }
  };

  const uploadProfileImage = async (file) => {
    if (!file) return;
    setImageLoading(true);
    try {
      const formDataImage = new FormData();
      formDataImage.append('image', file);
      formDataImage.append('dir', 'customer_avatar');

      const res = await ProfileService.UploadProfilePhoto(formDataImage);

      if (res?.success) {
        const uploadedImageUrl =
          res?.data?.profile_picture ||
          res?.data?.image ||
          res?.data?.url ||
          '';

        setFormData((prev) => ({
          ...prev,
          profileImage: file,
          profileImageUrl: uploadedImageUrl,
        }));
        setPreviewUrl(URL.createObjectURL(file));
        showSuccessToast(res?.message || 'Profile image uploaded', 'success');
        return;
      }

      showSuccessToast(res?.message || 'Upload failed', 'error');
    } catch (error) {
      console.log('PROFILE IMAGE ERROR ===>', error);
      showSuccessToast('Something went wrong', 'error');
    } finally {
      setImageLoading(false);
    }
  };

  const validateForm = () => {
    let isValid = true;
    const newErrors = { ...emptyErrors };

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
      isValid = false;
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
      isValid = false;
    }
    if (formData.email.trim() && !EmailValidator(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address';
      isValid = false;
    }
    if (!formData.gender) {
      newErrors.gender = 'Gender is required';
      isValid = false;
    }

    const day = Number(dob.day);
    const month = Number(dob.month);
    const year = Number(dob.year);

    if (!day || !month || !year) {
      newErrors.dob = 'Date of birth is required';
      isValid = false;
    } else {
      const enteredDate = new Date(year, month - 1, day);
      const today = new Date();
      const isRealDate =
        enteredDate.getFullYear() === year &&
        enteredDate.getMonth() === month - 1 &&
        enteredDate.getDate() === day;

      if (!isRealDate) {
        newErrors.dob = 'Please enter a valid date';
        isValid = false;
      } else if (enteredDate > today) {
        newErrors.dob = 'Future date is not allowed';
        isValid = false;
      } else {
        let age = today.getFullYear() - year;
        const monthDiff = today.getMonth() - (month - 1);
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) {
          age--;
        }
        if (age < 1) {
          newErrors.dob = 'Please enter a valid age';
          isValid = false;
        }
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const isFormValid = () => {
    if (!formData.firstName.trim()) return false;
    if (!formData.lastName.trim()) return false;
    if (!formData.gender) return false;

    const day = Number(dob.day);
    const month = Number(dob.month);
    const year = Number(dob.year);
    if (!day || !month || !year) return false;

    const enteredDate = new Date(year, month - 1, day);
    const today = new Date();
    const isRealDate =
      enteredDate.getFullYear() === year &&
      enteredDate.getMonth() === month - 1 &&
      enteredDate.getDate() === day;
    if (!isRealDate) return false;
    if (enteredDate > today) return false;

    let age = today.getFullYear() - year;
    const monthDiff = today.getMonth() - (month - 1);
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) {
      age--;
    }
    if (age < 1) return false;

    if (formData.email.trim() && !EmailValidator(formData.email.trim())) {
      return false;
    }
    return true;
  };

  const canProceed = useMemo(
    () => isFormValid(),
    [
      formData.firstName,
      formData.lastName,
      formData.email,
      formData.gender,
      dob.day,
      dob.month,
      dob.year,
    ],
  );

  const handleProceed = async () => {
    if (!validateForm()) return;

    try {
      setIsLoading(true);
      const send_data = {
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        email: formData.email.trim(),
        profile_picture: formData.profileImageUrl,
        gender: formData.gender,
        date_of_birth: `${dob.year}-${dob.month}-${dob.day}`,
      };

      const response = await AuthServices.onBoarding(send_data);

      if (response?.success) {
        const profilePayload = {
          ...(response?.data || {}),
          first_name: response?.data?.first_name || send_data.first_name,
          last_name: response?.data?.last_name || send_data.last_name,
          email: response?.data?.email || send_data.email,
          gender: response?.data?.gender || send_data.gender,
          is_customer_profile_created:
            response?.data?.is_customer_profile_created ??
            response?.data?.customer_created ??
            true,
          customer_created:
            response?.data?.customer_created ??
            response?.data?.is_customer_profile_created ??
            true,
        };
        await persistProfileAndSyncAccess(profilePayload);
        showSuccessToast(response?.message || 'Welcome to Ayurmuni', 'success');
        navigate('/policy-accept', {
          replace: true,
          state: {
            nextRoute: {
              name: 'AssessmentType',
              params: { form: 'all' },
            },
          },
        });
        return;
      }

      showSuccessToast(response?.message || 'Something went wrong', 'error');
    } catch (error) {
      console.log('Network Error:', error);
      showSuccessToast('Network error, please try again', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const openPolicy = (policyType) => {
    navigate('/policy-detail', {
      state: {
        policyType,
        title:
          policyType === 'terms_of_service' ? 'Terms of Use' : 'Privacy Policy',
      },
    });
  };

  return (
    <section className="onboard">
      <div className="onboard-hero">
        <button className="onboard-back" onClick={handleBack} type="button">
          ←
        </button>
        <div className="step-pill">Step 1 of 2</div>
        <h1>Welcome to Ayurmuni</h1>
        <p>
          Create your profile to unlock personalized Ayurvedic care, orders, and
          consultations.
        </p>
      </div>

      <div className="onboard-card">
        <h2>Create Account</h2>
        <p className="onboard-sub">
          Add your details below. This helps us tailor recommendations for you.
        </p>

        <button
          type="button"
          className="avatar-wrap"
          onClick={() => fileRef.current?.click()}
        >
          <div className="avatar-ring">
            {isLoadingImage ? (
              <span className="avatar-loading">…</span>
            ) : previewUrl ? (
              <img src={previewUrl} alt="" />
            ) : formData.firstName ? (
              <span className="avatar-letter">
                {formData.firstName.charAt(0).toUpperCase()}
              </span>
            ) : (
              <span className="avatar-upload">Upload Photo</span>
            )}
          </div>
          <span className="avatar-cam">📷</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => uploadProfileImage(e.target.files?.[0])}
        />

        <div className="name-row">
          <label>
            First Name <span className="req">*</span>
            <input
              placeholder="ABC"
              value={formData.firstName}
              onChange={(e) => handleFieldChange('firstName', e.target.value)}
            />
            {errors.firstName ? (
              <span className="field-error">{errors.firstName}</span>
            ) : null}
          </label>
          <label>
            Last Name <span className="req">*</span>
            <input
              placeholder="XYZ"
              value={formData.lastName}
              onChange={(e) => handleFieldChange('lastName', e.target.value)}
            />
            {errors.lastName ? (
              <span className="field-error">{errors.lastName}</span>
            ) : null}
          </label>
        </div>

        <label className="full-label">
          Email Address <span className="opt">(optional)</span>
          <input
            type="email"
            placeholder="email@gmail.com"
            value={formData.email}
            onChange={(e) => handleFieldChange('email', e.target.value)}
            autoCapitalize="none"
          />
          {errors.email ? (
            <span className="field-error">{errors.email}</span>
          ) : null}
        </label>

        <div className="full-label">
          Gender <span className="req">*</span>
          <div className="gender-row">
            {genderOptions.map((item) => (
              <button
                type="button"
                key={item.id}
                className={formData.gender === item.value ? 'on' : ''}
                onClick={() => handleFieldChange('gender', item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {errors.gender ? (
            <span className="field-error">{errors.gender}</span>
          ) : null}
        </div>

        <div className="full-label">
          Date of Birth <span className="req">*</span>
          <div className="dob-row">
            <input
              placeholder={focusedField === 'day' || dob.year === '' ? 'DD' : ''}
              value={dob.day}
              maxLength={2}
              inputMode="numeric"
              onFocus={() => {
                setFocusedField('day');
                clearDobError();
              }}
              onBlur={() => setFocusedField(null)}
              onChange={(e) => {
                clearDobError();
                const value = e.target.value.replace(/[^0-9]/g, '');
                setDob({ ...dob, day: value });
                if (value.length === 2) monthRef.current?.focus();
              }}
            />
            <input
              ref={monthRef}
              placeholder={
                focusedField === 'month' || dob.year === '' ? 'MM' : ''
              }
              value={dob.month}
              maxLength={2}
              inputMode="numeric"
              onFocus={() => {
                setFocusedField('month');
                clearDobError();
              }}
              onBlur={() => setFocusedField(null)}
              onChange={(e) => {
                clearDobError();
                const value = e.target.value.replace(/[^0-9]/g, '');
                setDob({ ...dob, month: value });
                if (value.length === 2) yearRef.current?.focus();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && dob.month.length === 0) {
                  e.preventDefault();
                }
              }}
            />
            <input
              ref={yearRef}
              className="dob-year"
              placeholder={
                focusedField === 'year' || dob.year === '' ? 'YYYY' : ''
              }
              value={dob.year}
              maxLength={4}
              inputMode="numeric"
              onFocus={() => {
                setFocusedField('year');
                clearDobError();
              }}
              onBlur={() => setFocusedField(null)}
              onChange={(e) => {
                clearDobError();
                const value = e.target.value.replace(/[^0-9]/g, '');
                setDob({ ...dob, year: value });
              }}
            />
          </div>
          {errors.dob ? <span className="field-error">{errors.dob}</span> : null}
        </div>

        <p className="onboard-terms">
          After creating your profile you will review and accept our{' '}
          <button type="button" onClick={() => openPolicy('terms_of_service')}>
            Terms of Use
          </button>{' '}
          and{' '}
          <button type="button" onClick={() => openPolicy('privacy_policy')}>
            Privacy Policy
          </button>
          .
        </p>
      </div>

      <div className="onboard-bottom">
        <button
          className="cta"
          disabled={!canProceed || isLoading}
          onClick={handleProceed}
        >
          {isLoading ? 'Please wait…' : 'Proceed'}
        </button>
      </div>
    </section>
  );
}
