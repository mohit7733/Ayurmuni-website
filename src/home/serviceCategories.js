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
  const data = input.data;
  if (data && typeof data === 'object') {
    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.categories)) return data.categories;
    if (Array.isArray(data.service_categories)) return data.service_categories;
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
  return null;
};

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
