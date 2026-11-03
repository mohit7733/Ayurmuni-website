import { lazy, Suspense, useEffect, useLayoutEffect } from "react";
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { setNavigate } from "./navigation/nav";
import { PRIMARY_NAV } from "./site/nav";
import ToastHost from "./components/ToastHost";
import GlobalLoadBar from "./components/GlobalLoadBar";
import { Utils } from "./common/utils";
import { getAccessLevel } from "./services/guestAuth";
import { syncPushForSession } from "./services/pushNotificationService";
import { runWhenIdle } from "./hooks/useLazySection";
import Splash from "./pages/Splash";
import Welcome from "./pages/Welcome";
import Login from "./pages/Login";
import OtpVerify from "./pages/OtpVerify";
import Home from "./pages/Home";
import NetworkError from "./pages/NetworkError";
import NotFound from "./pages/NotFound";
import ErrorBoundary from "./components/ErrorBoundary";
import { PageSkeleton } from "./components/skeletons";

const loadPage = (loader) => lazy(loader);
const loadVideoCall = () => import("./pages/VideoCall");

const AccessMode = loadPage(() => import("./pages/AccessMode"));
const Onboarding = loadPage(() => import("./pages/Onboarding"));
const PolicyDetail = loadPage(() => import("./pages/PolicyDetail"));
const PolicyAccept = loadPage(() => import("./pages/PolicyAccept"));
const AssessmentType = loadPage(() => import("./pages/AssessmentType"));
const Questionnaire = loadPage(() => import("./pages/Questionnaire"));
const PatientFAQ = loadPage(() => import("./pages/PatientFAQ"));
const MedicalHistory = loadPage(() => import("./pages/MedicalHistory"));
const TermsCondition = loadPage(() => import("./pages/TermsCondition"));
const About = loadPage(() => import("./pages/About"));
const Contact = loadPage(() => import("./pages/Contact"));
const PrakritiProfile = loadPage(() => import("./pages/PrakritiProfile"));
const CompleteDetails = loadPage(() => import("./pages/CompleteDetails"));
const Notifications = loadPage(() => import("./pages/Notifications"));
const Products = loadPage(() => import("./pages/Products"));
const CategoryProducts = loadPage(() => import("./pages/CategoryProducts"));
const TopCategories = loadPage(() => import("./pages/TopCategories"));
const ProductDetails = loadPage(() => import("./pages/ProductDetails"));
const MedicineDetails = loadPage(() => import("./pages/MedicineDetails"));
const ProductSearch = loadPage(() => import("./pages/ProductSearch"));
const ReviewPage = loadPage(() => import("./pages/ReviewPage"));
const ReviewGallery = loadPage(() => import("./pages/ReviewGallery"));
const Cart = loadPage(() => import("./pages/Cart"));
const Checkout = loadPage(() => import("./pages/Checkout"));
const PaymentReturn = loadPage(() => import("./pages/PaymentReturn"));
const OrderConfirmation = loadPage(() => import("./pages/OrderConfirmation"));
const Consult = loadPage(() => import("./pages/Consult"));
const ConsultHistory = loadPage(() => import("./pages/ConsultHistory"));
const CategoryDoctor = loadPage(() => import("./pages/CategoryDoctor"));
const Doctors = loadPage(() => import("./pages/Doctors"));
const DoctorProfile = loadPage(() => import("./pages/DoctorProfile"));
const DoctorSlot = loadPage(() => import("./pages/DoctorSlot"));
const ConsultPay = loadPage(() => import("./pages/ConsultPay"));
const DoctorSlip = loadPage(() => import("./pages/DoctorSlip"));
const DoctorConsultationHistory = loadPage(() => import("./pages/DoctorConsultationHistory"));
const BookingConfirm = loadPage(() => import("./pages/BookingConfirm"));
const AddCalendar = loadPage(() => import("./pages/AddCalendar"));
const Profile = loadPage(() => import("./pages/Profile"));
const EditProfile = loadPage(() => import("./pages/EditProfile"));
const Settings = loadPage(() => import("./pages/Settings"));
const NotificationSettings = loadPage(() => import("./pages/NotificationSettings"));
// const OrangeLab = loadPage(() => import("./pages/OrangeLab")); // Health Lab disabled per Rohit
const Packages = loadPage(() => import("./pages/Packages"));
const PackageDetails = loadPage(() => import("./pages/PackageDetails"));
const Panchakarma = loadPage(() => import("./pages/Panchakarma"));
const Addresses = loadPage(() => import("./pages/Addresses"));
const AddressForm = loadPage(() => import("./pages/AddressForm"));
const Appointments = loadPage(() => import("./pages/Appointments"));
const AppointmentDetails = loadPage(() => import("./pages/AppointmentDetails"));
const Chat = loadPage(() => import("./pages/Chat"));
const ChatInbox = loadPage(() => import("./pages/ChatInbox"));
const PrescriptionDetail = loadPage(() => import("./pages/PrescriptionDetail"));
const ShareExperience = loadPage(() => import("./pages/ShareExperience"));
const MedicalReceipt = loadPage(() => import("./pages/MedicalReceipt"));
const PrivacyCenter = loadPage(() => import("./pages/PrivacyCenter"));
const FeedbackInformation = loadPage(() => import("./pages/FeedbackInformation"));
const LegalPoliciesHub = loadPage(() => import("./pages/LegalPoliciesHub"));
const OrderHistory = loadPage(() => import("./pages/OrderHistory"));
const OrderDetails = loadPage(() => import("./pages/OrderDetails"));
const ReturnRequest = loadPage(() => import("./pages/ReturnRequest"));
const ReturnDetails = loadPage(() => import("./pages/ReturnDetails"));
const Wishlist = loadPage(() => import("./pages/Wishlist"));
const MyPlans = loadPage(() => import("./pages/MyPlans"));
const FavDoctors = loadPage(() => import("./pages/FavDoctors"));
const HelpCenter = loadPage(() => import("./pages/HelpCenter"));
const FaqDetail = loadPage(() => import("./pages/FaqDetail"));
const Medicines = loadPage(() => import("./pages/Medicines"));
const PrescriptionUpload = loadPage(() => import("./pages/PrescriptionUpload"));
const PrescriptionVerify = loadPage(() => import("./pages/PrescriptionVerify"));
const OrderStatus = loadPage(() => import("./pages/OrderStatus"));
const MedicineCheckout = loadPage(() => import("./pages/MedicineCheckout"));
const Yoga = loadPage(() => import("./pages/Yoga"));
const YogaSession = loadPage(() => import("./pages/YogaSession"));
const Diet = loadPage(() => import("./pages/Diet"));
const DietPlan = loadPage(() => import("./pages/DietPlan"));
const MealDetails = loadPage(() => import("./pages/MealDetails"));
const WeeklyMeal = loadPage(() => import("./pages/WeeklyMeal"));
const Patients = loadPage(() => import("./pages/Patients"));
const PatientForm = loadPage(() => import("./pages/PatientForm"));
const MedicalRecords = loadPage(() => import("./pages/MedicalRecords"));
const Rewards = loadPage(() => import("./pages/Rewards"));
const Payments = loadPage(() => import("./pages/Payments"));
const TransactionDetails = loadPage(() => import("./pages/TransactionDetails"));
const VideoCall = loadPage(() => loadVideoCall().then((mod) => ({ default: mod.default })));
const VideoCallRedirect = loadPage(() =>
  loadVideoCall().then((mod) => ({ default: mod.VideoCallRedirect })),
);
const LocationPicker = loadPage(() => import("./pages/LocationPicker"));
const MentorProfile = loadPage(() => import("./pages/MentorProfile"));
const ConsultMentor = loadPage(() => import("./pages/ConsultMentor"));
const MentorCheckout = loadPage(() => import("./pages/MentorCheckout"));
const MentorOrder = loadPage(() => import("./pages/MentorOrder"));
const MentorRefund = loadPage(() => import("./pages/MentorRefund"));
const MentorExchange = loadPage(() => import("./pages/MentorExchange"));
import { CartProvider } from "./hooks/useCart";
import { VideoCallProvider } from "./context/VideoCallContext";
import { LocationProvider } from "./context/LocationContext";
import FloatingVideoOverlay from "./components/FloatingVideoOverlay";
import ChatLauncher from "./components/chat/ChatLauncher";
import CartFloat from "./components/CartFloat";
import AuthShell from "./components/AuthShell";
import AppShell from "./components/AppShell";
import NetworkGuard from "./components/NetworkGuard";
import RequireAuth from "./components/RequireAuth";
import "./design/tokens.css";
import "./index.css";
import "./styles.css";
import "./desktop.css";
import "./ui.css";
import "./design/base.css";
import "./design/components.css";
import "./design/shell.css";
import "./design/responsive.css";
import "./questionnaire/quest.css";
import "./questionnaire/assessment.css";

