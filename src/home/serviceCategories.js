const SERVICE_CODE_ALIASES = {
  medicine: ['MEDI', 'MEDIC', 'MEDICINE', 'PHAR', 'AYUR', 'PHARMA'],
  products: ['PRODU', 'PROD', 'PRODUCT', 'PRODUCTS', 'STORE', 'SHOP'],
  consult: ['CONS', 'CONSULT', 'DOCT', 'DOCTOR', 'TELE'],
};

const SERVICE_NAME_ALIASES = {
  medicine: ['medicine', 'medicines', 'pharmacy', 'pharma', 'ayurvedic medicine'],
  products: ['products', 'product', 'store', 'shop'],
  consult: ['consult', 'consultation', 'doctor', 'doctors'],
};

const normalizeName = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

export const normalizeServiceCategories = (input) => {
  if (Array.isArray(input)) return input;
  if (!input || typeof input !== 'object') return [];
  if (Array.isArray(input.data)) return input.data;
  if (Array.isArray(input.results)) return input.results;
  if (Array.isArray(input.categories)) return input.categories;
  if (Array.isArray(input.service_categories)) return input.service_categories;
  const data = input.data;
  if (data && typeof data === 'object') {
    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.categories)) return data.categories;
    if (Array.isArray(data.service_categories)) return data.service_categories;
    const numericKeys = Object.keys(data)
      .filter((key) => /^\d+$/.test(key))
      .sort((a, b) => Number(a) - Number(b));
    if (numericKeys.length) return numericKeys.map((key) => data[key]).filter(Boolean);
  }
  return [];
};

const getCategoryName = (item) =>
  normalizeName(
    item?.name ?? item?.category_name ?? item?.title ?? item?.label ?? '',
  );

const getCategoryId = (item) => {
  const id = item?.id ?? item?.service_category_id ?? item?.category_id ?? null;
  return id != null && String(id).trim() !== '' ? String(id) : null;
};

export const getServiceCategoryId = (categories, key) => {
  const list = normalizeServiceCategories(categories);
  const aliases = SERVICE_NAME_ALIASES[key] || [];
  const exact = list.find((item) => aliases.includes(getCategoryName(item)));
  if (exact) return getCategoryId(exact);
  const byCode = list.find((item) => {
    const code = String(item?.service_category_code ?? item?.code ?? '')
      .trim()
      .toUpperCase();
    return (SERVICE_CODE_ALIASES[key] || []).some(
      (c) => code === c || code.startsWith(c) || code.includes(c),
    );
  });
  return byCode ? getCategoryId(byCode) : null;
};

export const resolveServiceCategoryKey = (item) => {
  if (!item) return null;
  const keys = ['consult', 'medicine', 'products'];
  for (const key of keys) {
    if (getServiceCategoryId([item], key)) return key;
  }
  const name = getCategoryName(item);
  if (name.includes('yoga')) return 'yoga';
  if (name.includes('diet')) return 'diet';
  if (name.includes('prakriti')) return 'prakriti';
  if (name.includes('care') || name.includes('package')) return 'packages';
  return null;
};

export const mapServiceCategory = (item) => ({
  ...item,
  id: String(item?.id ?? item?.service_category_id ?? ''),
  name: String(item?.name ?? item?.category_name ?? item?.title ?? ''),
  image_url: item?.image_url || item?.image || item?.icon_url || '',
  redirect_url: item?.redirect_url || item?.app_screen || '',
  sequence: Number(item?.sequence) || 0,
});

