import { formatMessageTime } from './dateFormatter';

export const formatListTime = (value) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - day.getTime()) / 86400000);
  if (diff === 0) return formatMessageTime(value);
  if (diff === 1) return 'Yesterday';
  if (diff > 1 && diff < 7) return date.toLocaleDateString('en-IN', { weekday: 'short' });
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
};

export const formatConsultDate = (value) => {
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  const date = ymd ? new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])) : new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const previewText = (thread) => {
  const msg = thread.lastMessage;
  if (!msg) return thread.canSend ? 'Chat is open — say hello to your doctor' : 'No messages yet';
  const prefix = msg.sender_role === 'patient' ? 'You: ' : '';
  const text = String(msg.text || '').trim();
  if (text) return `${prefix}${text}`;
  const attachment = (msg.attachments || [])[0];
  if (attachment?.file_type === 'image') return `${prefix}📷 Photo`;
  if (attachment) return `${prefix}📎 ${attachment.file_name || 'Attachment'}`;
  return `${prefix}Message`;
};
