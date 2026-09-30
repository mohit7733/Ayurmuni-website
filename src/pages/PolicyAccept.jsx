import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, FileText, Lock, RefreshCw, Shield } from 'lucide-react';
import { showSuccessToast } from '../config/key';
import { Utils } from '../common/utils';
import {
  acceptPolicies,
  getPoliciesList,
  getRequiredPolicies,
} from '../services/policyService';
import { getPolicyDoc, isPolicyAccepted } from '../utils/policyUtils';
import { Button, Disclaimer, EmptyState, Skeleton, SkeletonText } from '../components/ui';
import { AUTH_COPY as T } from '../content/auth';
import '../design/pages/auth.css';

const policyIcon = (item) => {
  const doc = getPolicyDoc(item);
  const key = `${doc?.policy_type || ''} ${doc?.title || ''} ${doc?.name || ''}`.toLowerCase();
  if (key.includes('privacy') || key.includes('consent')) return Shield;
  if (key.includes('term') || key.includes('license')) return FileText;
  if (key.includes('lock') || key.includes('security')) return Lock;
  return FileText;
};

export default function PolicyAccept() {
  const navigate = useNavigate();
  const location = useLocation();
  const nextRoute = location.state?.nextRoute || { name: 'Home' };
  const allowLeaveRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [agreed, setAgreed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getRequiredPolicies();
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

  useEffect(() => {
    const onPop = () => {
      if (allowLeaveRef.current) return;
      window.history.pushState(null, '', window.location.href);
      showSuccessToast(T.mandatoryMsg, 'error');
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const continueNext = () => {
    allowLeaveRef.current = true;
    if (nextRoute.name === 'Home') {
      navigate('/home', { replace: true });
      return;
    }
    if (nextRoute.name === 'AccessMode') {
      navigate('/access-mode', { replace: true });
      return;
    }
    if (nextRoute.name === 'AssessmentType') {
      navigate('/assessment', {
        replace: true,
        state: nextRoute.params || { form: 'all' },
      });
      return;
    }
    if (nextRoute.name === 'Onboarding') {
      navigate('/onboarding', { replace: true });
      return;
    }
    navigate('/home', { replace: true });
  };

  const handleAccept = async () => {
    if (!agreed) {
      showSuccessToast(T.mandatoryMsg, 'error');
      return;
    }
    if (accepting) return;
    setAccepting(true);
    try {
      await acceptPolicies({ type: 'all' });
      await Utils.storeData('_POLICY_ACCEPTED_CUSTOMER', true);
      showSuccessToast('Policies accepted', 'success');
      continueNext();
    } catch (e) {
      showSuccessToast(e?.message || 'Unable to accept policies right now', 'error');
    } finally {
      setAccepting(false);
    }
  };

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
    <section className="au-policy">
      <header>
        <h1 className="au-title">{T.policyTitle}</h1>
      </header>

      {loading ? (
        <div aria-busy="true" aria-label={T.policyLoading}>
          <SkeletonText lines={2} />
          <Skeleton style={{ height: 160, borderRadius: 'var(--am-radius-lg)', marginTop: 16 }} />
        </div>
      ) : (
        <>
          <p className="au-policy__intro">{T.policyIntro}</p>

          {error ? (
            <div className="au-policy__error">
              <p>{error}</p>
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<RefreshCw size={16} aria-hidden />}
                onClick={load}
              >
                {T.policyRetry}
              </Button>
            </div>
          ) : null}

          <div className="au-policy__list">
            {policies.map((item, index) => {
              const policy = getPolicyDoc(item);
              const updated = isPolicyAccepted(item);
              const Icon = policyIcon(item);
              return (
                <button
                  type="button"
                  className="au-policy__row"
                  key={policy?.id || String(index)}
                  onClick={() => openPolicy(item)}
                >
                  <span className="au-policy__icon" aria-hidden>
                    <Icon size={18} />
                  </span>
                  <span className="au-policy__text">
                    <strong>{policy?.title || policy?.name || 'Policy'}</strong>
                    {policy?.subtitle ? <small>{policy.subtitle}</small> : null}
                    {updated ? <em>{T.policyUpdated}</em> : null}
                  </span>
                  <ChevronRight size={18} aria-hidden />
                </button>
              );
            })}
            {!policies.length && !error ? (
              <EmptyState compact title={T.policyEmpty} />
            ) : null}
          </div>

          <label className="au-policy__check">
            <input
              type="checkbox"
              checked={agreed}
              onChange={() => setAgreed((v) => !v)}
            />
            <span>{T.policyAgree}</span>
          </label>

          <div className="au-policy__footer">
            <div className="au-policy__footer-inner">
              <Button
                variant="primary"
                block
                disabled={!agreed || accepting}
                loading={accepting}
                onClick={handleAccept}
              >
                {accepting ? T.policyWait : T.policyAccept}
              </Button>
            </div>
          </div>

          <Disclaimer />
        </>
      )}
    </section>
  );
}
