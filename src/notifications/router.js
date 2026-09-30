import { buildVideoCallNavParams } from '../consult/appointmentUtils';

const normalizeKey = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

const pickId = (...candidates) => {
  for (const value of candidates) {
    if (value == null || value === '') continue;
    const id = String(value).trim();
    if (id) return id;
  }
  return null;
};

export const handleNotificationNavigation = (navigate, data) => {
  if (!data || !navigate) return;

  const routeRaw = String(
    data?.route ?? data?.screen ?? data?.deep_link ?? data?.deeplink ?? '',
  ).trim();
  const routeKey = normalizeKey(routeRaw);
  const templateName = normalizeKey(data?.name ?? data?.template);
  const event = String(data?.event ?? data?.event_type ?? '').toLowerCase();
  const type = normalizeKey(data?.type ?? data?.notification_type ?? data?.category);
  const title = normalizeKey(data?.title ?? data?.message ?? data?.body);
  const orderStatus = String(data?.order_status ?? '').toLowerCase();
  const blob = `${routeKey} ${templateName} ${type} ${event} ${title}`;

  const orderId = pickId(
    data?.order_id,
    data?.orderId,
    data?.order?.id,
    data?.id && (routeKey.includes('order') || type === 'order') ? data.id : null,
  );
  const appointmentId = pickId(
    data?.appointment_id,
    data?.appointmentId,
    data?.consultation_id,
    data?.consultationId,
    data?.appointment?.id,
    data?.appointment?.appointment_id,
    data?.appointment?.consultation_id,
  );
  const productId = pickId(
    data?.product_id,
    data?.productId,
    data?.variant_id,
    data?.variantId,
    data?.varientID,
  );
  const doctorId = pickId(
    data?.doctor_id,
    data?.doctorId,
    data?.doctor?.id,
    data?.doctor?.doctor_id,
  );
  const prescriptionId = pickId(
    data?.prescription_id,
    data?.prescriptionId,
    data?.prescription?.id,
  );
  const callStatus = normalizeKey(
    data?.call_status ??
      data?.callStatus ??
      data?.data?.call_status ??
      data?.appointment?.call_status,
  );

  const isJoinCallNotification = () => {
    if (['inprogress', 'started', 'ongoing', 'active'].includes(callStatus)) return true;
    if (['videocall', 'joincall', 'callstarted', 'call'].includes(type)) return true;
    if (
      routeKey.includes('videocall') ||
      routeKey.includes('joincall') ||
      routeKey === 'patientvideocallscreen'
    ) {
      return true;
    }
    if (
      blob.includes('joincall') ||
      blob.includes('jointhecall') ||
      blob.includes('callnow') ||
      blob.includes('doctorstarted') ||
      blob.includes('callstarted') ||
      blob.includes('startedthecall') ||
      blob.includes('videocall')
    ) {
      return true;
    }
    return event.includes('call') && (event.includes('start') || event.includes('join'));
  };

  const goHome = () => navigate('/home');
  const goOrderDetails = () =>
    navigate(orderId ? `/profile/orders/${orderId}` : '/profile/orders');
  const goAppointment = () =>
    navigate(appointmentId ? `/profile/appointments/${appointmentId}` : '/profile/appointments');
  const goDiet = () => {
    const planId = data?.plan_id ?? data?.planId ?? data?.diet_plan_id;
    navigate(planId ? `/diet/${planId}` : '/diet');
  };
  const chatId = pickId(
    data?.consultation_id,
    data?.consultationId,
    data?.appointment?.consultation_id,
    appointmentId,
  );
  const goChat = () => {
    if (!chatId) {
      navigate('/profile/appointments');
      return;
    }
    navigate(`/profile/chat/${chatId}`, {
      state: {
        role: 'patient',
        doctorName: data?.doctor_name ?? data?.doctorName ?? data?.doctor?.doctor_name,
        doctorAvatar: data?.doctor_image ?? data?.doctorImage ?? data?.doctor?.doctor_image,
        patientName: data?.patient_name ?? data?.patientName,
        appointmentDate: data?.appointment_date ?? data?.appointment?.appointment_date,
        chatContext: {
          call_status: data?.call_status ?? data?.appointment?.call_status,
          appointment_status:
            data?.appointment_status ?? data?.appointment?.appointment_status,
          appointment_date: data?.appointment_date ?? data?.appointment?.appointment_date,
          follow_up: data?.follow_up ?? data?.appointment?.follow_up,
        },
      },
    });
  };
  const goProduct = () =>
    navigate(productId ? `/products/${productId}` : '/products');
  const goMedicine = () =>
    navigate(productId ? `/products/${productId}` : '/medicines');
  const goPrescription = () => {
    const rxLookup = pickId(
      data?.consultation_id,
      data?.consultationId,
      data?.appointment?.consultation_id,
      appointmentId,
      prescriptionId,
    );
    if (rxLookup) {
      navigate(`/profile/prescriptions/${rxLookup}`, {
        state: {
          appointment_id: appointmentId,
          consultation_id: data?.consultation_id ?? data?.consultationId,
          prescription_id: prescriptionId,
        },
      });
      return;
    }
    navigate('/profile/records');
  };
  const goMedicalReceipt = () => {
    const receiptId = pickId(
      data?.consultation_id,
      data?.consultationId,
      data?.appointment?.consultation_id,
      appointmentId,
    );
    if (receiptId) {
      navigate(`/profile/receipts/${receiptId}`);
      return;
    }
    navigate('/profile/appointments');
  };
  const goDoctor = () =>
    navigate(doctorId ? `/consult/doctors/${doctorId}` : '/consult');
  const goVideoCall = () => {
    const params = buildVideoCallNavParams(
      {
        appointment_id: appointmentId,
        consultation_id: data?.consultation_id ?? data?.consultationId ?? appointmentId,
        id: appointmentId,
        rawData: data,
        ...(data || {}),
      },
      {
        role: 'patient',
        otherPartyName:
          data?.doctor_name ?? data?.doctorName ?? data?.caller_name ?? 'Doctor',
        otherPartyImage: data?.doctor_image ?? data?.doctorImage ?? data?.caller_image,
      },
    );
    if (!params.appointmentId) {
      navigate('/profile/appointments');
      return;
    }
    navigate(`/profile/video/${params.appointmentId}`, { state: params });
  };

  if (isJoinCallNotification()) {
    goVideoCall();
    return;
  }

  if (routeKey) {
    if (['home', 'homescreen', 'tabstack'].includes(routeKey) || routeKey.includes('welcome')) {
      goHome();
      return;
    }
    if (['orderdetailsscreen', 'orderdetails', 'orderdetail', 'orderscreen', 'order'].includes(routeKey)) {
      goOrderDetails();
      return;
    }
    if (['orderhistory', 'orders', 'myorders'].includes(routeKey)) {
      navigate('/profile/orders');
      return;
    }
    if (
      ['appointmentdetails', 'appointmentdetail', 'appointment', 'appointments', 'consultation', 'consult'].includes(
        routeKey,
      )
    ) {
      goAppointment();
      return;
    }
    if (['follow', 'followup', 'followups', 'reminder'].includes(routeKey)) {
      goAppointment();
      return;
    }
    if (['chatscreen', 'chat', 'message', 'messages'].includes(routeKey)) {
      goChat();
      return;
    }
    if (['dietscreen', 'diet', 'dietplan', 'dietplanscreen', 'meal', 'nutrition'].includes(routeKey)) {
      goDiet();
      return;
    }
    if (['productdetails', 'product', 'productdetail', 'products', 'productsscreen'].includes(routeKey)) {
      goProduct();
      return;
    }
    if (['medicine', 'medicines', 'medicinescreen', 'pharmacy'].includes(routeKey)) {
      goMedicine();
      return;
    }
    if (
      ['prescriptiondetail', 'prescriptiondetails', 'prescription', 'prescriptionhistory', 'prescriptions'].includes(
        routeKey,
      )
    ) {
      goPrescription();
      return;
    }
    if (routeKey === 'medicalreceipt' || routeKey === 'receipt') {
      goMedicalReceipt();
      return;
    }
    if (['doctor', 'doctorprofile', 'doctors'].includes(routeKey)) {
      goDoctor();
      return;
    }
    if (['videocall', 'call', 'patientvideocallscreen'].includes(routeKey)) {
      goVideoCall();
      return;
    }
    if (routeKey === 'wishlist') {
      navigate('/profile/wishlist');
      return;
    }
    if (['rewards', 'mycoupons', 'coupon', 'offer', 'promotion'].includes(routeKey)) {
      navigate('/profile/rewards');
      return;
    }
    if (['payment', 'payments', 'paymentsscreen', 'transaction'].includes(routeKey)) {
      navigate('/profile/payments');
      return;
    }
    if (routeKey === 'cart' || routeKey === 'mycart') {
      navigate('/cart');
      return;
    }
    if (routeKey === 'notifications' || routeKey === 'notificationscreen') {
      navigate('/notifications');
      return;
    }
    if (routeKey === 'yoga' || routeKey === 'yogascreen') {
      navigate('/yoga');
      return;
    }
    if (routeKey === 'medicalrecords' || routeKey === 'medicalhistory') {
      navigate('/profile/records');
      return;
    }
  }

  if (templateName || type || title) {
    if (templateName === 'customerwelcome' || templateName.includes('welcome') || type === 'welcome') {
      goHome();
      return;
    }
    if (
      type === 'prescription' ||
      type === 'prescriptionhistory' ||
      type === 'rx' ||
      blob.includes('prescriptionhistory') ||
      blob.includes('prescription')
    ) {
      goPrescription();
      return;
    }
    if (blob.includes('followup') || ['follow', 'followup', 'reminder'].includes(type)) {
      goAppointment();
      return;
    }
    if (blob.includes('receipt') || type === 'receipt') {
      goMedicalReceipt();
      return;
    }
    if (blob.includes('medicine') || blob.includes('pharmacy') || type === 'medicine') {
      goMedicine();
      return;
    }
    if (blob.includes('product') || type === 'product' || type === 'catalog') {
      goProduct();
      return;
    }
    if (
      blob.includes('diet') ||
      blob.includes('meal') ||
      blob.includes('nutrition') ||
      blob.includes('water') ||
      type === 'diet'
    ) {
      goDiet();
      return;
    }
    if (blob.includes('order') || type === 'order' || orderStatus) {
      goOrderDetails();
      return;
    }
    if (
      blob.includes('appointment') ||
      blob.includes('consult') ||
      blob.includes('booking') ||
      type === 'appointment' ||
      type === 'consultation'
    ) {
      goAppointment();
      return;
    }
    if (blob.includes('chat') || blob.includes('message') || type === 'chat' || type === 'message') {
      goChat();
      return;
    }
    if (blob.includes('mentor') || type === 'mentor') {
      navigate('/mentor');
      return;
    }
    if (blob.includes('doctor') || type === 'doctor') {
      goDoctor();
      return;
    }
    if (
      blob.includes('reward') ||
      blob.includes('coupon') ||
      blob.includes('offer') ||
      ['reward', 'coupon', 'offer', 'promotion'].includes(type)
    ) {
      navigate('/profile/rewards');
      return;
    }
    if (blob.includes('wishlist') || type === 'wishlist') {
      navigate('/profile/wishlist');
      return;
    }
    if (blob.includes('payment') || blob.includes('refund') || type === 'payment') {
      navigate('/profile/payments');
      return;
    }
    if (['videocall', 'call', 'joincall'].includes(type)) {
      goVideoCall();
      return;
    }
    if (blob.includes('cart') || type === 'cart') {
      navigate('/cart');
      return;
    }
  }

  if (event === 'user.registered' || event.includes('welcome')) {
    goHome();
    return;
  }
  if (event.startsWith('order.') || orderId) {
    goOrderDetails();
    return;
  }
  if (event.startsWith('appointment.') || event.startsWith('consult') || appointmentId) {
    goAppointment();
    return;
  }
  if (event.startsWith('diet.') || event.includes('diet')) {
    goDiet();
    return;
  }
  if (productId) {
    goProduct();
    return;
  }
  if (prescriptionId) {
    goPrescription();
    return;
  }
  if (doctorId) {
    goDoctor();
    return;
  }

  navigate('/notifications');
};
