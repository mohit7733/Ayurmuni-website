import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RefreshCw, Upload } from 'lucide-react';
import AppShell from '../components/AppShell';
import PageHeader from '../components/PageHeader';
import { getDoctorById } from '../services/consultService';
import {
  CONSULT_PAY_KEY,
  doctorConsultFee,
  doctorDisplayName,
  doctorExperience,
  doctorImage,
  doctorQualification,
  doctorRating,
  formatRupee,
  generateMonthDates,
  groupSlotsByTime,
  isSlotBookable,
  parseDoctor,
  pickFirstBookableSlot,
  withSlotDate,
} from '../consult/doctors';
import { formatDoctorDisplayName } from '../consult/appointmentUtils';
import { requireAuth, isAuthenticated } from '../services/guestAuth';
import { showSuccessToast } from '../config/key';
import {
  addMedicalRecord,
  formatRecordType,
  getMedicalRecords,
  listMedicalRecords,
} from '../services/patientService';
import { UploadProfilePhoto } from '../services/profileService';
import { extractUploadUrl } from '../services/prescriptionService';
import {
  Button,
  Disclaimer,
  EmptyState,
  IconButton,
  Rating,
  Skeleton,
  StepIndicator,
  Textarea,
} from '../components/ui';
import { BOOKING_COPY as T } from '../content/booking';
import '../design/pages/booking.css';

