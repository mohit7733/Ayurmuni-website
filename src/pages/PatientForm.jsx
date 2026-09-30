import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { showSuccessToast } from '../config/key';
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

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

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

  const validateForm = () => {
    if (!form.fullname.trim()) return 'Full name is required';
    if (!form.dob) return 'Date of birth is required';
    if (!form.gender) return 'Gender is required';
    if (!form.bloodG) return 'Blood group is required';
    if (!form.relation) return 'Relation is required';
    if (isSelfRelation(form.relation) && isNew) return 'Self relation cannot be selected';
    if (!isNew && !isSelfRelation(patientData?.relation) && isSelfRelation(form.relation)) {
      return 'Self relation cannot be selected';
    }
    if (!/^\d{10}$/.test(form.phonenumber)) return 'Phone number must be 10 digits';
    return null;
  };

  const save = async () => {
    if (isNew) {
      const error = validateForm();
      if (error) {
        showSuccessToast(error, 'error');
        return;
      }
    } else if (!isSelfRelation(patientData?.relation) && isSelfRelation(form.relation)) {
      showSuccessToast('Self relation cannot be selected', 'error');
      return;
    }

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
      if (res?.success === false) {
        const data = res?.data || res;
        const fieldError =
          data && typeof data === 'object'
            ? Object.entries(data)
                .filter(([, value]) => Array.isArray(value) || typeof value === 'string')
                .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
                .join('\n')
            : '';
        showSuccessToast(fieldError || res?.message || 'Unable to save patient', 'error');
        return;
      }
      showSuccessToast(isNew ? 'Patient added' : 'Patient updated', 'success');
      navigate('/profile/patients');
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
        </label>
        <label className="form-field">
          Date of birth *
          <input type="date" value={form.dob} onChange={(e) => setField('dob', e.target.value)} />
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
        </div>
        <label className="form-field">
          Height (cm)
          <input value={form.height} onChange={(e) => setField('height', e.target.value)} />
        </label>
        <label className="form-field">
          Weight (kg)
          <input value={form.weight} onChange={(e) => setField('weight', e.target.value)} />
        </label>
        <label className="form-field">
          Phone number *
          <input
            value={form.phonenumber}
            onChange={(e) => setField('phonenumber', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
          />
        </label>
        <label className="form-field">
          Email
          <input value={form.email} onChange={(e) => setField('email', e.target.value)} />
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
        </label>

        <button type="button" className="cta" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : isNew ? 'Add patient' : 'Save patient'}
        </button>
      </section>
    </AppShell>
  );
}
