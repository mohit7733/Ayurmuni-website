/** Dummy marketing data — Tata 1mg–style lab & packages (not wired to APIs). */

export const DUMMY_CONSULT_PACKAGES = [
  {
    id: 'pkg-doctor-consult',
    name: 'AyurMuni Doctor Consult',
    price: 999,
    mrp: 1499,
    group: 'AyurMuni Consult',
    badge: 'BESTSELLER',
    image:
      'https://i.pinimg.com/736x/94/ae/41/94ae41e6651193f6ce748c228e2272bb.jpg',
    includes: [
      '1 Doctor Consultation',
      'Prakriti Assessment',
      'Personalised Ayurvedic guidance',
      "Generic Diet & Lifestyle Do's / Don'ts",
      '3-day doctor check-in',
    ],
  },
  {
    id: 'pkg-consult-diet',
    name: 'AyurMuni Consult + Basic Diet',
    price: 1899,
    mrp: 2499,
    group: 'AyurMuni Consult',
    badge: 'POPULAR',
    image:
      'https://i.pinimg.com/236x/c0/2b/45/c02b456b153a07509e3ee812dd20b5ce.jpg',
    includes: [
      'Doctor Consultation',
      'Prakriti Assessment',
      'Basic concern-specific diet plan',
    ],
  },
  {
    id: 'pkg-3month-care',
    name: 'AyurMuni 3-Month Care',
    price: 2499,
    mrp: 3499,
    group: 'AyurMuni Consult',
    badge: 'VALUE',
    image:
      'https://i.pinimg.com/736x/68/9b/68/689b683f53ee17cf2faaad1daa81bf33.jpg',
    includes: [
      '1 Doctor Consultation',
      '4 follow-ups over 3 months',
      'Basic disease-specific diet plan',
      'Medicine packaging & delivery',
    ],
  },
  {
    id: 'pkg-1m-plan',
    name: 'Personalised 1-Month Plan',
    price: 2999,
    mrp: 3999,
    group: 'Personalised Wellness',
    image:
      'https://i.pinimg.com/736x/66/47/6a/66476a12ae3ff4c51f99d5b1f680b365.jpg',
    includes: [
      'Prakriti Assessment',
      '1:1 Diet Consultation',
      'Calorie-specific diet plan',
      'Recipes',
      'Lifestyle recommendations',
      '1 diet follow-up after 15 days',
    ],
  },
  {
    id: 'pkg-1m-doctor-diet',
    name: 'Personalised 1-Month Doctor + Diet',
    price: 3299,
    mrp: 4499,
    group: 'Personalised Wellness',
    badge: 'COMBO',
    image:
      'https://i.pinimg.com/1200x/84/52/0a/84520a4392d12445d55ee4926d3180cd.jpg',
    includes: [
      'Prakriti Assessment',
      '1:1 Ayurvedic Doctor Consultation',
      '1:1 Diet Consultation',
      'Personalised diet plan',
      'Lifestyle recommendations',
      '1 diet follow-up after 15 days',
    ],
  },
  {
    id: 'pkg-3m-journey',
    name: 'AyurMuni 3-Month Wellness Journey',
    price: 6999,
    mrp: 8999,
    group: 'Long-Term Journey',
    image:
      'https://i.pinimg.com/1200x/db/6a/7b/db6a7b23ae0cc7d116b087d8f638be9c.jpg',
    includes: [
      '3 personalised diet consultations',
      '3 plan revisions',
      'Seasonal diet adaptation',
      'Travel & fasting guidance',
      'Condition-specific recommendations',
      'Progress monitoring',
    ],
  },
  {
    id: 'pkg-6m-journey',
    name: 'AyurMuni 6-Month Wellness Journey',
    price: 12999,
    mrp: 15999,
    group: 'Long-Term Journey',
    badge: 'FLAGSHIP',
    image:
      'https://i.pinimg.com/1200x/55/f3/88/55f3885d5d98f0320d70ff43c80f5de2.jpg',
    includes: [
      '6 personalised diet consultations',
      '6 plan revisions',
      'Seasonal adaptations',
      'Travel & fasting guidance',
      'Condition-specific recommendations',
      'Ongoing progress monitoring',
    ],
  },
];

export const DUMMY_LAB_TESTS = [
  {
    id: 'lab-essential',
    name: 'Essential Wellness',
    tests: '18 tests included',
    price: 999,
    mrp: 1499,
    tag: 'Popular',
    image:
      'https://i.pinimg.com/736x/ee/8e/f4/ee8ef4209318f635bbf36fe592fdf4c7.jpg',
  },
  {
    id: 'lab-thyroid',
    name: 'Thyroid Profile',
    tests: 'T3 · T4 · TSH',
    price: 799,
    mrp: 1199,
    tag: 'Focus',
    image:
      'https://i.pinimg.com/1200x/53/c1/a0/53c1a02c3381521cd6de3f40f1a6ac58.jpg',
  },
  {
    id: 'lab-lipid',
    name: 'Lipid Profile',
    tests: 'Cholesterol panel',
    price: 599,
    mrp: 899,
    image:
      'https://i.pinimg.com/736x/6d/8d/32/6d8d329bed10a24f3c41c2056df17534.jpg',
  },
  {
    id: 'lab-sugar',
    name: 'Blood Sugar',
    tests: 'FBS · PPBS · HbA1c',
    price: 699,
    mrp: 999,
    tag: 'Value',
    image:
      'https://i.pinimg.com/1200x/d4/51/79/d45179c05172b1b5c301bf0790f7ab60.jpg',
  },
  {
    id: 'lab-liver',
    name: 'Liver Function',
    tests: 'LFT complete',
    price: 849,
    mrp: 1299,
    image:
      'https://i.pinimg.com/736x/df/d4/8c/dfd48c77725731a6e1a59d0c8178ad8e.jpg',
  },
];

export const DUMMY_ORANGE_LAB_FEATURES = [
  {
    id: 'ol-panels',
    title: 'Curated lab panels',
    subtitle: 'Thyroid, sugar, lipids & Ayurveda-aligned panels at home',
    icon: 'flask',
  },
  {
    id: 'ol-report',
    title: 'Doctor-ready reports',
    subtitle: 'Clear summaries your vaidya can act on in the next consult',
    icon: 'report',
  },
  {
    id: 'ol-fast',
    title: 'Same-day slots',
    subtitle: 'Book morning collections with live tracking updates',
    icon: 'bolt',
  },
  {
    id: 'ol-safe',
    title: 'Trusted collection',
    subtitle: 'Trained phlebotomists and sealed sample handling',
    icon: 'shield',
  },
  {
    id: 'ol-track',
    title: 'Status timeline',
    subtitle: 'From booked → collected → reported in one place',
    icon: 'clock',
  },
  {
    id: 'ol-care',
    title: 'Care next steps',
    subtitle: 'Suggested diet, herbs & consult when results need attention',
    icon: 'heart',
  },
];

export const DUMMY_ORANGE_LAB_TESTS = DUMMY_LAB_TESTS;
