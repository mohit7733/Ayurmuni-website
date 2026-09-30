export const getAppointmentShareMessage = ({
  doctorName,
  patientPhone,
  date,
  time,
  status,
  hospitalName,
  consultationMode,
}) => {
  const mode = String(consultationMode || 'Video consultation').trim();
  const isVideo = /video|online|virtual/i.test(mode) || !/in[- ]?person|clinic/i.test(mode);
  const phone = String(patientPhone || '').trim();

  const lines = [
    '🏥 *Ayurmuni Appointment Confirmation*',
    '',
    `👨‍⚕️ Doctor: ${doctorName || '—'}`,
    hospitalName ? `🏥 Clinic: ${hospitalName}` : null,
    '',
    `📅 Date: ${date || '—'}`,
    `⏰ Time: ${time || '—'}`,
    `📍 Status: ${status || 'Confirmed'}`,
    mode ? `💻 Mode: ${mode}` : null,
    phone ? `📞 Patient contact: ${phone}` : null,
    '',
    '— How to join —',
    '1. Open Ayurmuni on the web or in the app.',
    '2. Go to My Appointments from Home or Profile.',
    phone
      ? `3. Sign in with the registered patient number *${phone}*.`
      : '3. Sign in with the registered patient mobile number used for this booking.',
    '4. Open this appointment and tap Join / Start consultation.',
    isVideo
      ? '5. Allow camera & microphone when prompted for your video call.'
      : '5. Follow in-app directions for your clinic visit.',
    '',
    'Thank you for choosing Ayurmuni 🌿',
    'Shared via Ayurmuni',
  ];

  return lines.filter((line) => line != null).join('\n');
};
