export const PRAKRITI_CONFIG = {
  description:
    'Journey through the temple and discover your Ayurvedic constitution.',
  infoText:
    'Each answer shapes your Vata, Pitta, and Kapha balance — trust your first instinct.',
  infoFromStep: 1,
};

export const MEDICAL_CONFIG = {
  description:
    'Complete your health quest so we can tailor the best wellness plan for you.',
  infoText:
    'Your answers stay confidential — each level unlocks smarter care.',
  infoFromStep: 0,
  medical: true,
};

export const QUESTIONNAIRE_SETUP = {
  prakriti: {
    config: PRAKRITI_CONFIG,
    finishRoute: '/prakriti-profile',
    finishParams: { fromAssessment: true },
  },
  medical: {
    config: MEDICAL_CONFIG,
    finishRoute: '/prakriti-profile',
    finishParams: { fromMedical: true },
  },
};

export const QUEST = {
  bgTop: '#F7F1E6',
  accent: '#E89A3C',
  xpBg: '#2F6B4F',
};

export const DOSHA = {
  vata: { key: 'vata', label: 'Vata', color: '#3D8B6E', soft: '#E7F4EE' },
  pitta: { key: 'pitta', label: 'Pitta', color: '#E89A3C', soft: '#FFF3E5' },
  kapha: { key: 'kapha', label: 'Kapha', color: '#4A7DB5', soft: '#E8F0F8' },
};

export const XP_PER_LEVEL = 10;
export const STREAK_BONUS = 5;

export const PRAKRITI_IMAGES = {
  Kapha:
    'https://ayurmuni.s3.ap-south-1.amazonaws.com/prakriti_images/8d60cead33a545f29fa970408ebdb224.png',
  Pitta:
    'https://ayurmuni.s3.ap-south-1.amazonaws.com/prakriti_images/288266a4c4e94f399be1fa0cdb7b3a9a.png',
  Vata:
    'https://ayurmuni.s3.ap-south-1.amazonaws.com/prakriti_images/0b3da9d104be4bb1b37b1d1e698ff616.png',
  'Kapha-Vata':
    'https://ayurmuni.s3.ap-south-1.amazonaws.com/prakriti_images/272b144fd9314a20a4e7d6bf579814c1.png',
  'Pitta-Kapha':
    'https://ayurmuni.s3.ap-south-1.amazonaws.com/prakriti_images/888ac0e8619b4dfe812b2bf4583b37e8.png',
  'Pitta-Vata':
    'https://ayurmuni.s3.ap-south-1.amazonaws.com/prakriti_images/ccb71b214bae4b01b5d62c9f00fb03d7.png',
  'Vata-Kapha':
    'https://ayurmuni.s3.ap-south-1.amazonaws.com/prakriti_images/62eed856309c45e7b28d81bfeb4dda9f.png',
  'Vata-Pitta':
    'https://ayurmuni.s3.ap-south-1.amazonaws.com/prakriti_images/491817a9fd8343459818b9ae3b6d1bf4.png',
  'Kapha-Pitta':
    'https://ayurmuni.s3.ap-south-1.amazonaws.com/prakriti_images/3afbc6d6dc164344a02c6c7573040989.png',
  Tridosha:
    'https://ayurmuni.s3.ap-south-1.amazonaws.com/prakriti_images/1435b1ad1380475caa127c9f00fb03d7.png',
};
