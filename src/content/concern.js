/** Copy for the health concern page (suggested + general doctors, products, medicines). */
export const CONCERN_COPY = {
  subtitle: 'Expert doctors, trusted remedies, diet and yoga - your complete Ayurvedic care plan',
  searchPlaceholder: 'Search doctors, medicines and wellness products',
  viewAll: 'View all',

  suggestedDoctors: 'Top Doctors for You',
  suggestedProducts: 'Recommended Wellness Products',
  suggestedMedicines: 'Recommended Ayurvedic Medicines',
  ourDoctors: 'Our Doctors',
  ourProducts: 'Our Products',
  ourMedicines: 'Our Medicines',

  suggestedDoctorsText: (scope) => `Hand-picked Ayurvedic specialists experienced in treating ${scope} - book a consultation today.`,
  suggestedProductsText: (scope) => `Natural, carefully chosen essentials to support your ${scope} care every day.`,
  suggestedMedicinesText: (scope) => `Authentic, doctor-trusted Ayurvedic formulations for ${scope}.`,
  ourDoctorsText: 'Certified Ayurvedic experts, ready to consult.',
  ourProductsText: 'Pure, natural wellness essentials loved by our community.',
  ourMedicinesText: 'Authentic Ayurvedic medicines from trusted brands.',

  // Empty states: warm, reassuring, and always point to a next step.
  noSuggestedDoctorsTitle: (scope) => `Personalised care for ${scope} is on its way`,
  noSuggestedDoctors: (scope) =>
    `We are adding specialists for ${scope}. Meanwhile, our certified Ayurvedic doctors can guide you today.`,
  noSuggestedProductsTitle: (scope) => `Curating the best for ${scope}`,
  noSuggestedProducts: (scope) =>
    `Our experts are hand-picking wellness products for ${scope}. Talk to a doctor for a plan made just for you, or explore our full range.`,
  noSuggestedMedicinesTitle: (scope) => `The right remedy for ${scope}, made for you`,
  noSuggestedMedicines: (scope) =>
    `Every body is different - a quick consultation helps our doctors recommend the right Ayurvedic medicine for ${scope}.`,
  noMatchesTitle: 'No exact match',
  noMatches: 'Try a different word, or explore everything we offer below.',
  noDoctorsTitle: 'Our doctors will be back shortly',
  noDoctors: 'All our experts are busy right now. Please check again in a little while.',
  noProductsTitle: 'New arrivals coming soon',
  noProducts: 'We are restocking our wellness shelf. Please check back soon.',
  noMedicinesTitle: 'New arrivals coming soon',
  noMedicines: 'We are restocking our medicines. Please check back soon.',
  emptyTitle: 'Coming soon',

  ctaConsult: 'Consult a doctor',
  ctaBrowseDoctors: 'Browse all doctors',
  ctaBrowseProducts: 'Explore all products',
  ctaBrowseMedicines: 'Explore all medicines',
};