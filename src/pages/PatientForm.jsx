import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { showSuccessToast } from '../config/key';
import { Button, Modal } from '../components/ui';
import { requireAuth } from '../services/guestAuth';
import { UploadProfilePhoto } from '../services/profileService';
import { extractUploadUrl } from '../services/prescriptionService';
import {
  addPatient,
  extractPatient,
  getPatientById,
  isSelfRelation,
  updatePatientById,
} from '../services/patientService';
import '../design/pages/patient-form.css';

const GENDER_OPTIONS = [
  { label: 'Male', value: 'Male' },
  { label: 'Female', value: 'Female' },
  { label: 'Others', value: 'Others' },
];

const RELATION_OPTIONS = [
  { label: 'Spouse', value: 'Spouse' },
  { label: 'Father', value: 'Father' },
  { label: 'Mother', value: 'Mother' },
  { label: 'Child', value: 'Child' },
  { label: 'Other', value: 'Others' },
];

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\d{10}$/;
const API_FIELD_MAP = {
  first_name: 'fullname', last_name: 'fullname', dob: 'dob', gender: 'gender', blood_group: 'bloodG',
  relation: 'relation', height: 'height', weight: 'weight', phone_number: 'phonenumber', email: 'email',
  emergency_contact_name: 'contactName', emergency_contact_relation: 'emergencyRelation',
  emergency_contact_phone: 'EmergencyNO', insurance_provider: 'insurance',
  insurance_policy_number: 'policyNO', insurance_valid_thru: 'valid', profile_picture: 'profilePicture',
};

const BLOOD_GROUP_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const emptyForm = {
  fullname: '',
  dob: '',
  gender: '',
  bloodG: '',
  height: '',
  weight: '',
  phonenumber: '',
  email: '',
  relation: '',
  profilePicture: '',
  contactName: '',
  emergencyRelation: '',
  EmergencyNO: '',
  insurance: '',
  policyNO: '',
  valid: '',
};

