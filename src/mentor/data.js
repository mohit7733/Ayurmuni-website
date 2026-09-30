export const MENTOR_BOOKING_KEY = 'ayurmuni_mentor_booking';

export const MENTOR = {
  name: 'Elena Vance',
  role: 'Holistic Wellness Lead',
  specialty: 'Vinyasa Specialist',
  rating: 4.9,
  reviews: 128,
  years: '12+',
  students: '1.2k',
  quote:
    'Yoga is not just a practice; it’s a dialogue between your body and your spirit.',
  bio: 'Elena focuses on fluid motion and deep rhythmic breathing to unlock mental clarity and physical vitality.',
  philosophy:
    'With over a decade of teaching across Asia and Europe, Elena Vance integrates traditional Hatha principles with contemporary Vinyasa flows. Her methodology centers on Intelligent Sequencing, ensuring each transition serves a physiological purpose while maintaining the meditative quality of the practice.',
  chips: ['Vinyasa', 'Hatha', 'Breathwork'],
  credentials: [
    { icon: '🎓', title: 'RYT 500 Certified', sub: 'Yoga Alliance International' },
    { icon: '🌿', title: 'Holistic Health', sub: 'Integrated Wellness Coach' },
  ],
};

export const MENTOR_SESSIONS = [
  { id: 1, title: 'Sun Salutation', time: 'Mon, 08:00 AM' },
  { id: 2, title: 'Vinyasa Flow', time: 'Wed, 05:30 PM' },
  { id: 3, title: 'Deep Breathwork', time: 'Fri, 07:00 AM' },
];

export const MENTOR_REVIEWS = [
  {
    id: 1,
    name: 'Rohan Sharma',
    rating: 5,
    review: 'Excellent quality! The grains are clean and cook perfectly. Highly recommended.',
  },
  {
    id: 2,
    name: 'Ankit Verma',
    rating: 4,
    review: 'Very good experience, sessions are helpful.',
  },
];

export const MENTOR_SERVICES = [
  { id: 1, title: 'Video Call', price: 1599, desc: '40-minute session' },
  { id: 2, title: 'Sanctuary Visit', price: 1999, desc: 'In-person session' },
  { id: 3, title: 'Text Consultation', price: 999, desc: 'Async support' },
];

export const MENTOR_SLOTS = [
  {
    title: 'MORNING SLOTS',
    slots: [
      { time: '09:00 AM', available: true },
      { time: '10:30 AM', available: true },
      { time: '11:15 AM', available: true },
    ],
  },
  {
    title: 'AFTERNOON SLOTS',
    slots: [
      { time: '02:00 PM', available: true },
      { time: '03:30 PM', available: true },
      { time: '04:45 PM', available: true },
    ],
  },
  {
    title: 'EVENING SLOTS',
    slots: [
      { time: '06:00 PM', available: false },
      { time: '07:30 PM', available: true },
      { time: '08:15 PM', available: false },
    ],
  },
];

export const EMI_PLANS = [
  { id: '3', title: '3 Months', monthlyAmount: 566, sub: 'No Cost EMI', recommended: true },
  { id: '6', title: '6 Months', monthlyAmount: 295, sub: '12% p.a.', recommended: true },
  { id: '9', title: '9 Months', monthlyAmount: 205, sub: '15% p.a.', recommended: false },
];

export const generateMentorDates = (daysBefore = 3, daysAfter = 10) => {
  const dates = [];
  const today = new Date();
  for (let i = -daysBefore; i <= daysAfter; i += 1) {
    const d = new Date();
    d.setDate(today.getDate() + i);
    dates.push({
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      date: d.getDate(),
      fullDate: d.toDateString(),
      isToday: i === 0,
    });
  }
  return dates;
};

export const saveMentorBooking = (payload) => {
  try {
    sessionStorage.setItem(MENTOR_BOOKING_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
};

export const loadMentorBooking = () => {
  try {
    const raw = sessionStorage.getItem(MENTOR_BOOKING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
