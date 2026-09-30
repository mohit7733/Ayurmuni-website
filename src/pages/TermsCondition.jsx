import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { STATIC_COPY as T } from '../content/static';
import '../design/pages/static.css';

export default function TermsCondition() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = location.state || {};
  const agreed = params.agreed;
  const requireAccept = agreed === false;
  const policyType = params.policyType || (requireAccept ? 'terms_of_service' : 'privacy_policy');

  useEffect(() => {
    navigate('/policy-detail', {
      replace: true,
      state: {
        ...params,
        policyType,
        requireAccept,
        agreed,
        title:
          policyType === 'terms_of_service'
            ? 'Terms & Conditions'
            : policyType === 'privacy_policy'
              ? 'Privacy Policy'
              : params.title,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agreed, navigate, policyType, requireAccept]);

  return <div className="sx-redirect">{T.openingPolicy}</div>;
}
