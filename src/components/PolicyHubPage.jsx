import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from './AppShell';
import PageHeader from './PageHeader';
import PolicyHubList from './PolicyHubList';
import { getPoliciesList, getPoliciesForViewer } from '../services/policyService';
import { getPolicyDoc } from '../utils/policyUtils';
import { SectionHold } from './ui';
import { STATIC_COPY as T } from '../content/static';
import '../design/pages/static.css';

export default function PolicyHubPage({
  title,
  intro,
  className = '',
  eyebrow,
  listHeading,
  listDescription,
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [policies, setPolicies] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPoliciesForViewer();
      if (res?.success === false) {
        setError(res?.message || 'Unable to load policies.');
        setPolicies([]);
        return;
      }
      setPolicies(getPoliciesList(res));
    } catch (e) {
      setError(e?.message || 'Unable to load policies.');
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openPolicy = (item) => {
    const policy = getPolicyDoc(item);
    navigate('/policy-detail', {
      state: {
        policyType: policy?.policy_type,
        title: policy?.title || policy?.name || 'Policy',
      },
    });
  };

  return (
    <AppShell tab="profile">
      <section className={`sx-page sx-narrow ${className}`.trim()}>
        <PageHeader
          title={title}
          subtitle={intro}
          eyebrow={eyebrow}
          onBack={() => navigate(-1)}
        />
        {loading ? (
          <SectionHold label={T.hubLoading} minHeight={240} />
        ) : (
          <PolicyHubList
            policies={policies}
            error={error}
            onRetry={load}
            onOpen={openPolicy}
            heading={listHeading}
            description={listDescription}
          />
        )}
      </section>
    </AppShell>
  );
}