export default function DoctorSlot() {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [monthOffset, setMonthOffset] = useState(0);
  const dates = useMemo(() => generateMonthDates(monthOffset).filter((item) => !item.isDisabled), [monthOffset]);
  const [doctor, setDoctor] = useState(location.state?.doctor || location.state?.doctorDetails || null);
  const [selectedDate, setSelectedDate] = useState(dates[0]?.fullDate || '');
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [concern, setConcern] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [records, setRecords] = useState([]);
  const [selectedRecords, setSelectedRecords] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [pickedFile, setPickedFile] = useState(null);
  const [recordName, setRecordName] = useState('');
  const [recordType, setRecordType] = useState('');

  const monthLabel = useMemo(
    () =>
      new Date(new Date().getFullYear(), new Date().getMonth() + monthOffset).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      }),
    [monthOffset],
  );

  useEffect(() => {
    if (!dates.length) return;
    if (!dates.some((item) => item.fullDate === selectedDate)) {
      setSelectedDate(dates[0].fullDate);
    }
  }, [dates, selectedDate]);

  const loadRecords = useCallback(async () => {
    if (!(await isAuthenticated())) {
      setRecords([]);
      return;
    }
    const res = await getMedicalRecords();
    setRecords(listMedicalRecords(res));
  }, []);

  const loadSlots = useCallback(
    async (date, isRefresh = false) => {
      if (!doctorId || !date) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setSelectedSlot(null);
      try {
        const res = await getDoctorById(doctorId, { date });
        const data = res?.data ?? res;
        const list = (Array.isArray(data?.slots) ? data.slots : []).map((slot) => withSlotDate(slot, date));
        setSlots(list);
        const profile = parseDoctor(res);
        if (profile) {
          const { slots: _ignored, ...rest } = profile;
          setDoctor((prev) => ({ ...(prev || {}), ...rest }));
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [doctorId],
  );

  useEffect(() => {
    loadSlots(selectedDate);
  }, [loadSlots, selectedDate]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    if (loading) return;
    const first = pickFirstBookableSlot(slots, selectedDate);
    setSelectedSlot(first);
  }, [slots, selectedDate, loading]);

  const grouped = useMemo(() => groupSlotsByTime(slots, selectedDate), [slots, selectedDate]);
  const fee = doctorConsultFee(selectedSlot) || doctorConsultFee(doctor);
  const feeLabel = fee ? formatRupee(fee) : '';
  const image = doctorImage(doctor);
  const name = formatDoctorDisplayName(doctorDisplayName(doctor));
  const canContinue =
    !loading && grouped.length > 0 && selectedSlot && isSlotBookable(selectedSlot, selectedDate);
  const slotLabel = selectedSlot?.displayTime || selectedSlot?.start_time || T.pickSlot;

  const toggleRecord = (id) => {
    const key = String(id);
    setSelectedRecords((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  const pickFile = (file) => {
    if (!file) return;
    const type = file.type || '';
    const allowed =
      type.startsWith('image/') ||
      type === 'application/pdf' ||
      (!type && /\.(jpe?g|png|webp|gif|heic|pdf)$/i.test(file.name || ''));
    if (!allowed) {
      showSuccessToast('Please choose a PDF or image file', 'error');
      return;
    }
    setPickedFile(file);
    setRecordName(file.name || '');
    setRecordType('');
  };

  const closeUpload = () => {
    if (uploading) return;
    setPickedFile(null);
    setRecordName('');
    setRecordType('');
  };

  const uploadRecord = async () => {
    if (!pickedFile || !recordName.trim() || !recordType) return;
    if (!(await requireAuth('Please login to attach medical records'))) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append('image', pickedFile);
      body.append('dir', 'customer_avatar');
      const uploadResponse = await UploadProfilePhoto(body);
      const fileUrl = extractUploadUrl(uploadResponse);
      if (uploadResponse?.success === false || !fileUrl) {
        showSuccessToast(uploadResponse?.message || 'Unable to upload file', 'error');
        return;
      }
      const res = await addMedicalRecord({
        medical_record_type: recordType,
        file_type: `${pickedFile.type || ''} ${pickedFile.name || ''}`.toLowerCase().includes('pdf')
          ? 'pdf'
          : 'image',
        description: recordName.trim(),
        file_url: fileUrl,
      });
      if (res?.success === false) {
        showSuccessToast(res?.message || 'Unable to save record', 'error');
        return;
      }
      const savedId = String(res?.data?.id || res?.data?.record_id || '');
      showSuccessToast('Record uploaded', 'success');
      setPickedFile(null);
      setRecordName('');
      setRecordType('');
      await loadRecords();
      if (savedId) setSelectedRecords((prev) => [...new Set([...prev, savedId])]);
    } catch {
      showSuccessToast('Unable to upload record', 'error');
    } finally {
      setUploading(false);
    }
  };

  const goPay = async () => {
    if (!(await requireAuth('Please login to book a consultation'))) return;
    if (!selectedSlot?.id) {
      showSuccessToast('Please pick a slot', 'error');
      return;
    }
    if (!isSlotBookable(selectedSlot, selectedDate)) {
      showSuccessToast('This slot has expired. Please pick another time.', 'error');
      setSelectedSlot(null);
      return;
    }
    const payload = {
      doctor,
      slot: selectedSlot,
      date: selectedDate,
      concern,
      medical_record_ids: selectedRecords,
      medical_records: records.filter((item) => selectedRecords.includes(String(item.id))),
    };
    sessionStorage.setItem(CONSULT_PAY_KEY, JSON.stringify(payload));
    navigate(`/consult/doctors/${doctorId}/pay`, { state: payload });
  };

  return (
    <AppShell tab="consult">
      <div className="bk-page bk-slots-page">
        <PageHeader
          title={T.slotTitle}
          subtitle={name}
          backTo={doctorId ? `/consult/doctors/${doctorId}` : '/consult/doctors'}
          actions={
            <Button
              variant="ghost"
              size="sm"
              loading={refreshing}
              disabled={loading}
              onClick={() => loadSlots(selectedDate, true)}
              leadingIcon={<RefreshCw size={16} aria-hidden />}
            >
              {refreshing ? T.slotRefreshing : T.slotRefresh}
            </Button>
          }
        />

        <StepIndicator steps={T.steps} current={0} label={T.stepsLabel} />

        <div className="bk-layout">
          <div className="bk-main">
            <section className="bk-card" aria-labelledby="bk-date-title">
              <div className="bk-card__head">
                <h2 id="bk-date-title">{T.selectDate}</h2>
                <div className="bk-month">
                  <IconButton
                    label={T.prevMonth}
                    size="sm"
                    disabled={monthOffset === 0}
                    onClick={() => setMonthOffset((n) => n - 1)}
                  >
                    <ChevronLeft size={18} aria-hidden />
                  </IconButton>
                  <span className="bk-month__label">{monthLabel}</span>
                  <IconButton label={T.nextMonth} size="sm" onClick={() => setMonthOffset((n) => n + 1)}>
                    <ChevronRight size={18} aria-hidden />
                  </IconButton>
                </div>
              </div>

              <div className="bk-dates" role="listbox" aria-label={T.selectDate}>
                {dates.map((item) => (
                  <button
                    key={item.fullDate}
                    type="button"
                    role="option"
                    aria-selected={selectedDate === item.fullDate}
                    className={`bk-date${selectedDate === item.fullDate ? ' is-on' : ''}`}
                    onClick={() => setSelectedDate(item.fullDate)}
                  >
                    <small>{item.label}</small>
                    <strong>{item.day}</strong>
                  </button>
                ))}
              </div>
            </section>

            <section className="bk-card" aria-labelledby="bk-slots-title">
              <div className="bk-card__head">
                <h2 id="bk-slots-title">{T.selectSlot}</h2>
              </div>

              {loading ? (
                <div className="bk-slot-grid" aria-busy="true">
                  {Array.from({ length: 8 }, (_, i) => (
                    <Skeleton key={i} variant="rect" height={44} />
                  ))}
                  <span className="am-sr-only">{T.loadingSlots}</span>
                </div>
              ) : grouped.length === 0 ? (
                <EmptyState compact title={T.noSlots} description={T.noSlotsText} />
              ) : (
                grouped.map(([label, list]) => (
                  <div key={label} className="bk-slot-group">
                    <h3>{label}</h3>
                    <div className="bk-slot-grid" role="listbox" aria-label={label}>
                      {list.map((slot) => {
                        const bookable = isSlotBookable(slot, selectedDate);
                        const on = String(selectedSlot?.id) === String(slot.id);
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            role="option"
                            aria-selected={on}
                            disabled={!bookable}
                            className={`bk-slot${on ? ' is-on' : ''}`}
                            onClick={() => setSelectedSlot(withSlotDate(slot, selectedDate))}
                          >
                            {slot.displayTime}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </section>
          </div>

          <aside className="bk-aside">
            <div className="bk-doctor">
              <span className="bk-doctor__photo" aria-hidden={!image}>
                {image ? <img src={image} alt="" /> : <span>{name.charAt(0)}</span>}
              </span>
              <div className="bk-doctor__copy">
                {doctorRating(doctor) ? <Rating value={doctorRating(doctor)} size="sm" /> : null}
                <strong>{name}</strong>
                {doctorQualification(doctor) ? <p>{doctorQualification(doctor)}</p> : null}
                {doctorExperience(doctor) ? <small>{doctorExperience(doctor)}</small> : null}
                {feeLabel ? <p className="bk-doctor__fee">{feeLabel}</p> : null}
              </div>
            </div>

            <section className="bk-card" aria-labelledby="bk-concern-title">
              <div className="bk-card__head">
                <h2 id="bk-concern-title">{T.concernTitle}</h2>
              </div>
              <p className="bk-card__hint">{T.concernHint}</p>
              <Textarea
                aria-labelledby="bk-concern-title"
                value={concern}
                onChange={(event) => setConcern(event.target.value)}
                placeholder={T.concernPlaceholder}
                rows={4}
              />
            </section>

            <section className="bk-card" aria-labelledby="bk-records-title">
              <div className="bk-card__head">
                <h2 id="bk-records-title">{T.recordsTitle}</h2>
              </div>
              <p className="bk-card__hint">{T.recordsHint}</p>
              {records.length ? (
                <div className="bk-record-list">
                  {records.map((item) => {
                    const id = String(item.id);
                    const checked = selectedRecords.includes(id);
                    return (
                      <label key={id} className={`bk-record${checked ? ' is-on' : ''}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleRecord(id)} />
                        <span className="bk-record__copy">
                          <strong>{item.description || item.title || 'Record'}</strong>
                          <small>{formatRecordType(item.medical_record_type)}</small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="bk-card__hint">{T.noRecords}</p>
              )}
              <div className="bk-upload-row">
                <label className={`bk-upload am-btn am-btn--secondary am-btn--sm${uploading ? ' is-loading' : ''}`}>
                  <Upload size={16} aria-hidden />
                  <span className="am-btn__label">{T.takePhoto}</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={uploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      pickFile(file);
                    }}
                  />
                </label>
                <label className={`bk-upload am-btn am-btn--secondary am-btn--sm${uploading ? ' is-loading' : ''}`}>
                  <Upload size={16} aria-hidden />
                  <span className="am-btn__label">{uploading ? T.uploading : T.chooseFile}</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    disabled={uploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      pickFile(file);
                    }}
                  />
                </label>
              </div>
            </section>

            <div className="bk-aside__cta">
              <Button variant="accent" size="lg" block disabled={!canContinue} onClick={goPay}>
                {loading ? T.loadingSlots : T.continue}
              </Button>
            </div>

            <Disclaimer />
          </aside>
        </div>
      </div>

      {pickedFile ? (
        <div className="web-modal" role="dialog">
          <div className="web-modal-card">
            <h3>{T.uploadTitle}</h3>
            <p className="muted">{pickedFile.name}</p>
            <label className="form-field">
              {T.recordName} *
              <input value={recordName} onChange={(event) => setRecordName(event.target.value)} disabled={uploading} />
            </label>
            <div className="form-field">
              {T.recordType} *
              <div className="variant-row">
                <button
                  type="button"
                  className={`chip ${recordType === 'prescription' ? 'on' : ''}`}
                  disabled={uploading}
                  onClick={() => setRecordType('prescription')}
                >
                  {T.recordPrescription}
                </button>
                <button
                  type="button"
                  className={`chip ${recordType === 'lab_report' ? 'on' : ''}`}
                  disabled={uploading}
                  onClick={() => setRecordType('lab_report')}
                >
                  {T.recordLab}
                </button>
              </div>
            </div>
            <div className="detail-cta">
              <button type="button" className="ghost" onClick={closeUpload} disabled={uploading}>
                {T.uploadCancel}
              </button>
              <button
                type="button"
                className="cta"
                disabled={uploading || !recordName.trim() || !recordType}
                onClick={uploadRecord}
              >
                {uploading ? T.uploading : T.uploadSubmit}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="bk-sticky bk-slots-sticky" role="region" aria-label={T.continue}>
        <div className="bk-sticky__meta">
          <strong>{feeLabel || T.consultFee}</strong>
          <small>{slotLabel}</small>
        </div>
        <Button variant="accent" disabled={!canContinue} onClick={goPay}>
          {loading ? T.loadingSlots : T.continue}
        </Button>
      </div>
    </AppShell>
  );
}
