export const STATIC_COPY = {
  splashKicker: 'Ayurveda care, made personal',
  splashBrand: 'AYURMUNI',
  splashTagline: 'Your Ayurveda',
  splashPrep: 'Preparing your wellness space',

  networkTitle: 'No internet connection',
  networkText: 'We are unable to service your network request as you are currently offline.',
  networkMark: 'Offline',
  goBack: 'Go back',

  policyLoading: 'Loading policy…',
  policyRetry: 'Retry',
  policyUpdated: (v) =>
    v
      ? `This policy has been updated (v${v}). Please review the latest version.`
      : 'This policy has been updated. Please review the latest version.',
  policyAccept: 'Accept',
  policyWait: 'Please wait…',
  policyEmptyContent: 'Policy content is not available.',
  openingPolicy: 'Opening policy…',

  hubLoading: 'Loading policies…',
  hubEmpty: 'No policies available.',
  hubUpdated: 'Updated — please review the latest version',
  hubRetry: 'Retry',

  faqTitle: 'FAQ',
  faqSubtitle: 'Common questions answered',
  faqSearch: 'Search FAQs',
  faqLoading: 'Loading FAQs…',
  faqEmpty: 'No FAQs found',
  faqEmptyText: 'Try another category or search term.',
  faqHelpTitle: 'Still need help?',
  faqHelpText: 'Our support team can assist with healthcare-related inquiries.',
  faqEmail: 'Email support',
  faqSupportMailto: 'mailto:support@ayurmuni.com',
  faqArticle: 'Help article',
  faqArticleLoading: 'Loading article…',
  faqArticleError: 'Unable to load this article',

  feedbackTitle: 'Feedback & Information',
  feedbackSubtitle: 'Find help resources and Ayurmuni’s terms, policies and licenses.',
  feedbackItems: [
    {
      title: 'Help Center',
      subtitle: 'FAQs and contact support',
      to: '/profile/faq',
      icon: 'help',
    },
    {
      title: 'Terms of Use',
      subtitle: 'Rules for using Ayurmuni',
      to: '/policy-detail',
      state: { policyType: 'terms_of_service', title: 'Terms of Use' },
      icon: 'terms',
    },
    {
      title: 'Privacy Policy',
      subtitle: 'How we handle your data',
      to: '/policy-detail',
      state: { policyType: 'privacy_policy', title: 'Privacy Policy' },
      icon: 'privacy',
    },
    {
      title: 'Terms, Policies and Licenses',
      subtitle: 'All legal documents',
      to: '/profile/legal-policies',
      icon: 'legal',
    },
  ],

  aboutTitle: 'About Ayurmuni',
  aboutSubtitle: 'Ayurveda care, made personal',
  aboutLead:
    'Ayurmuni brings personalised Ayurveda to everyday life — consultations with MD Ayurvedic doctors, authentic medicines and products, diet and yoga guidance, and doorstep delivery.',
  aboutPoints: [
    { title: 'Expert care', text: 'Connect with qualified Ayurvedic doctors matched to your needs.' },
    { title: 'Personalised wellness', text: 'Plans shaped by your Prakriti, lifestyle, and goals.' },
    { title: 'Trusted products', text: 'Curated medicines and wellness products from authentic sources.' },
  ],
  aboutCtaHome: 'Go to home',
  aboutCtaConsult: 'Consult a doctor',

  contactTitle: 'Contact us',
  contactSubtitle: 'We’re here to help',
  contactLead: 'Reach Ayurmuni support for order, appointment, or account questions.',
  contactEmailLabel: 'Email',
  contactEmail: 'support@ayurmuni.com',
  contactEmailHref: 'mailto:support@ayurmuni.com',
  contactFaq: 'Browse FAQs',
  contactNote: 'For medical emergencies, call 112. Ayurmuni is not a substitute for emergency care.',
};
