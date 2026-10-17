import Questionnaire from './Questionnaire';
import AuthShell from '../components/AuthShell';

export default function MedicalHistory() {
  return (
    <AuthShell hideFooter welcomeMode={false} className="auth-shell--assessment">
      <Questionnaire mode="medical" />
    </AuthShell>
  );
}