const formatToISODate = (date) => {
  const raw = String(date || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return null;
};

const matchOption = (options, value) => {
  const needle = String(value || '').trim().toLowerCase();
  return options.find((item) => String(item.value || item).toLowerCase() === needle) || null;
};

const mapPatientToForm = (patient) => ({
  fullname: `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim(),
  dob: patient?.dob || '',
  gender: matchOption(GENDER_OPTIONS, patient?.gender)?.value || patient?.gender || '',
  bloodG: patient?.blood_group || '',
  height: String(patient?.height || ''),
  weight: String(patient?.weight || ''),
  phonenumber: patient?.phone_number || '',
  email: patient?.email || '',
  relation: matchOption(RELATION_OPTIONS, patient?.relation)?.value || patient?.relation || '',
  profilePicture: patient?.profile_picture || '',
  contactName: patient?.emergency_contact_name || '',
  emergencyRelation:
    matchOption(RELATION_OPTIONS, patient?.emergency_contact_relation)?.value ||
    patient?.emergency_contact_relation ||
    '',
  EmergencyNO: patient?.emergency_contact_phone || '',
  insurance: patient?.insurance_provider || '',
  policyNO: patient?.insurance_policy_number || '',
  valid: patient?.insurance_valid_thru || '',
});

export default function PatientForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { patientId } = useParams();
  const isNew = !patientId || patientId === 'new';
  const existing = location.state?.patient;
  const [form, setForm] = useState(existing ? mapPatientToForm(existing) : emptyForm);
  const [patientData, setPatientData] = useState(existing || null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const isSelf = isSelfRelation(form.relation);

  useEffect(() => {
    (async () => {
      if (!(await requireAuth('Please login to manage family profiles'))) return;
      if (isNew || !patientId) return;
      const res = await getPatientById(patientId);
      const patient = extractPatient(res);
      if (patient) {
        setPatientData(patient);
        setForm(mapPatientToForm(patient));
      }
    })();
  }, [isNew, patientId]);

  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [fixFields, setFixFields] = useState(null);
  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

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
      const url = extractUploadUrl(res);
      if (res?.success === false || !url) {
        showSuccessToast(res?.message || 'Unable to upload photo', 'error');
        return;
      }
      setField('profilePicture', url);
      showSuccessToast('Photo uploaded', 'success');
    } finally {
      setUploading(false);
    }
  };

  // Port of app AddEditPatientDetail getFieldErrors / API_FIELD_MAP / onSavePatient.
  const getFieldErrors = (data) => {
    const errs = {};
    const t = (v) => String(v || '').trim();
    if (!t(data.fullname)) errs.fullname = 'Full name is required';
    if (!t(data.dob)) errs.dob = 'Date of birth is required';
    else if (!ISO_DATE_RE.test(data.dob)) errs.dob = 'Use YYYY-MM-DD format';
    if (!t(data.gender)) errs.gender = 'Gender is required';
    if (!t(data.bloodG)) errs.bloodG = 'Blood group is required';
    if (!t(data.relation)) errs.relation = 'Relation is required';
    else if (isSelfRelation(data.relation) && isNew) errs.relation = 'Self relation cannot be selected';
    else if (!isNew && !isSelfRelation(patientData?.relation) && isSelfRelation(data.relation)) {
      errs.relation = 'Self relation cannot be selected';
    }
    if (!t(data.phonenumber)) errs.phonenumber = 'Phone number is required';
    else if (!PHONE_RE.test(data.phonenumber)) errs.phonenumber = 'Phone number must be 10 digits';
    if (t(data.email) && !EMAIL_RE.test(t(data.email))) errs.email = 'Enter a valid email address';
    if (t(data.height)) {
      const h = Number(data.height);
      if (!Number.isFinite(h) || h <= 0) errs.height = 'Enter a valid height';
    }
    if (t(data.weight)) {
      const w = Number(data.weight);
      if (!Number.isFinite(w) || w <= 0) errs.weight = 'Enter a valid weight';
    }
    if (t(data.EmergencyNO) && !PHONE_RE.test(data.EmergencyNO)) {
      errs.EmergencyNO = 'Emergency phone must be 10 digits';
    }
    if (t(data.valid) && !ISO_DATE_RE.test(data.valid)) errs.valid = 'Use YYYY-MM-DD format';
    return errs;
  };

  const canSubmit = (() => {
    const t = (v) => String(v || '').trim();
    if (!(t(form.fullname) && t(form.dob) && t(form.gender) && t(form.bloodG) && t(form.relation) && PHONE_RE.test(form.phonenumber))) return false;
    if (isSelfRelation(form.relation) && isNew) return false;
    if (!isNew && !isSelfRelation(patientData?.relation) && isSelfRelation(form.relation)) return false;
    return true;
  })();

  const showError = (key) => (submitted || errors[key] ? errors[key] : undefined);
  const fieldError = (k) => {
    const msg = showError(k);
    return msg ? <small className="pf-field-error" role="alert">{msg}</small> : null;
  };

  const save = async () => {
    setSubmitted(true);
    const fieldErrors = getFieldErrors(form);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    const nameParts = form.fullname.trim().split(' ');
    const payload = {
      first_name: nameParts[0] || '',
      last_name: nameParts.slice(1).join(' ') || '',
      dob: formatToISODate(form.dob),
      gender: String(form.gender || '').toLowerCase(),
      blood_group: form.bloodG,
      relation: isSelf ? 'self' : String(form.relation || '').toLowerCase(),
      height: Number(form.height) || 0,
      weight: Number(form.weight) || 0,
      phone_number: form.phonenumber,
      email: form.email,
      profile_picture: form.profilePicture,
      emergency_contact_name: form.contactName,
      emergency_contact_relation: String(form.emergencyRelation || '').toLowerCase(),
      emergency_contact_phone: form.EmergencyNO,
      insurance_provider: form.insurance,
      insurance_policy_number: form.policyNO,
      insurance_valid_thru: formatToISODate(form.valid),
    };

    setSaving(true);
    try {
      const res = isNew ? await addPatient(payload) : await updatePatientById(patientId, payload);
      const apiError = res?.success === false ? res?.data || res?.errors || res : res?.data;
      const failed =
        res?.success === false || Boolean(apiError?.error || apiError?.detail);
      if (!failed) {
        navigate(-1);
        return;
      }
      if (apiError && typeof apiError === 'object' && !apiError.message) {
        const mapped = {};
        Object.entries(apiError).forEach(([key, value]) => {
          const field = API_FIELD_MAP[key];
          if (!field) return;
          const message = Array.isArray(value) ? value.map(String).join(', ') : String(value || '').trim();
          if (!message) return;
          mapped[field] = mapped[field] ? `${mapped[field]} ${message}` : message;
        });
        if (Object.keys(mapped).length > 0) {
          setErrors((prev) => ({ ...prev, ...mapped }));
          return;
        }
        const lines = Object.entries(apiError)
          .filter(([key]) => key !== 'success')
          .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`);
        if (lines.length) {
          setFixFields(lines);
          return;
        }
      }
      showSuccessToast(apiError?.message || res?.message || 'Something went wrong', 'error');
    } catch (error) {
      showSuccessToast(error?.message || 'Something went wrong', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell tab="profile">
      <section className="catalog-page form-sheet patient-form">
        <header className="catalog-head">
          <div>
            <button type="button" className="text-back" onClick={() => navigate('/profile/patients')}>
              ← Back
            </button>
            <h1>{isNew ? 'Add patient' : 'Edit patient'}</h1>
            <p>Family profile</p>
          </div>
        </header>

        <label className="avatar-upload">
          {form.profilePicture ? <img src={form.profilePicture} alt="" /> : <span>Photo</span>}
          <input type="file" accept="image/*" onChange={onImage} hidden />
          {uploading ? 'Uploading…' : 'Change photo'}
        </label>

        <h3 className="yoga-section">Personal information</h3>
        <label className="form-field">
          Full name *
          <input value={form.fullname} onChange={(e) => setField('fullname', e.target.value)} />
          {fieldError('fullname')}
        </label>
        <label className="form-field">
          Date of birth *
          <input type="date" value={form.dob} onChange={(e) => setField('dob', e.target.value)} />
          {fieldError('dob')}
        </label>
        <div className="form-field">
          Gender *
          <div className="variant-row">
            {GENDER_OPTIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`chip ${form.gender === item.value ? 'on' : ''}`}
                onClick={() => setField('gender', item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {fieldError('gender')}
        </div>
        <div className="form-field">
          Blood group *
          <div className="diet-chips">
            {BLOOD_GROUP_OPTIONS.map((item) => (
              <button
                key={item}
                type="button"
                className={`chip ${form.bloodG === item ? 'on' : ''}`}
                onClick={() => setField('bloodG', item)}
              >
                {item}
              </button>
            ))}
          </div>
          {fieldError('bloodG')}
        </div>
        <div className="form-field">
          Relation *
          <div className="variant-row">
            {RELATION_OPTIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`chip ${form.relation === item.value ? 'on' : ''}`}
                onClick={() => setField('relation', item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {fieldError('relation')}
        </div>
        <label className="form-field">
          Height (cm)
          <input value={form.height} onChange={(e) => setField('height', e.target.value)} />
          {fieldError('height')}
        </label>
        <label className="form-field">
          Weight (kg)
          <input value={form.weight} onChange={(e) => setField('weight', e.target.value)} />
          {fieldError('weight')}
        </label>
        <label className="form-field">
          Phone number *
          <input
            value={form.phonenumber}
            onChange={(e) => setField('phonenumber', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
          />
          {fieldError('phonenumber')}
        </label>
        <label className="form-field">
          Email
          <input value={form.email} onChange={(e) => setField('email', e.target.value)} />
          {fieldError('email')}
        </label>

        <h3 className="yoga-section">Emergency contact</h3>
        <label className="form-field">
          Contact name
          <input value={form.contactName} onChange={(e) => setField('contactName', e.target.value)} />
        </label>
        <div className="form-field">
          Relation
          <div className="variant-row">
            {RELATION_OPTIONS.map((item) => (
              <button
                key={`em-${item.value}`}
                type="button"
                className={`chip ${form.emergencyRelation === item.value ? 'on' : ''}`}
                onClick={() => setField('emergencyRelation', item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <label className="form-field">
          Phone
          <input
            value={form.EmergencyNO}
            onChange={(e) => setField('EmergencyNO', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
          />
          {fieldError('EmergencyNO')}
        </label>

        <h3 className="yoga-section">Insurance</h3>
        <label className="form-field">
          Provider
          <input value={form.insurance} onChange={(e) => setField('insurance', e.target.value)} />
        </label>
        <label className="form-field">
          Policy number
          <input value={form.policyNO} onChange={(e) => setField('policyNO', e.target.value)} />
        </label>
        <label className="form-field">
          Valid thru
          <input type="date" value={form.valid} onChange={(e) => setField('valid', e.target.value)} />
          {fieldError('valid')}
        </label>

        <div className="pf-form-actions">
          <button type="button" className="ghost" disabled={saving} onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button type="button" className="cta" disabled={!canSubmit || saving} onClick={save}>
            {saving ? 'Saving…' : isNew ? 'Add Patient' : 'Update Patient'}
          </button>
        </div>

        <Modal
          open={Boolean(fixFields)}
          onClose={() => setFixFields(null)}
          title="Fix These Fields"
          description={
            <span className="pf-fix-list">
              {(fixFields || []).map((line) => (
                <span key={line}>{line}</span>
              ))}
            </span>
          }
          footer={
            <Button variant="primary" onClick={() => setFixFields(null)}>
              OK
            </Button>
          }
        />
      </section>
    </AppShell>
  );
}
