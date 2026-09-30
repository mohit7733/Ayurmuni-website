import Questionnaire from './Questionnaire';
import AuthShell from '../components/AuthShell';

export default function MedicalHistory() {
  return (
    <AuthShell>
      <Questionnaire mode="medical" />
    </AuthShell>
  );
}
