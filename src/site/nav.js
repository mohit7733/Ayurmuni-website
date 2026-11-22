export const PRIMARY_NAV = [
  { to: '/home', label: 'Home' },
  { to: '/products', label: 'Products' },
  { to: '/medicines', label: 'Medicines' },
  { to: '/consult', label: 'Consult' },
  { to: '/yoga', label: 'Yoga' },
  { to: '/diet', label: 'Diet' },
];

export const FOOTER_COLUMNS = [
  {
    title: 'Shop',
    links: [
      { to: '/medicines', label: 'Ayurvedic Medicines' },
      { to: '/products', label: 'Products' },
      {to:'/consult',label:'Shop by Health Concern'},
      {to:'/products/category?mode=both&name=Brands',label:'Featured Brands'},
      { to: '/cart', label: 'My Cart' },
      // { to: '/search', label: 'Search' },
      // { to: '/panchakarma', label: 'Panchakarma' },
      // { to: '/mentor', label: 'Mentor' },
    ],
  },
  {
    title: 'Care',
    links: [
      { to: '/consult', label: 'Consult a doctor' },
      { to: '/consult/doctors', label: 'Meet Our Doctors' },
      { to: '/assessment-prakriti', label: 'Know Your Prakriti' },
      { to: '/diet', label: 'Diet plans' },
      { to: '/packages', label: 'Care Plans & Packages' },
      { to: '/yoga', label: 'Yoga' },
      // { to: '/labs', label: 'Lab tests' }, // Health Lab disabled per Rohit
    ],
  },
  {
    title: 'Account',
    links: [
      { to: '/profile', label: 'My Profile' },
      { to: '/profile/orders', label: 'My Orders' },
      { to: '/profile/appointments', label: 'My Appointments' },
      { to: '/profile/wishlist', label: 'My Wishlist' },
      { to: '/profile/rewards', label: 'My Rewards' },
    ],
  },
  {
    title: 'Help',
    links: [
      { to: '/about', label: 'About Us' },
      { to: '/contact', label: 'Contact Us' },
      { to: '/profile/faq', label: 'FAQs' },
      // { to: '/profile/privacy', label: 'Privacy Center' },
      { to: '/profile/legal-policies', label: 'Legal Policies' },
      // { to: '/terms', label: 'Terms & Conditions' },
      // { to: '/profile/feedback', label: 'Feedback' },
    ],
  },
];

export const TAB_ITEMS = [
  { id: 'home', to: '/home', label: 'Home' },
  { id: 'products', to: '/products', label: 'Products' },
  { id: 'cart', to: '/cart', label: 'Cart' },
  { id: 'medicines', to: '/medicines', label: 'Medicines' },
  { id: 'consult', to: '/consult', label: 'Consult' },
];

export const FOOTER_LEGAL = [
  // { to: '/about', label: 'About' },
  // { to: '/contact', label: 'Contact' },
  // // { to: '/profile/privacy', label: 'Privacy' },
  // // { to: '/terms', label: 'Terms' },
  // { to: '/profile/faq', label: 'Help' },
  // { to: '/profile/legal-policies', label: 'Legal policies' },
];
