import { showSuccessToast } from '../config/key';
import { HOME_COPY } from '../content/home';

export const notifyLabComingSoon = () => {
  showSuccessToast(HOME_COPY.labComingSoonToast, 'info');
};

export const notifyPanchakarmaComingSoon = () => {
  showSuccessToast(HOME_COPY.panchakarmaComingSoonToast, 'info');
};
