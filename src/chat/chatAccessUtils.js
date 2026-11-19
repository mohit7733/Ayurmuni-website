const DEFAULT_CHAT_DAYS = 3;

const startOfDay = (value) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

const parseDate = (value) => {
  if (!value) return null;
  const trimmed = String(value).trim();
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (ymd) {
    return startOfDay(new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])));
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return startOfDay(d);
};

const normalize = (value) => value?.trim().toLowerCase() ?? '';

const isWithinDefaultChatWindow = (appointmentDate, fallback) => {
  const resolvedDate = appointmentDate ?? fallback?.appointment_date ?? null;
  const apptDay = parseDate(resolvedDate);
  if (!apptDay) return false;
  const cutoff = new Date(apptDay);
  cutoff.setDate(cutoff.getDate() + DEFAULT_CHAT_DAYS);
  return startOfDay(new Date()) <= cutoff;
};

export const isFollowUpChatWindowOpen = (followUp, appointmentDate, fallback) => {
  if (!followUp) return false;
  if (followUp.date) {
    const followUpDay = parseDate(followUp.date);
    if (!followUpDay) return false;
    return followUpDay >= startOfDay(new Date());
  }
  if (followUp.schedule === true) {
    const apptDay = appointmentDate ?? fallback?.appointment_date ?? null;
    if (apptDay) return isWithinDefaultChatWindow(apptDay, fallback);
    return true;
  }
  return false;
};

/** Backend send-gate codes (communication/services/chat_service.py send_consultation_chat_message). */
export const CHAT_POLICY_ERROR_CODES = ['doctor_followup_policy_violation', 'chat_closed'];

export const isChatPolicyError = (error) => CHAT_POLICY_ERROR_CODES.includes(error?.code);

/** "message — errors.chat[0]" from a policy error body. */
export const chatPolicyErrorReason = (error) => {
  const detail = error?.errors?.chat;
  const first = Array.isArray(detail) ? detail.find(Boolean) : typeof detail === 'string' ? detail : '';
  return [error?.message, first].filter(Boolean).join(' ');
};

export function isChatSendEnabled(access) {
  if (!access || typeof access !== 'object') return false;
  // The appointment's chat_access is the only source. A missing payload must not
  // open chat from a date window or from some other active package.
  if (typeof access.can_send === 'boolean') return access.can_send;
  if (typeof access.follow_up_active === 'boolean') return access.follow_up_active;
  return false;
}

export function isChatEnabled(access, appointmentDate, fallback) {
  return isChatSendEnabled(access, appointmentDate, fallback);
}

export function isChatVisibleForAppointment(appointment) {
  return !!appointment;
}

export function getChatDisabledReason(access) {
  if (isChatSendEnabled(access)) return '';
  if (access?.closed_reason) return access.closed_reason;
  if (access?.can_send === false && access?.follow_up_active === true) {
    return 'Post-consultation chat is not available for this visit — you can still read previous messages';
  }
  if (access?.can_send === false && normalize(access?.appointment_status) === 'cancelled') {
    return 'This appointment was cancelled — you can still read previous messages';
  }
  if (!access) return 'Chat is not available for this appointment yet';
  return 'You can still read previous messages';
}

export function shouldSuppressChatError(error, messageCount = 0) {
  if (!error) return true;
  if (messageCount > 0) return true;
  const normalized = error.trim().toLowerCase();
  return (
    normalized.includes('connection') ||
    normalized.includes('network') ||
    normalized.includes('unauthorized') ||
    normalized.includes('forbidden') ||
    normalized.includes('request failed') ||
    normalized.includes('failed to load') ||
    normalized.includes('refresh') ||
    normalized.includes('offline') ||
    normalized.includes('not allowed')
  );
}

export { DEFAULT_CHAT_DAYS };
