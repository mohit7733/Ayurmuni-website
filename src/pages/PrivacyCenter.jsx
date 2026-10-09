import PolicyHubPage from '../components/PolicyHubPage';
import '../design/pages/privacy-center.css';

export default function PrivacyCenter() {
  return (
    <PolicyHubPage
      title="Privacy Center"
      intro="Manage how Ayurmuni handles your personal and health information."
      eyebrow="Your information"
      className="sx-privacy-center"
      listHeading="Privacy documents"
      listDescription="Review the policies and notices that explain how your information is handled."
    />
  );
}