export const FALLBACK_SERVICE_CATEGORIES = [
  {
    id: '7482cb18-e204-42f4-a193-1d3ba688a942',
    name: 'Doctor',
    image_url:
      'https://ayurmuni.s3.ap-south-1.amazonaws.com/health_issues/0d48ee589cb243fa9a506d150128e450.png',
    redirect_url: 'ConsultScreen',
    sequence: 3,
  },
  {
    id: 'b993ebf7-41e0-4f23-adb5-789b6656d591',
    name: 'medicine',
    image_url:
      'https://ayurmuni.s3.ap-south-1.amazonaws.com/health_issues/48bd41734dcc460a9a070d4d041edb37.png',
    redirect_url: 'MedicineScreen',
    sequence: 5,
  },
  {
    id: '4a6cc1e8-593d-4887-98ac-cdd8e7bd9f9d',
    name: 'Care Plan',
    image_url:
      'https://ayurmuni.s3.ap-south-1.amazonaws.com/health_issues/3caa712a2fa3454c9669d1ccc9b13de6.png',
    redirect_url: 'PackagesScreen',
    sequence: 6,
  },
  {
    id: 'e81a642e-4b08-4f81-9ed7-a4a4f1b26d84',
    name: 'Diets',
    image_url:
      'https://ayurmuni.s3.ap-south-1.amazonaws.com/health_issues/f0170612cc704d78babbe826dcec9292.png',
    redirect_url: 'DietScreen',
    sequence: 7,
  },
  {
    id: 'e94a0c0e-04e5-4bb6-a976-d9cd4e1b7846',
    name: 'Products',
    image_url:
      'https://ayurmuni.s3.ap-south-1.amazonaws.com/health_issues/6480a8b1863a4b1faf9107cefe2ab9df.png',
    redirect_url: 'ProductsScreen',
    sequence: 8,
  },
  {
    id: '0c043aef-4c78-4ee8-a53e-ebb5aaf56a58',
    name: 'Yoga',
    image_url:
      'https://ayurmuni.s3.ap-south-1.amazonaws.com/health_issues/7faeb1bf278b4be8b1ac408fd7bde7e7.png',
    redirect_url: 'YogaScreen',
    sequence: 9,
  },
  {
    id: '7ec19335-a507-4b9a-9259-20e609d2cd52',
    name: 'Prakriti',
    image_url:
      'https://ayurmuni.s3.ap-south-1.amazonaws.com/health_issues/a3788cf90353430b8c5bf1cf44df8e77.png',
    redirect_url: 'PrakritiProfile',
    sequence: 21,
  },
].map(mapServiceCategory);

const WEB_ROUTES = {
  consult: '/consult',
  ConsultHistory: '/consult/history',
  AddCalendar: '/consult/add-calendar',
  CategoryDoctor: '/consult',
  DoctorSlipScreen: '/consult',
  DoctorConsultationHistory: '/consult',
  medicine: '/medicines',
  products: '/products',
  yoga: '/yoga',
  diet: '/diet',
  DoctorProfile: '/consult',
  AllDoctors: '/consult',
  ProductDetails: '/products',
  ProductsScreen: '/products',
  MedicineScreen: '/medicines',
  DietScreen: '/diet',
  WeeklyMeal: '/diet/weekly',
  YogaScreen: '/yoga',
  Mentor: '/mentor',
  ConsultMentor: '/mentor/consult',
  MentorCheckout: '/mentor/checkout',
  MentorOrder: '/mentor/order',
  RefundScreen: '/mentor/refund',
  ExchangeScreen: '/mentor/exchange',
  OrderStatus: '/medicines/order-status',
  MedicineCheckOut: '/medicines/checkout',
  TopCategories: '/products/top',
  ReviewPage: '/reviews',
  ReviewGalleryScreen: '/reviews/gallery',
  MedicalHistory: '/medical-history',
  TermsCondition: '/terms',
  NetworkError: '/network-error',
  FAQScreen: '/profile/faq',
  PatientFAQ: '/patient-faq',
  Home: '/home',
  OrangeLabScreen: '/labs',
  PackagesScreen: '/packages',
  PrakritiProfile: '/prakriti-profile',
  ConsultScreen: '/consult',
};

export const mapAppScreenToPath = (screen) => WEB_ROUTES[screen] || '/home';

const ROUTE_ALIASES = {
  doctorprofile: 'DoctorProfile',
  doctor: 'DoctorProfile',
  alldoctors: 'AllDoctors',
  doctors: 'AllDoctors',
  consult: 'AllDoctors',
  productdetails: 'ProductDetails',
  product: 'ProductDetails',
  medicinescreen: 'MedicineScreen',
  medicine: 'MedicineScreen',
  productsscreen: 'ProductsScreen',
  products: 'ProductsScreen',
  dietscreen: 'DietScreen',
  diet: 'DietScreen',
  yogascreen: 'YogaScreen',
  yoga: 'YogaScreen',
  home: 'Home',
  homescreen: 'Home',
  consultscreen: 'consult',
  packagesscreen: 'PackagesScreen',
  prakritiprofile: 'PrakritiProfile',
  careplan: 'PackagesScreen',
};

export const resolveBannerNavigation = (bannerItem) => {
  const raw = String(
    bannerItem?.redirect_url ||
      bannerItem?.link ||
      bannerItem?.deep_link ||
      bannerItem?.deeplink ||
      '',
  ).trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) {
    return { href: raw, external: true };
  }
  const cleanUrl = raw.replace(/^\/+|\/+$/g, '');
  const [routeRaw] = cleanUrl.split('/');
  const key = String(routeRaw || '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  const screen = ROUTE_ALIASES[key] || routeRaw;
  return { path: mapAppScreenToPath(screen), external: false };
};