function withAuthChrome(
  Page,
  { hideFooter = false, welcomeMode = hideFooter, className = '' } = {},
) {
  return function AuthChromePage() {
    return (
      <AuthShell
        hideFooter={hideFooter}
        welcomeMode={welcomeMode}
        className={className}
      >
        <Page />
      </AuthShell>
    );
  };
}

const WelcomePage = withAuthChrome(Welcome, { hideFooter: true });
const LoginPage = withAuthChrome(Login, { hideFooter: true });
const OtpPage = withAuthChrome(OtpVerify, { hideFooter: true });
const AccessModePage = withAuthChrome(AccessMode);
const OnboardingPage = withAuthChrome(Onboarding, {
  hideFooter: true,
  welcomeMode: false,
});
const PolicyAcceptPage = withAuthChrome(PolicyAccept);
const PolicyDetailPage = withAuthChrome(PolicyDetail);
const AssessmentPage = withAuthChrome(AssessmentType, {
  hideFooter: true,
  welcomeMode: false,
  className: 'auth-shell--assessment',
});
const PatientFaqPage = withAuthChrome(PatientFAQ, {
  hideFooter: true,
  welcomeMode: false,
  className: 'auth-shell--assessment',
});
// Result page: full site navbar (data, cart, profile). Quiz steps keep the minimal AuthShell header.
function PrakritiProfilePage() {
  return (
    <AppShell tab="profile" hideFooter>
      <PrakritiProfile />
    </AppShell>
  );
}
const CompleteDetailsPage = withAuthChrome(CompleteDetails);

