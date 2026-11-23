export const PRIMARY_NAV = [
  { to: '/home', label: 'Home' },
  { to: '/products', label: 'Products', feature: 'products' },
  { to: '/medicines', label: 'Medicines', feature: 'medicines' },
  { to: '/consult', label: 'Consult' },
  { to: '/yoga', label: 'Yoga', feature: 'yoga' },
  { to: '/diet', label: 'Diet', feature: 'diet' },
];

export const FOOTER_COLUMNS = [
  {
    title: 'Shop',
    links: [
      { to: '/medicines', label: 'Ayurvedic Medicines', feature: 'medicines' },
      { to: '/products', label: 'Products', feature: 'products' },
      { to: '/consult', label: 'Shop by Health Concern' },
      { to: '/products/category?mode=both&name=Brands', label: 'Featured Brands', feature: 'brands' },
      { to: '/cart', label: 'My Cart', feature: 'cart' },
      // { to: '/search', label: 'Search', feature: 'search' },
      // { to: '/panchakarma', label: 'Panchakarma', feature: 'panchakarma' },
      // { to: '/mentor', label: 'Mentor', feature: 'mentor' },
    ],
  },
  {
    title: 'Care',
    links: [
      { to: '/consult', label: 'Consult a doctor' },
      { to: '/consult/doctors', label: 'Meet Our Doctors' },
      { to: '/assessment-prakriti', label: 'Know Your Prakriti' },
      { to: '/diet', label: 'Diet plans', feature: 'diet' },
      { to: '/packages', label: 'Care Plans & Packages', feature: 'packages' },
      { to: '/yoga', label: 'Yoga', feature: 'yoga' },
      // { to: '/labs', label: 'Lab tests', feature: 'labs' }, // Health Lab disabled per Rohit
    ],
  },
  {
    title: 'Account',
    links: [
      { to: '/profile', label: 'My Profile' },
      { to: '/profile/orders', label: 'My Orders', feature: 'orders' },
      { to: '/profile/appointments', label: 'My Appointments' },
      { to: '/profile/wishlist', label: 'My Wishlist', feature: 'wishlist' },
      { to: '/profile/rewards', label: 'My Rewards', feature: 'rewards' },
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
  { id: 'products', to: '/products', label: 'Products', feature: 'products' },
  { id: 'cart', to: '/cart', label: 'Cart', feature: 'cart' },
  { id: 'medicines', to: '/medicines', label: 'Medicines', feature: 'medicines' },
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
