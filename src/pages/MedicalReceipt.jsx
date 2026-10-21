import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Download, Mail, Printer, ReceiptText, ShieldCheck } from 'lucide-react';
import AppShell from '../components/AppShell';
import ShareButton from '../components/ShareButton';
import { Button } from '../components/ui';
import {
  ActionStack,
  DetailCard,
  DetailEmpty,
  DetailLayout,
  DetailPage,
  DetailSkeleton,
  DetailTop,
  InfoGrid,
  PersonCard,
  StatusPill,
  SummaryRows,
} from '../components/detail/Detail';
import { formatDoctorDisplayName } from '../consult/appointmentUtils';
import { doctorDisplayName, doctorImage } from '../consult/doctors';
import { formatRupee } from '../home/catalog';
import { showSuccessToast } from '../config/key';
import { requireAuth } from '../services/guestAuth';
import { getMedicalReceipt } from '../services/consultService';
import { formatDisplayIdHash, formatReceiptId } from '../utils/formatDisplayId';
import { parseConsultationReceiptBreakdown } from '../utils/consultationReceiptUtils';
import { saveBrowserFile } from '../utils/prescriptionDetailUtils';
import { getEmailShareUrl } from '../utils/shareUtils';

const COMPANY = 'TruIndyaWellness Private Limited';

