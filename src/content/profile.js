export const PROFILE_COPY = {
  title: 'Profile',
  subtitle: 'Manage your account',
  loading: 'Loading profile…',
  edit: 'Edit',
  viewPrakriti: 'View prakriti',
  logout: 'Logout',
  logoutTitle: 'Logout',
  logoutText: 'Are you sure you want to logout from Ayurmuni?',
  logoutCancel: 'No',
  logoutConfirm: 'Yes, Logout',
  deleteAccount: 'Delete Account',
  deleteTitle: 'Delete account',
  deleteText:
    'Your account will be scheduled for deletion. You can recover it with OTP during the retention period.',
  deleteCancel: 'Cancel',
  deleteConfirm: 'Delete',
  deleteDoneTitle: 'Account deleted',
  deleteDoneText: (days) => `You can recover this number within ${days} days.`,
  deleteDoneStay: 'Stay',
  deleteDoneContinue: 'Continue',
  pleaseWait: 'Please wait…',
  version: 'WEB VERSION 1.0',
  accountSection: 'Account',
  preferenceSection: 'Preference',
  exploreLabel: 'Explore',

  gateTitle: 'Profile',
  gateText: 'Log in to manage appointments, orders, and addresses.',
  logIn: 'Log in',

  guestBrand: 'AYURMUNI',
  guestTitle: 'Your wellness space awaits',
  guestText: 'Explore freely. Unlock appointments, orders, and saved addresses with a short setup.',
  unlockTitle: 'Unlock full access',
  unlockStep1: '1. Your profile — name, DOB & essentials',
  unlockStep2: '2. Prakriti assessment — personalised wellness map',
  completeDetails: 'Complete details',
  guestSignOut: 'Sign out of guest session',

  // Edit
  editTitle: 'Edit profile',
  editSubtitle: 'Name, email, and photo',
  changePhoto: 'Change photo',
  uploading: 'Uploading…',
  firstName: 'First name',
  lastName: 'Last name',
  email: 'Email',
  secondaryNumber: 'Secondary number',
  dateOfBirth: 'Date of birth',
  gender: 'Gender',
  genders: [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
  ],
  saveProfile: 'Save profile',
  saving: 'Saving…',

  // Settings
  settingsTitle: 'Settings',
  settingsSubtitle: 'Account and support',
  aboutTitle: 'About Ayurmuni',
  aboutText: 'Version 1.0 — your Ayurvedic wellness companion.',
  signOut: 'Sign out',
  settingsSections: [
    {
      title: 'Account',
      items: [
        { title: 'Edit Profile', subtitle: 'Name, email, phone number', to: '/profile/edit' },
        { title: 'Patient Details', subtitle: 'Manage family profiles', to: '/profile/patients' },
        { title: 'Saved Address', subtitle: 'Delivery locations', to: '/profile/addresses' },
        { title: 'My Rewards', subtitle: 'Coupons and referrals', to: '/profile/rewards' },
      ],
    },
    {
      title: 'Security & Privacy',
      items: [
        {
          title: 'Privacy Center',
          subtitle: 'Privacy policy and data controls',
          to: '/profile/privacy',
        },
        { title: 'Payments', subtitle: 'Saved payment methods', to: '/profile/payments' },
      ],
    },
    {
      title: 'Support',
      items: [
        { title: 'FAQ', subtitle: 'Common questions answered', to: '/profile/faq' },
        {
          title: 'Feedback & Information',
          subtitle: 'Terms, policies and licenses',
          to: '/profile/feedback',
        },
      ],
    },
  ],

  // Addresses
  addressesTitle: 'Saved address',
  addressesSubtitle: 'Delivery locations',
  add: 'Add',
  currentLocation: 'Current Location',
  currentLocationHint: 'Tap to select current location on map',
  enableLocation: 'Enable location for accurate address',
  loadingAddresses: 'Loading addresses…',
  emptyAddressesTitle: 'No saved address yet',
  emptyAddressesText: 'Add a delivery address for faster checkout.',
  addAddress: 'Add address',
  default: 'Default',
  selected: 'Selected',
  deliverHere: 'Deliver here',
  editAddress: 'Edit',
  deleteAddress: 'Delete',

  // Address form
  formAddTitle: 'Add address',
  formEditTitle: 'Edit address',
  formSubtitle: 'Used at checkout',
  pickOnMap: 'Pick on map',
  useCurrentLocation: 'Use current location',
  addressLine1: 'Address line 1',
  addressLine2: 'Address line 2',
  city: 'City',
  state: 'State',
  pincode: 'Pincode',
  pincodeLookingUp: 'looking up…',
  cityStateLockedHint: "City & state are filled from pincode / GPS and can't be edited",
  saveAddress: 'Save address',
  addressTypes: [
    { label: 'Home', value: 'home' },
    { label: 'Office', value: 'office' },
    { label: 'Other', value: 'others' },
  ],
};

export const PROFILE_ACCOUNT = [
  { title: 'My Orders', to: '/profile/orders' },
  { title: 'My Consultations', to: '/profile/appointments' },
  { title: 'Consultation History', to: '/consult/history' },
  { title: 'Medical Records', to: '/profile/records' },
  { title: 'Patient Details', to: '/profile/patients' },
  { title: 'Saved Address', to: '/profile/addresses' },
  { title: 'Favourite Doctor', to: '/profile/favourite-doctors' },
  { title: 'Wishlist', to: '/profile/wishlist' },
  { title: 'My Rewards', to: '/profile/rewards' },
  { title: 'Cart', to: '/cart' },
  { title: 'Analysis', to: '/prakriti-profile' },
  { title: 'Medical History', to: '/medical-history' },
];

export const PROFILE_PREFERENCE = [
  { title: 'Payments', to: '/profile/payments' },
  { title: 'Settings', to: '/profile/settings' },
  { title: 'Privacy Center', to: '/profile/privacy' },
  { title: 'Need help?', to: '/profile/faq' },
  { title: 'Feedback & Information', to: '/profile/feedback' },
];

export const PROFILE_EXPLORE = [
  { title: 'Doctors', subtitle: 'Browse experts', to: '/consult/doctors' },
  { title: 'Medicines', subtitle: 'Ayurvedic care', to: '/medicines' },
  { title: 'Products', subtitle: 'Wellness picks', to: '/products' },
  { title: 'Yoga', subtitle: 'Sessions', to: '/yoga' },
  { title: 'Mentor', subtitle: 'Consult a guide', to: '/mentor' },
  { title: 'Diet Plan', subtitle: 'Personalized', to: '/diet' },
  { title: 'Prakriti', subtitle: 'Know your type', to: '/prakriti-profile' },
];
