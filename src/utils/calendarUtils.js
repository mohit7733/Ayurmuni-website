import { buildAppointmentStartEnd, toIcsStamp } from '../consult/appointmentUtils';
import { showSuccessToast } from '../config/key';

const pad = (n) => String(n).padStart(2, '0');

const toLocalStamp = (date) =>
  `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}`;

const escapeIcsText = (value) =>
  String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');

export const buildCalendarEventTimes = (input) => {
  const range = buildAppointmentStartEnd(input.date, input.startTime, input.endTime);
  if (range) return range;
  const start = new Date();
  return {
    start,
    end: new Date(start.getTime() + (input.durationMinutes || 30) * 60 * 1000),
  };
};

export const buildIcsContent = (input) => {
  const { start, end } = buildCalendarEventTimes(input);
  const uid = `ayurmuni-${Date.now()}@ayurmuni.app`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ayurmuni//Appointment//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toIcsStamp(new Date())}`,
    `DTSTART:${toLocalStamp(start)}`,
    `DTEND:${toLocalStamp(end)}`,
    `SUMMARY:${escapeIcsText(input.title)}`,
    `DESCRIPTION:${escapeIcsText(input.description)}`,
    `LOCATION:${escapeIcsText(input.location)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
};

export const buildGoogleCalendarUrl = (input) => {
  const { start, end } = buildCalendarEventTimes(input);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.title || 'Appointment',
    dates: `${toIcsStamp(start)}/${toIcsStamp(end)}`,
    details: input.description || '',
    location: input.location || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

export const buildOutlookCalendarUrl = (input) => {
  const { start, end } = buildCalendarEventTimes(input);
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: input.title || 'Appointment',
    body: input.description || '',
    location: input.location || '',
    startdt: start.toISOString(),
    enddt: end.toISOString(),
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
};

export const openGoogleCalendar = (input) => {
  const opened = window.open(buildGoogleCalendarUrl(input), '_blank', 'noopener,noreferrer');
  if (!opened) {
    showSuccessToast('Unable to open Google Calendar', 'error');
    return false;
  }
  return true;
};

export const openOutlookCalendar = (input) => {
  const opened = window.open(buildOutlookCalendarUrl(input), '_blank', 'noopener,noreferrer');
  if (!opened) {
    showSuccessToast('Unable to open Outlook Calendar', 'error');
    return false;
  }
  return true;
};

export const shareCalendarInvite = async (input) => {
  try {
    const content = buildIcsContent(input);
    const fileName = `ayurmuni-appointment-${Date.now()}.ics`;
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const file = new File([blob], fileName, { type: 'text/calendar' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: 'Add to Calendar',
        text: input.title || 'Ayurmuni appointment',
        files: [file],
      });
      showSuccessToast('Calendar invite ready', 'success');
      return true;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    showSuccessToast('Calendar invite downloaded', 'success');
    return true;
  } catch (error) {
    if (error?.name === 'AbortError') return false;
    showSuccessToast('Unable to create calendar invite', 'error');
    return false;
  }
};

export const buildAppointmentCalendarEvent = (detail) => {
  const doctor = detail?.doctorName || 'Doctor';
  const lines = [
    `Consultation with ${doctor}`,
    detail?.specialization ? `Speciality: ${detail.specialization}` : '',
    detail?.concern ? `Concern: ${detail.concern}` : '',
    detail?.bookingId ? `Booking ID: ${detail.bookingId}` : '',
    'Booked via Ayurmuni',
  ].filter(Boolean);

  return {
    title: `Ayurmuni · ${doctor}`,
    description: lines.join('\n'),
    location: detail?.hospitalName || 'Ayurmuni Video Consultation',
    date: detail?.date || '',
    startTime: detail?.startTime,
    endTime: detail?.endTime,
    durationMinutes: 30,
  };
};