const formatReceiptDate = (value) => {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const specializationOf = (receipt) =>
  Array.isArray(receipt?.info?.doctor_specialization)
    ? receipt.info.doctor_specialization.join(', ')
    : receipt?.info?.doctor_specialization || '';

const receiptNumber = (receipt, breakdown) =>
  formatDisplayIdHash('RCP', breakdown.paymentId || receipt?.payment_id || receipt?.consultation_id);

const buildReceiptText = (receipt, breakdown) => {
  const specialization = specializationOf(receipt);
  const doctorName = receipt?.info?.doctor_name || receipt?.doctor_name || 'Doctor';
  const statusLabel = breakdown.paymentStatus
    ? breakdown.paymentStatus.charAt(0).toUpperCase() + breakdown.paymentStatus.slice(1)
    : '';
  const legacyAdmin = Number(receipt?.administrative_charges ?? 0);
  const legacyDigital = Number(receipt?.digital_report_access ?? 0);
  return [
    COMPANY,
    'DIGITAL CONSULTATION RECEIPT',
    '----------------------------------------',
    `Receipt No.: ${receiptNumber(receipt, breakdown)}`,
    `Date: ${formatReceiptDate(receipt?.date)}`,
    `Patient: ${receipt?.patient_name || '-'}`,
    `Payment Method: ${breakdown.paymentMethod}`,
    statusLabel ? `Payment Status: ${statusLabel}` : '',
    breakdown.bank ? `Bank: ${breakdown.bank}` : '',
    breakdown.paymentId ? `Payment ID: ${breakdown.paymentId}` : '',
    breakdown.orderId ? `Order ID: ${breakdown.orderId}` : '',
    breakdown.bankTransactionId ? `Bank Transaction ID: ${breakdown.bankTransactionId}` : '',
    `Doctor: ${doctorName}`,
    specialization ? `Specialization: ${specialization}` : '',
    '----------------------------------------',
    `Consultation Fee: ${formatRupee(breakdown.consultationFee)}`,
    breakdown.platformFee > 0 ? `Platform Fee: ${formatRupee(breakdown.platformFee)}` : '',
    breakdown.gstAmount > 0 ? `GST: ${formatRupee(breakdown.gstAmount)}` : '',
    legacyAdmin > 0 ? `Administrative Charges: ${formatRupee(legacyAdmin)}` : '',
    legacyDigital > 0 ? `Digital Report Access: ${formatRupee(legacyDigital)}` : '',
    `Total Paid: ${formatRupee(breakdown.totalPaid)}`,
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

  const specialization = specializationOf(receipt);
  const doctorName = receipt?.info?.doctor_name || receipt?.doctor_name || 'Doctor';
  const doctor = receipt?.info || { doctor_name: doctorName };
  const parsed = receipt ? parseConsultationReceiptBreakdown(receipt) : null;
  const breakdown = parsed
    ? {
        ...parsed,
        paymentMethod: /^(upi|cod|emi|nb)$/i.test(parsed.paymentMethod || '')
          ? parsed.paymentMethod.toUpperCase()
          : parsed.paymentMethod,
      }
    : null;
  const statusLabel =
    !breakdown?.paymentStatus || /^(success|captured|paid)$/i.test(breakdown.paymentStatus)
      ? 'Paid'
      : breakdown.paymentStatus.charAt(0).toUpperCase() + breakdown.paymentStatus.slice(1);
  const legacyAdmin = Number(receipt?.administrative_charges ?? 0);
  const legacyDigital = Number(receipt?.digital_report_access ?? 0);
  const receiptText = receipt && breakdown ? buildReceiptText(receipt, breakdown) : '';

  const downloadReceipt = () => {
    if (!receipt) {
      showSuccessToast('Receipt data not loaded yet', 'error');
      return;
    }
    try {
      const fileName = `Medical_Receipt_${formatReceiptId(
        receipt?.consultation_id ?? receipt?.payment_id,
      ).replace(/[^a-zA-Z0-9._-]/g, '_')}.txt`;
      saveBrowserFile(new Blob([receiptText], { type: 'text/plain;charset=utf-8' }), fileName);
    } catch (error) {
      showSuccessToast(error?.message || 'Unable to save receipt', 'error');
    }
  };

  return (
    <AppShell tab="profile">
      <DetailPage className="dx-page--print">
        <DetailTop
          backLabel="Back"
          actions={
            receipt ? (
              <ShareButton
                title="Medical Receipt - Ayurmuni"
                text={receiptText}
                url={window.location.href}
                variant="soft"
                size="sm"
              />
            ) : null
          }
        />

        {loading ? (
          <DetailSkeleton media={false} label="Loading receipt" />
        ) : !receipt ? (
          <DetailEmpty
            icon={ReceiptText}
            title="Receipt not found"
            text="This receipt isn't available yet. Receipts appear once the consultation payment is confirmed."
            action={<Button onClick={() => navigate('/profile/appointments')}>My appointments</Button>}
          />
        ) : (
          <DetailLayout
            aside={
              <>
                <DetailCard id="receipt-actions" title="Save or share" icon={Download}>
                  <ActionStack>
                    <Button leadingIcon={<Download size={16} aria-hidden />} onClick={downloadReceipt}>
                      Download receipt
                    </Button>
                    <Button
                      variant="secondary"
                      leadingIcon={<Printer size={16} aria-hidden />}
                      onClick={() => window.print()}
                    >
                      Print
                    </Button>
                    <Button
                      variant="secondary"
                      leadingIcon={<Mail size={16} aria-hidden />}
                      onClick={() => {
                        window.location.href = getEmailShareUrl('Medical Receipt - Ayurmuni', receiptText);
                      }}
                    >
                      Email
                    </Button>
                  </ActionStack>
                </DetailCard>
                <p className="dx-note">
                  <ShieldCheck size={14} aria-hidden />
                  Valid for insurance and reimbursement claims. Keep it with your prescription.
                </p>
              </>
            }
          >
            <article className="dx-doc" aria-labelledby="receipt-title">
              <header className="dx-doc__head">
                <img className="dx-doc__logo" src="/images/FinalLogo.webp" alt="" />
                <div className="dx-doc__brand">
                  <strong>{COMPANY}</strong>
                  <span>Ayurmuni · Digital consultation</span>
                </div>
                <StatusPill status={breakdown.paymentStatus || 'paid'}>{statusLabel}</StatusPill>
              </header>

              <div className="dx-doc__title">
                <p className="dx-eyebrow">Medical receipt</p>
                <h1 id="receipt-title" className="dx-title">
                  {formatRupee(breakdown.totalPaid)}
                </h1>
                <span className="dx-doc__sub">
                  {receiptNumber(receipt, breakdown)}
                  {receipt?.date ? ` · ${formatReceiptDate(receipt.date)}` : ''}
                </span>
              </div>

              <InfoGrid
                items={[
                  { label: 'Patient', value: receipt?.patient_name || '—' },
                  { label: 'Payment method', value: breakdown.paymentMethod },
                  { label: 'Bank', value: breakdown.bank },
                  { label: 'Payment ID', value: breakdown.paymentId },
                  { label: 'Order ID', value: breakdown.orderId },
                  { label: 'Bank transaction', value: breakdown.bankTransactionId },
                ]}
              />

              <div className="dx-doc__section">
                <p className="dx-doc__label">Consulting doctor</p>
                <PersonCard
                  image={doctorImage(doctor) || receipt?.info?.doctor_image}
                  name={formatDoctorDisplayName(doctorDisplayName(doctor) || doctorName)}
                  role={specialization}
                  onClick={
                    receipt?.info?.doctor_id
                      ? () => navigate(`/consult/doctors/${receipt.info.doctor_id}`)
                      : undefined
                  }
                />
              </div>

              <div className="dx-doc__section">
                <p className="dx-doc__label">Bill summary</p>
                <SummaryRows
                  rows={[
                    { label: 'Consultation fee', value: formatRupee(breakdown.consultationFee) },
                    { label: 'Platform fee', value: breakdown.platformFee > 0 ? formatRupee(breakdown.platformFee) : '' },
                    { label: 'GST', value: breakdown.gstAmount > 0 ? formatRupee(breakdown.gstAmount) : '' },
                    { label: 'Administrative charges', value: legacyAdmin > 0 ? formatRupee(legacyAdmin) : '' },
                    { label: 'Digital report access', value: legacyDigital > 0 ? formatRupee(legacyDigital) : '' },
                  ]}
                  total={{ label: 'Total paid', value: formatRupee(breakdown.totalPaid) }}
                />
              </div>

              <footer className="dx-doc__foot">
                This is a computer generated receipt. No signature is required.
              </footer>
            </article>
          </DetailLayout>
        )}
      </DetailPage>
    </AppShell>
  );
}
