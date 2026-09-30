import { useEffect } from 'react';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { setNavigate } from './navigation/nav';
import ToastHost from './components/ToastHost';
import Splash from './pages/Splash';
import Welcome from './pages/Welcome';
import Login from './pages/Login';
import OtpVerify from './pages/OtpVerify';
import AccessMode from './pages/AccessMode';
import Home from './pages/Home';
import Onboarding from './pages/Onboarding';
// import PolicyAccept from './pages/PolicyAccept';
import PolicyDetail from './pages/PolicyDetail';
import AssessmentType from './pages/AssessmentType';
import Questionnaire from './pages/Questionnaire';
import PatientFAQ from './pages/PatientFAQ';
import MedicalHistory from './pages/MedicalHistory';
import TermsCondition from './pages/TermsCondition';
import NetworkError from './pages/NetworkError';
import About from './pages/About';
import Contact from './pages/Contact';
import PrakritiProfile from './pages/PrakritiProfile';
import CompleteDetails from './pages/CompleteDetails';
import Notifications from './pages/Notifications';
import Products from './pages/Products';
import CategoryProducts from './pages/CategoryProducts';
import TopCategories from './pages/TopCategories';
import ProductDetails from './pages/ProductDetails';
import ProductSearch from './pages/ProductSearch';
import ReviewPage from './pages/ReviewPage';
import ReviewGallery from './pages/ReviewGallery';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderConfirmation from './pages/OrderConfirmation';
import Consult from './pages/Consult';
import ConsultHistory from './pages/ConsultHistory';
import CategoryDoctor from './pages/CategoryDoctor';
import Doctors from './pages/Doctors';
import DoctorProfile from './pages/DoctorProfile';
import DoctorSlot from './pages/DoctorSlot';
import ConsultPay from './pages/ConsultPay';
import DoctorSlip from './pages/DoctorSlip';
import DoctorConsultationHistory from './pages/DoctorConsultationHistory';
import BookingConfirm from './pages/BookingConfirm';
import AddCalendar from './pages/AddCalendar';
import Profile from './pages/Profile';
import EditProfile from './pages/EditProfile';
import Settings from './pages/Settings';
import NotificationSettings from './pages/NotificationSettings';
import OrangeLab from './pages/OrangeLab';
import Packages from './pages/Packages';
import Addresses from './pages/Addresses';
import AddressForm from './pages/AddressForm';
import Appointments from './pages/Appointments';
import AppointmentDetails from './pages/AppointmentDetails';
import Chat from './pages/Chat';
import PrescriptionDetail from './pages/PrescriptionDetail';
import ShareExperience from './pages/ShareExperience';
import MedicalReceipt from './pages/MedicalReceipt';
import PrivacyCenter from './pages/PrivacyCenter';
import FeedbackInformation from './pages/FeedbackInformation';
import LegalPoliciesHub from './pages/LegalPoliciesHub';
import OrderHistory from './pages/OrderHistory';
import OrderDetails from './pages/OrderDetails';
import Wishlist from './pages/Wishlist';
import FavDoctors from './pages/FavDoctors';
import HelpCenter from './pages/HelpCenter';
import FaqDetail from './pages/FaqDetail';
import Medicines from './pages/Medicines';
import PrescriptionUpload from './pages/PrescriptionUpload';
import PrescriptionVerify from './pages/PrescriptionVerify';
import OrderStatus from './pages/OrderStatus';
import MedicineCheckout from './pages/MedicineCheckout';
import Yoga from './pages/Yoga';
import YogaSession from './pages/YogaSession';
import Diet from './pages/Diet';
import DietPlan from './pages/DietPlan';
import MealDetails from './pages/MealDetails';
import WeeklyMeal from './pages/WeeklyMeal';
import Patients from './pages/Patients';
import PatientForm from './pages/PatientForm';
import MedicalRecords from './pages/MedicalRecords';
import Rewards from './pages/Rewards';
import Payments from './pages/Payments';
import TransactionDetails from './pages/TransactionDetails';
import VideoCall, { VideoCallRedirect } from './pages/VideoCall';
import LocationPicker from './pages/LocationPicker';
import MentorProfile from './pages/MentorProfile';
import ConsultMentor from './pages/ConsultMentor';
import MentorCheckout from './pages/MentorCheckout';
import MentorOrder from './pages/MentorOrder';
import MentorRefund from './pages/MentorRefund';
import MentorExchange from './pages/MentorExchange';
import { CartProvider } from './hooks/useCart';
import { VideoCallProvider } from './context/VideoCallContext';
import { LocationProvider } from './context/LocationContext';
import FloatingVideoOverlay from './components/FloatingVideoOverlay';
import AuthShell from './components/AuthShell';
import NetworkGuard from './components/NetworkGuard';
import './design/tokens.css';
import './index.css';
import './styles.css';
import './desktop.css';
import './ui.css';
import './design/base.css';
import './design/components.css';
import './design/shell.css';

