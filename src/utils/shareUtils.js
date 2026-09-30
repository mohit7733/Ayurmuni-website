/**
 * Share utilities for Web Share API and fallbacks
 */

/**
 * Check if Web Share API is available
 */
export const canShare = () => {
  return typeof navigator !== 'undefined' && navigator.share !== undefined;
};

/**
 * Share content using Web Share API or fallback to clipboard
 */
export async function shareContent({ title, text, url }) {
  const shareData = {
    title: title || 'Ayurmuni',
    text: text || '',
    url: url || window.location.href,
  };

  try {
    // Try Web Share API first
    if (canShare() && navigator.canShare && navigator.canShare(shareData)) {
      await navigator.share(shareData);
      return { success: true, method: 'native' };
    }

    // Fallback to clipboard
    const shareText = `${shareData.title}${shareData.text ? `\n\n${shareData.text}` : ''}\n\n${shareData.url}`;
    await copyToClipboard(shareText);
    return { success: true, method: 'clipboard' };
  } catch (error) {
    if (error.name === 'AbortError') {
      // User cancelled the share
      return { success: false, cancelled: true };
    }
    console.error('Share error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Copy text to clipboard with fallback
 */
export async function copyToClipboard(text) {
  try {
    // Try modern clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Fallback to execCommand
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (error) {
    console.error('Copy to clipboard error:', error);
    throw error;
  }
}

/**
 * Share a product
 */
export async function shareProduct(product) {
  const productId = product.id || product.variant_id || product.product_id;
  const productName = product.variant_title || product.product_name || product.name || 'Product';
  const url = `${window.location.origin}/product/${productId}`;

  return shareContent({
    title: `${productName} - Ayurmuni`,
    text: `Check out this amazing product on Ayurmuni!`,
    url,
  });
}

/**
 * Share a doctor profile
 */
export async function shareDoctor(doctor) {
  const doctorId = doctor.id || doctor.doctor_id;
  const doctorName = doctor.doctor_name || doctor.name || 'Doctor';
  const specialization = doctor.specialization || doctor.specialty || '';
  const url = `${window.location.origin}/doctor/${doctorId}`;

  return shareContent({
    title: `Dr. ${doctorName} - Ayurmuni`,
    text: specialization
      ? `Consult with Dr. ${doctorName}, ${specialization} on Ayurmuni`
      : `Consult with Dr. ${doctorName} on Ayurmuni`,
    url,
  });
}

/**
 * Share a diet recipe/meal
 */
export async function shareRecipe(recipe) {
  const recipeId = recipe.id || recipe.meal_id;
  const recipeName = recipe.meal_name || recipe.name || recipe.title || 'Recipe';
  const url = recipe.share_url || `${window.location.origin}/diet/meal/${recipeId}`;

  return shareContent({
    title: `${recipeName} - Ayurmuni`,
    text: `Try this healthy recipe from Ayurmuni's diet plans!`,
    url,
  });
}

/**
 * Share a yoga session
 */
export async function shareYogaSession(session) {
  const sessionId = session.id || session.session_id;
  const name = session.title || session.name || 'Yoga session';
  return shareContent({
    title: `${name} - Ayurmuni`,
    text: session.short_description || session.description || 'A guided yoga session on Ayurmuni.',
    url: `${window.location.origin}/yoga/${sessionId}`,
  });
}

/**
 * Share a doctor slip
 */
export async function shareDoctorSlip(doctor, doctorId) {
  const name = doctor?.doctor_name || doctor?.full_name || 'Doctor';
  return shareContent({
    title: `Doctor slip — ${name}`,
    text: `Consultation summary with ${name} on Ayurmuni.`,
    url: `${window.location.origin}/consult/doctors/${doctorId}/slip`,
  });
}
export async function shareApp() {
  const url = window.location.origin;

  return shareContent({
    title: 'Ayurmuni - Ayurvedic Healthcare',
    text: 'Experience authentic Ayurvedic healthcare. Consult expert doctors, shop wellness products, and get personalized diet plans.',
    url,
  });
}

/**
 * Share an appointment
 */
export async function shareAppointment(appointment) {
  const appointmentId = appointment.appointment_id || appointment.consultation_id || appointment.id;
  const doctorName = appointment.doctor?.doctor_name || appointment.doctor_name || 'Doctor';
  const date = appointment.appointment_date;
  const time = appointment.start_time;

  return shareContent({
    title: `Appointment with Dr. ${doctorName}`,
    text: `I have an appointment with Dr. ${doctorName}${date ? ` on ${date}` : ''}${time ? ` at ${time}` : ''} via Ayurmuni.`,
    url: `${window.location.origin}/profile/appointments/${appointmentId}`,
  });
}

/**
 * Share order details
 */
export async function shareOrder(order) {
  const orderId = order.order_code || order.order_number || order.id;
  const url = `${window.location.origin}/profile/orders/${order.id || orderId}`;

  return shareContent({
    title: `Order #${orderId} - Ayurmuni`,
    text: 'Check out my order from Ayurmuni!',
    url,
  });
}

/**
 * Generate WhatsApp share URL
 */
export function getWhatsAppShareUrl(text, url) {
  const message = `${text}\n\n${url}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/**
 * Generate Facebook share URL
 */
export function getFacebookShareUrl(url) {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}

/**
 * Generate Twitter share URL
 */
export function getTwitterShareUrl(text, url) {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

/**
 * Generate Telegram share URL
 */
export function getTelegramShareUrl(text, url) {
  const message = `${text}\n\n${url}`;
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

/**
 * Generate email share URL
 */
export function getEmailShareUrl(subject, body) {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
