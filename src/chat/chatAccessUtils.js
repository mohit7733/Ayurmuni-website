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

const isFollowUpWindowEnded = (followUp) => {
  if (!followUp?.date) return false;
  const followUpDay = parseDate(followUp.date);
  if (!followUpDay) return false;
  return followUpDay < startOfDay(new Date());
};

export function isChatSendEnabled(access, appointmentDate, fallback) {
  if (!access && !fallback) return false;

  const mergedFollowUp = {
    schedule: access?.follow_up?.schedule ?? fallback?.follow_up?.schedule,
    date: access?.follow_up?.date ?? fallback?.follow_up?.date ?? null,
    reason: access?.follow_up?.reason ?? null,
  };
  const merged = {
    call_status: access?.call_status ?? fallback?.call_status,
    appointment_status: access?.appointment_status ?? fallback?.appointment_status,
    follow_up_active: access?.follow_up_active,
    follow_up: access?.follow_up || fallback?.follow_up ? mergedFollowUp : undefined,
  };
  const callStatus = normalize(merged.call_status);
  const appointmentStatus = normalize(merged.appointment_status);
  const followUp = merged.follow_up;

  if (access?.can_send === true) return true;
  if (callStatus === 'in_progress') return true;
  if (appointmentStatus === 'confirmed' || appointmentStatus === 'in_progress') return true;
  if (merged.follow_up_active === true) return true;
  if (isFollowUpChatWindowOpen(followUp, appointmentDate ?? fallback?.appointment_date, fallback)) {
    return true;
  }

  const isCompleted = appointmentStatus === 'completed' || callStatus === 'ended';
  if (isCompleted) {
    if (followUp?.date || followUp?.schedule) return false;
    return isWithinDefaultChatWindow(appointmentDate, fallback);
  }
  return false;
}

export function isChatEnabled(access, appointmentDate, fallback) {
  return isChatSendEnabled(access, appointmentDate, fallback);
}

export function isChatVisibleForAppointment(appointment) {
  return !!appointment;
}

export function getChatDisabledReason(access, appointmentDate, fallback) {
  if (isChatSendEnabled(access, appointmentDate, fallback)) return '';
  const followUp = {
    schedule: access?.follow_up?.schedule ?? fallback?.follow_up?.schedule,
    date: access?.follow_up?.date ?? fallback?.follow_up?.date ?? null,
  };
  if (isFollowUpWindowEnded(followUp)) {
    return 'Follow-up chat period has ended — you can still read previous messages';
  }
  if (
    access?.follow_up_active === false &&
    !isFollowUpChatWindowOpen(followUp, appointmentDate ?? fallback?.appointment_date, fallback)
  ) {
    return 'Follow-up chat is inactive — you can read previous messages but cannot send new ones';
  }
  if (followUp?.schedule && !followUp.date) {
    return 'Follow-up chat is inactive — you can read previous messages but cannot send new ones';
  }
  return `Chat closed — ${DEFAULT_CHAT_DAYS}-day consultation window has ended. You can still read previous messages`;
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
