import PolicyHubPage from '../components/PolicyHubPage';
import '../design/pages/legal-policies.css';

export default function LegalPoliciesHub() {
  return (
    <PolicyHubPage
      title="Terms, Policies and Licenses"
      intro="Review Ayurmuni’s legal documents. Tap any item to read the full policy."
      eyebrow="Legal information"
      className="sx-legal-policies"
      listHeading="Your documents"
      listDescription="Browse terms, privacy policies, and other important legal documents."
    />
  );
}
