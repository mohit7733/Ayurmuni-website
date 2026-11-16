// About page copy. Values in [square brackets] are placeholders for the business team.
export const ABOUT = {
  heroTitle: 'Root to Remedy: Your Complete Personalised Ayurvedic Ecosystem.',
  ctaConsult: 'Consult a doctor',
  ctaPrakriti: 'Discover your Prakriti',

  servicesTitle: 'Services for you',
  services: [
    {
      id: 'consult',
      title: 'Online Ayurvedic consultations',
      text: 'Talk to MD Ayurveda doctors on video, from anywhere in India. Get a diagnosis rooted in Ayurveda and a prescription made for you.',
      image: '/images/login/10.webp',
      alt: 'A person on a video call with a doctor',
    },
    {
      id: 'medicines',
      title: 'Ayurvedic medicines, delivered',
      text: 'Certified medicines and wellness products from Ayurvedic houses like Zandu, AVP, Vaidyaratnam and AIMIL, delivered across Delhi NCR. Same-day delivery in select areas.',
      image: '/images/login/delivery.webp',
      alt: 'A rider delivering an Ayurmuni parcel',
    },
    {
      id: 'prakriti',
      title: 'Prakriti and Vikriti assessments',
      text: "Understand your body type and what's currently out of balance, from gut health to metabolism, in a few minutes.",
      image: '/home/prakriti-meditation.jpg',
      alt: 'A line drawing of a person seated in meditation, framed by leaves',
      fit: 'contain',
    },
    {
      id: 'diet',
      title: 'Diet and yoga, made for your Prakriti',
      text: 'Seasonal meal plans and yoga practices designed by Ayurvedic experts and matched to your dosha and health goals.',
      image: '/images/login/11.webp',
      alt: 'A practitioner reviewing a personalised diet plan',
    },
    {
      id: 'panchakarma',
      title: 'Panchakarma, at your pace',
      text: 'Book classical therapies like Shirodhara, Abhyanga and Nasya, planned around your Prakriti and guided by a vaidya.',
      image: '/images/login/8.webp',
      alt: 'A person seated in a calm yoga posture',
    },
  ],

  orgTitle: 'Services for your organisation',
  corporateTitle: 'Corporate wellness',
  corporateText:
    'Ayurveda-led wellness programmes for teams, starting with a 90-day pilot that helps employees manage stress, sleep, energy and lifestyle health.',
  partnerTitle: 'Partner with Ayurmuni',
  partnerText:
    'We work with Ayurvedic brands, Panchakarma centres and doctors who share our standards. Write to us at [partnerships email].',
  partnerEmail: '[partnerships email]',
  partnerCta: 'Write to us',

  storyTitle: 'Our story',
  ideaTitle: 'Idea',
  ideaText:
    'Ayurveda has guided health in India for over 5,000 years, and it was always meant to be personal. Two people with the same concern can need very different care. Yet finding a qualified Ayurvedic doctor, getting a plan built for your body and knowing your medicines are genuine has never been simple. Ayurmuni was founded with one idea: make personalised Ayurveda easy to access and easy to trust.',
  todayTitle: 'Where we are today',
  todayText:
    'Ayurmuni brings MD Ayurveda doctors, certified medicines, diet, yoga and Panchakarma together on one platform. We launch in Delhi NCR in November 2026, with consultations open across India, and we are just getting started on our mission.',

  reachTitle: 'Reach out to us',
  contacts: [
    { id: 'care', label: 'For customers', value: '[care email]' },
    {
      id: 'partners',
      label: 'For partnerships and corporate wellness',
      value: '[partnerships email]',
    },
    {
      id: 'registered',
      label: 'Registered address',
      value: 'Truindya Wellness Private Limited, 3rd Floor, Tower 3A, Dlf Corporate Greens, Sector 74A, Gurugram- 122004, India.',
    },
    { id: 'corporate', label: 'Corporate address', value: '3rd Floor, Tower 3A, Dlf Corporate Greens, Sector 74A, Gurugram- 122004, India.' },
  ],
  mapQuery: 'Delhi NCR, India',
  mapTitle: 'Map of Delhi NCR, where Ayurmuni is launching',

  compliance:
    'All medicines on Ayurmuni are dispensed in compliance with the Drugs and Cosmetics Act, 1940 and the Drugs and Cosmetics Rules, 1945.',
};

export function isEmailAddress(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}
