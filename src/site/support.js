/** Shared Ayurmuni support / inquiry / company contact details. */

export const SUPPORT_PHONE_DIGITS = '7042376400';
export const SUPPORT_PHONE_DISPLAY = '+91 70423 76400';
export const SUPPORT_PHONE_TEL = `tel:+91${SUPPORT_PHONE_DIGITS}`;
export const SUPPORT_WHATSAPP_URL = `https://wa.me/91${SUPPORT_PHONE_DIGITS}`;
export const SUPPORT_EMAIL = 'support@ayurmuni.com';
export const SUPPORT_EMAIL_HREF = `mailto:${SUPPORT_EMAIL}`;

export const SUPPORT_HOURS = 'Mon–Sat, 9 am–7 pm';

export const REGISTERED_OFFICE =
  'Truindya Wellness Private Limited, 3rd Floor, Tower 3A, DLF Corporate Greens, Sector 74A, Gurugram 122004, Haryana, India';

export const LEGAL_ENTITY_NAME = 'Truindya Wellness Private Limited';
export const COPYRIGHT_LINE = (year = new Date().getFullYear()) =>
  `© ${year} ${LEGAL_ENTITY_NAME}. Ayurmuni is a brand of Truindya Wellness.`;

export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.ayurmuniecosystem';
export const PLAY_STORE_BADGE = '/images/playstore.avif';

/** Only accounts that currently exist / are published. */
export const SOCIAL_LINKS = [
  {
    id: 'instagram',
    label: 'Instagram',
    href: 'https://www.instagram.com/ayurmuniofficial?igsh=NjZ1MHJ0cXVvNndo',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/company/ayurmuni',
  },
];

export const CONTACT_LEGAL_LINKS = [
  {
    id: 'terms',
    label: 'Terms of Use',
    to: '/policy-detail',
    state: { policyType: 'terms_of_service', title: 'Terms of Use' },
  },
  {
    id: 'privacy',
    label: 'Privacy Policy',
    to: '/policy-detail',
    state: { policyType: 'privacy_policy', title: 'Privacy Policy' },
  },
  {
    id: 'grievance',
    label: 'Grievance Officer',
    to: '/profile/legal-policies',
  },
];

export const EMERGENCY_DISCLAIMER =
  'Online consultations are not a substitute for emergency care. In an emergency, call 112.';
