import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { formatDoctorDisplayName } from '../consult/appointmentUtils';
import { doctorDisplayName, doctorImage } from '../consult/doctors';
import { formatRupee } from '../home/catalog';
import { showSuccessToast } from '../config/key';
import { requireAuth } from '../services/guestAuth';
import { getMedicalReceipt } from '../services/consultService';
import { formatDisplayIdHash, formatReceiptId } from '../utils/formatDisplayId';
import { saveBrowserFile } from '../utils/prescriptionDetailUtils';
import { getEmailShareUrl } from '../utils/shareUtils';
import ShareButton from '../components/ShareButton';

const formatReceiptDate = (value) => {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().split('T')[0];
};

const buildReceiptText = (receipt) => {
  const specialization = Array.isArray(receipt?.info?.doctor_specialization)
    ? receipt.info.doctor_specialization.join(', ')
    : receipt?.info?.doctor_specialization || '';
  const doctorName = receipt?.info?.doctor_name || receipt?.doctor_name || 'Doctor';
  const total = receipt?.total_amount ?? receipt?.consultation_fees ?? 0;
  return [
    'TruIndyaWellness Private Limited',
    'DIGITAL CONSULTATION RECEIPT',
    '----------------------------------------',
    `Receipt No.: ${formatDisplayIdHash('RCP', receipt?.payment_id ?? receipt?.consultation_id)}`,
    `Date: ${formatReceiptDate(receipt?.date)}`,
    `Patient: ${receipt?.patient_name || '-'}`,
    `Payment Method: ${receipt?.payment_method ?? receipt?.payment_type ?? '—'}`,
    `Doctor: ${doctorName}`,
    specialization ? `Specialization: ${specialization}` : '',
    '----------------------------------------',
    `Consultation Fee: ${formatRupee(receipt?.consultation_fees ?? 0)}`,
    `Administrative Charges: ${formatRupee(receipt?.administrative_charges ?? 0)}`,
    `Digital Report Access: ${formatRupee(receipt?.digital_report_access ?? 0)}`,
    `Total Paid: ${formatRupee(total)}`,
    '----------------------------------------',
    'THIS IS A COMPUTER GENERATED RECEIPT. NO SIGNATURE IS REQUIRED.',
  ]
    .filter(Boolean)
    .join('\n');
};