// Push for already-logged-in users (they never went through OTP after push shipped).
function PushSessionSync() {
  const { pathname } = useLocation();
  useEffect(() => {
    let alive = true;
    (async () => {
      if ((await getAccessLevel()) !== 'full' || !alive) return;
      const userId = await Utils.getData('_USER_ID');
      const info = await Utils.getData('_USER_INFO');
      if (!userId || info?.is_notification_enabled === false) return;
      // OneSignal is non-critical: init after first paint / idle.
      runWhenIdle(() => {
        if (alive) syncPushForSession(userId);
      }, 4000);
    })();
    return () => {
      alive = false;
    };
  }, [pathname]);
  return null;
}

function NavBinder() {
  const navigate = useNavigate();
  useEffect(() => {
    setNavigate((path, options = {}) => {
      navigate(path, options);
    });
  }, [navigate]);
  return null;
}

function RouteErrorBoundary({ children }) {
  const { pathname } = useLocation();
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>;
}

const HEADER_HOLD_PATHS = [...PRIMARY_NAV.map((item) => item.to), "/profile", "/cart", "/notifications", "/search"];

/**
 * Suspense fallback while a lazy page chunk loads. The header lives inside each page, so without
 * this the top of the screen shows the bare page background. Renders a static bar in the header's
 * own colours (no animation) so the header area looks the same before and after the page loads,
 * followed by a page skeleton.
 */
function RouteFallback() {
  const { pathname } = useLocation();
  const holdsHeader = HEADER_HOLD_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  return (
    <>
      {holdsHeader ? <div className="site-header-hold" aria-hidden="true" /> : null}
      <PageSkeleton />
    </>
  );
}