function withAuthChrome(Page) {
  return function AuthChromePage() {
    return (
      <AuthShell>
        <Page />
      </AuthShell>
    );
  };
}

const WelcomePage = withAuthChrome(Welcome);
const LoginPage = withAuthChrome(Login);
const OtpPage = withAuthChrome(OtpVerify);
const AccessModePage = withAuthChrome(AccessMode);
const OnboardingPage = withAuthChrome(Onboarding);
// const PolicyAcceptPage = withAuthChrome(PolicyAccept);
// const PolicyDetailPage = withAuthChrome(PolicyDetail);
const AssessmentPage = withAuthChrome(AssessmentType);
const PatientFaqPage = withAuthChrome(PatientFAQ);
const PrakritiProfilePage = withAuthChrome(PrakritiProfile);
const CompleteDetailsPage = withAuthChrome(CompleteDetails);

function NavBinder() {
  const navigate = useNavigate();
  useEffect(() => {
    setNavigate((path, options = {}) => {
      navigate(path, options);
    });
  }, [navigate]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <VideoCallProvider>
      <LocationProvider>
      <CartProvider>
      <NavBinder />
      <ToastHost />
      <FloatingVideoOverlay />
      <NetworkGuard>
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/otp" element={<OtpPage />} />
        <Route path="/access-mode" element={<AccessModePage />} />
        <Route path="/home" element={<Home />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        {/* <Route path="/policy-accept" element={<PolicyAcceptPage />} /> */}
        {/* <Route path="/policy-detail" element={<PolicyDetailPage />} /> */}
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
            <AuthShell>
              <Questionnaire mode="medical" />
            </AuthShell>
          }
        />
        <Route path="/medical-history" element={<MedicalHistory />} />
        <Route path="/prakriti-profile" element={<PrakritiProfilePage />} />
        <Route path="/complete-details" element={<CompleteDetailsPage />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/top" element={<TopCategories />} />
        <Route path="/products/category" element={<CategoryProducts />} />
        <Route path="/products/:variantId" element={<ProductDetails />} />
        <Route path="/reviews" element={<ReviewPage />} />
        <Route path="/reviews/gallery" element={<ReviewGallery />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/order-confirmation" element={<OrderConfirmation />} />
        <Route path="/consult" element={<Consult />} />
        <Route path="/consult/history" element={<ConsultHistory />} />
        <Route path="/consult/concern/:categoryId" element={<CategoryDoctor />} />
        <Route path="/consult/doctors" element={<Doctors />} />
        <Route path="/consult/doctors/:doctorId" element={<DoctorProfile />} />
        <Route path="/consult/doctors/:doctorId/slots" element={<DoctorSlot />} />
        <Route path="/consult/doctors/:doctorId/pay" element={<ConsultPay />} />
        <Route path="/consult/doctors/:doctorId/slip" element={<DoctorSlip />} />
        <Route path="/consult/doctors/:doctorId/history" element={<DoctorConsultationHistory />} />
        <Route path="/consult/booking-confirm" element={<BookingConfirm />} />
        <Route path="/consult/add-calendar" element={<AddCalendar />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/edit" element={<EditProfile />} />
        <Route path="/profile/settings" element={<Settings />} />
        <Route path="/profile/settings/notifications" element={<NotificationSettings />} />
        <Route path="/location-picker" element={<LocationPicker />} />
        <Route path="/mentor" element={<MentorProfile />} />
        <Route path="/mentor/consult" element={<ConsultMentor />} />
        <Route path="/mentor/checkout" element={<MentorCheckout />} />
        <Route path="/mentor/order" element={<MentorOrder />} />
        <Route path="/mentor/refund" element={<MentorRefund />} />
        <Route path="/mentor/exchange" element={<MentorExchange />} />
        <Route path="/profile/addresses" element={<Addresses />} />
        <Route path="/profile/addresses/new" element={<AddressForm />} />
        <Route path="/profile/addresses/:addressId" element={<AddressForm />} />
        <Route path="/profile/appointments" element={<Appointments />} />
        <Route path="/profile/appointments/:appointmentId" element={<AppointmentDetails />} />
        <Route path="/profile/chat/:appointmentId" element={<Chat />} />
        <Route path="/profile/prescriptions/:lookupId" element={<PrescriptionDetail />} />
        <Route path="/share-experience" element={<ShareExperience />} />
        <Route path="/profile/receipts/:consultationId" element={<MedicalReceipt />} />
        <Route path="/profile/orders" element={<OrderHistory />} />
        <Route path="/profile/orders/:orderId" element={<OrderDetails />} />
        <Route path="/profile/wishlist" element={<Wishlist />} />
        <Route path="/profile/favourite-doctors" element={<FavDoctors />} />
        <Route path="/profile/faq" element={<HelpCenter />} />
        <Route path="/profile/faq/:faqId" element={<FaqDetail />} />
        <Route path="/profile/privacy" element={<PrivacyCenter />} />
        <Route path="/profile/feedback" element={<FeedbackInformation />} />
        <Route path="/profile/legal-policies" element={<LegalPoliciesHub />} />
        <Route path="/profile/patients" element={<Patients />} />
        <Route path="/profile/patients/new" element={<PatientForm />} />
        <Route path="/profile/patients/:patientId" element={<PatientForm />} />
        <Route path="/profile/records" element={<MedicalRecords />} />
        <Route path="/profile/rewards" element={<Rewards />} />
        <Route path="/profile/payments" element={<Payments />} />
        <Route path="/profile/payments/:transactionId" element={<TransactionDetails />} />
        <Route path="/profile/video" element={<VideoCallRedirect />} />
        <Route path="/profile/video/:appointmentId" element={<VideoCall />} />
        <Route path="/medicines" element={<Medicines />} />
        <Route path="/labs" element={<OrangeLab />} />
        <Route path="/packages" element={<Packages />} />
        <Route path="/medicines/prescription" element={<PrescriptionUpload />} />
        <Route path="/medicines/prescription/verify" element={<PrescriptionVerify />} />
        <Route path="/medicines/checkout" element={<MedicineCheckout />} />
        <Route path="/medicines/order-status" element={<OrderStatus />} />
        <Route path="/yoga" element={<Yoga />} />
        <Route path="/yoga/:sessionId" element={<YogaSession />} />
        <Route path="/diet" element={<Diet />} />
        <Route path="/diet/weekly" element={<WeeklyMeal />} />
        <Route path="/diet/:planId/weekly" element={<WeeklyMeal />} />
        <Route path="/diet/:planId" element={<DietPlan />} />
        <Route path="/diet/:planId/meals/:mealId" element={<MealDetails />} />
        <Route path="/search" element={<ProductSearch />} />
      </Routes>
      </NetworkGuard>
      </CartProvider>
      </LocationProvider>
      </VideoCallProvider>
    </BrowserRouter>
  );
}