export default function MedicalReceipt() {
  const { consultationId = '' } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState(null);

  const fetchReceipt = useCallback(async () => {
    if (!consultationId) {
      showSuccessToast('Consultation id missing', 'error');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await getMedicalReceipt(consultationId);
      if (response?.success === false) {
        showSuccessToast(response?.message || 'Receipt not found', 'error');
        setReceipt(null);
      } else {
        setReceipt(response?.data ?? null);
      }
    } catch {
      showSuccessToast('Unable to load receipt', 'error');
      setReceipt(null);
    } finally {
      setLoading(false);
    }
  }, [consultationId]);

  useEffect(() => {
    (async () => {
      if (!(await requireAuth('Please login to view this receipt'))) return;
      fetchReceipt();
    })();
  }, [fetchReceipt]);

  const specialization = Array.isArray(receipt?.info?.doctor_specialization)
    ? receipt.info.doctor_specialization.join(', ')
    : receipt?.info?.doctor_specialization || '';
  const doctorName = receipt?.info?.doctor_name || receipt?.doctor_name || 'Doctor';
  const doctor = receipt?.info || { doctor_name: doctorName, doctor_image: receipt?.info?.doctor_image };

  const downloadReceipt = () => {
    if (!receipt) {
      showSuccessToast('Receipt data not loaded yet', 'error');
      return;
    }
    try {
      const fileName = `Medical_Receipt_${formatReceiptId(
        receipt?.consultation_id ?? receipt?.payment_id,
      ).replace(/[^a-zA-Z0-9._-]/g, '_')}.txt`;
      saveBrowserFile(new Blob([buildReceiptText(receipt)], { type: 'text/plain;charset=utf-8' }), fileName);
    } catch (error) {
      showSuccessToast(error?.message || 'Unable to save receipt', 'error');
    }
  };

  return (
    <AppShell tab="profile">
      <section className="catalog-page receipt-page">
        <header className="catalog-head">
          <button type="button" className="text-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <div>
            <h1>Medical Receipt</h1>
            <p>Digital consultation receipt</p>
          </div>
        </header>

        {loading ? (
          <p className="muted">Loading receipt…</p>
        ) : !receipt ? (
          <p className="empty-copy">Receipt not found</p>
        ) : (
          <>
            <article className="receipt-card">
              <div className="receipt-icon">+</div>
              <h2>TruIndyaWellness Private Limited</h2>
              <p className="receipt-sub">Digital consultation receipt</p>

              <div className="receipt-row">
                <div>
                  <small>Receipt No.</small>
                  <strong>
                    {formatDisplayIdHash('RCP', receipt?.payment_id ?? receipt?.consultation_id)}
                  </strong>
                </div>
                <div>
                  <small>Date</small>
                  <strong>{formatReceiptDate(receipt?.date)}</strong>
                </div>
              </div>
              <div className="receipt-row">
                <div>
                  <small>Patient Name</small>
                  <strong>{receipt?.patient_name || '—'}</strong>
                </div>
                <div>
                  <small>Payment Method</small>
                  <strong className="receipt-pay">
                    {receipt?.payment_method ?? receipt?.payment_type ?? '—'}
                  </strong>
                </div>
              </div>

              <hr />

              <div className="receipt-doctor">
                {doctorImage(doctor) || receipt?.info?.doctor_image ? (
                  <img src={doctorImage(doctor) || receipt.info.doctor_image} alt="" />
                ) : (
                  <span>{String(doctorName).charAt(0)}</span>
                )}
                <div>
                  <small>Consulting Doctor</small>
                  <strong>{formatDoctorDisplayName(doctorDisplayName(doctor) || doctorName)}</strong>
                  {specialization ? <p>{specialization}</p> : null}
                  {receipt?.info?.doctor_id ? (
                    <p>ID: {String(receipt.info.doctor_id).slice(0, 8)}…</p>
                  ) : null}
                </div>
              </div>

              <div className="receipt-price">
                <span>Consultation Fee</span>
                <strong>{formatRupee(receipt?.consultation_fees ?? 0)}</strong>
              </div>
              <div className="receipt-price">
                <span>Administrative Charges</span>
                <strong>{formatRupee(receipt?.administrative_charges ?? 0)}</strong>
              </div>
              <div className="receipt-price">
                <span>Digital Report Access</span>
                <strong>{formatRupee(receipt?.digital_report_access ?? 0)}</strong>
              </div>
              <hr />
              <div className="receipt-total">
                <span>Total Paid</span>
                <strong>
                  {formatRupee(receipt?.total_amount ?? receipt?.consultation_fees ?? 0)}
                </strong>
              </div>
              <p className="receipt-note">
                THIS IS A COMPUTER GENERATED RECEIPT. NO SIGNATURE IS REQUIRED.
              </p>
            </article>
            <div className="history-actions receipt-actions">
              <ShareButton
                title="Medical Receipt - Ayurmuni"
                text={buildReceiptText(receipt)}
                url={window.location.href}
                variant="soft"
                size="sm"
              />
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  window.location.href = getEmailShareUrl(
                    'Medical Receipt - Ayurmuni',
                    buildReceiptText(receipt),
                  );
                }}
              >
                Email
              </button>
              <button type="button" className="ghost" onClick={() => window.print()}>
                Print
              </button>
              <button type="button" className="cta receipt-download" onClick={downloadReceipt}>
                Download Receipt
              </button>
            </div>
          </>
        )}
      </section>
    </AppShell>
  );
}