function ScrollToTop() {
  const location = useLocation();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [location.key]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <VideoCallProvider>
        <LocationProvider>
          <CartProvider>
            <NavBinder />
            <ScrollToTop />
            <ToastHost />
            <GlobalLoadBar />
            <PushSessionSync />
            <FloatingVideoOverlay />
            <NetworkGuard>
              <RouteErrorBoundary>
              <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Splash />} />
                <Route path="/welcome" element={<WelcomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/otp" element={<OtpPage />} />
                <Route path="/access-mode" element={<AccessModePage />} />
                <Route path="/onboarding" element={<OnboardingPage />} />
                <Route path="/policy-accept" element={<PolicyAcceptPage />} />
                <Route path="/policy-detail" element={<PolicyDetailPage />} />
                <Route path="/terms" element={<TermsCondition />} />
                <Route path="/network-error" element={<NetworkError />} />
                <Route path="/about" element={<About />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/assessment" element={<AssessmentPage />} />
                <Route
                  path="/assessment-prakriti"
                  element={<PatientFaqPage />}
                />
                <Route path="/patient-faq" element={<PatientFaqPage />} />
                <Route
                  path="/assessment-medical"
                  element={
                    <AuthShell
                      hideFooter
                      welcomeMode={false}
                      className="auth-shell--assessment"
                    >
                      <Questionnaire mode="medical" />
                    </AuthShell>
                  }
                />
                <Route path="/medical-history" element={<MedicalHistory />} />
                <Route
                  path="/prakriti-profile"
                  element={<PrakritiProfilePage />}
                />
                <Route
                  path="/complete-details"
                  element={<CompleteDetailsPage />}
                />
                <Route element={<RequireAuth />}>
                  <Route path="/home" element={<Home />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/products/top" element={<TopCategories />} />
                  <Route
                    path="/products/category"
                    element={<CategoryProducts />}
                  />
                  <Route
                    path="/products/:variantId"
                    element={<ProductDetails />}
                  />
                  <Route path="/reviews" element={<ReviewPage />} />
                  <Route path="/reviews/gallery" element={<ReviewGallery />} />
                  <Route path="/cart" element={<Cart />} />
                  <Route path="/checkout" element={<Checkout />} />
                  <Route path="/payment/return" element={<PaymentReturn />} />
                  <Route
                    path="/order-confirmation"
                    element={<OrderConfirmation />}
                  />
                  <Route path="/consult" element={<Consult />} />
                  <Route path="/consult/history" element={<ConsultHistory />} />
                  <Route
                    path="/consult/concern/:categoryId"
                    element={<CategoryDoctor />}
                  />
                  <Route path="/consult/doctors" element={<Doctors />} />
                  <Route
                    path="/consult/doctors/:doctorId"
                    element={<DoctorProfile />}
                  />
                  <Route
                    path="/consult/doctors/:doctorId/slots"
                    element={<DoctorSlot />}
                  />
                  <Route
                    path="/consult/doctors/:doctorId/pay"
                    element={<ConsultPay />}
                  />
                  <Route
                    path="/consult/doctors/:doctorId/slip"
                    element={<DoctorSlip />}
                  />
                  <Route
                    path="/consult/doctors/:doctorId/history"
                    element={<DoctorConsultationHistory />}
                  />
                  <Route
                    path="/consult/booking-confirm"
                    element={<BookingConfirm />}
                  />
                  <Route
                    path="/consult/add-calendar"
                    element={<AddCalendar />}
                  />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/profile/edit" element={<EditProfile />} />
                  <Route path="/profile/settings" element={<Settings />} />
                  <Route
                    path="/profile/settings/notifications"
                    element={<NotificationSettings />}
                  />
                  <Route path="/location-picker" element={<LocationPicker />} />
                  <Route path="/mentor" element={<MentorProfile />} />
                  <Route path="/mentor/consult" element={<ConsultMentor />} />
                  <Route path="/mentor/checkout" element={<MentorCheckout />} />
                  <Route path="/mentor/order" element={<MentorOrder />} />
                  <Route path="/mentor/refund" element={<MentorRefund />} />
                  <Route path="/mentor/exchange" element={<MentorExchange />} />
                  <Route path="/profile/addresses" element={<Addresses />} />
                  <Route
                    path="/profile/addresses/new"
                    element={<AddressForm />}
                  />
                  <Route
                    path="/profile/addresses/:addressId"
                    element={<AddressForm />}
                  />
                  <Route
                    path="/profile/appointments"
                    element={<Appointments />}
                  />
                  <Route
                    path="/profile/appointments/:appointmentId"
                    element={<AppointmentDetails />}
                  />
                  <Route path="/profile/chats" element={<ChatInbox />} />
                  <Route
                    path="/profile/chat/:appointmentId"
                    element={<Chat />}
                  />
                  <Route
                    path="/profile/prescriptions/:lookupId"
                    element={<PrescriptionDetail />}
                  />
                  <Route
                    path="/share-experience"
                    element={<ShareExperience />}
                  />
                  <Route
                    path="/profile/receipts/:consultationId"
                    element={<MedicalReceipt />}
                  />
                  <Route path="/profile/orders" element={<OrderHistory />} />
                  <Route
                    path="/profile/orders/:orderId"
                    element={<OrderDetails />}
                  />
                  <Route
                    path="/profile/orders/:orderId/return"
                    element={<ReturnRequest />}
                  />
                  <Route
                    path="/profile/returns/:returnId"
                    element={<ReturnDetails />}
                  />
                  <Route path="/profile/wishlist" element={<Wishlist />} />
                  <Route path="/profile/plans" element={<MyPlans />} />
                  <Route
                    path="/profile/favourite-doctors"
                    element={<FavDoctors />}
                  />
                  <Route path="/profile/faq" element={<HelpCenter />} />
                  <Route path="/profile/faq/:faqId" element={<FaqDetail />} />
                  <Route path="/profile/privacy" element={<PrivacyCenter />} />
                  <Route
                    path="/profile/feedback"
                    element={<FeedbackInformation />}
                  />
                  <Route
                    path="/profile/legal-policies"
                    element={<LegalPoliciesHub />}
                  />
                  <Route path="/profile/patients" element={<Patients />} />
                  <Route
                    path="/profile/patients/new"
                    element={<PatientForm />}
                  />
                  <Route
                    path="/profile/patients/:patientId"
                    element={<PatientForm />}
                  />
                  <Route path="/profile/records" element={<MedicalRecords />} />
                  <Route path="/profile/rewards" element={<Rewards />} />
                  <Route path="/profile/payments" element={<Payments />} />
                  <Route
                    path="/profile/payments/:transactionId"
                    element={<TransactionDetails />}
                  />
                  <Route
                    path="/profile/video"
                    element={<VideoCallRedirect />}
                  />
                  <Route
                    path="/profile/video/:appointmentId"
                    element={<VideoCall />}
                  />
                  <Route path="/medicines" element={<Medicines />} />
                  {/* Health Lab disabled per Rohit
                  <Route path="/labs" element={<OrangeLab />} /> */}
                  <Route path="/packages" element={<Packages />} />
                  <Route path="/packages/:packageId" element={<PackageDetails />} />
                  <Route path="/panchakarma" element={<Panchakarma />} />
                  <Route
                    path="/medicines/prescription"
                    element={<PrescriptionUpload />}
                  />
                  <Route
                    path="/medicines/prescription/verify"
                    element={<PrescriptionVerify />}
                  />
                  <Route
                    path="/medicines/checkout"
                    element={<MedicineCheckout />}
                  />
                  <Route
                    path="/medicines/order-status"
                    element={<OrderStatus />}
                  />
                  <Route
                    path="/medicines/:variantId"
                    element={<MedicineDetails />}
                  />
                  <Route path="/yoga" element={<Yoga />} />
                  <Route path="/yoga/:sessionId" element={<YogaSession />} />
                  <Route path="/diet" element={<Diet />} />
                  <Route path="/diet/weekly" element={<WeeklyMeal />} />
                  <Route path="/diet/:planId/weekly" element={<WeeklyMeal />} />
                  <Route path="/diet/:planId" element={<DietPlan />} />
                  <Route
                    path="/diet/:planId/meals/:mealId"
                    element={<MealDetails />}
                  />
                  <Route path="/search" element={<ProductSearch />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
              </RouteErrorBoundary>
            </NetworkGuard>
            <CartFloat />
            <ChatLauncher />
          </CartProvider>
        </LocationProvider>
      </VideoCallProvider>
    </BrowserRouter>
  );
}
