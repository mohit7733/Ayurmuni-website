import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PolicyContent from "../components/PolicyContent";
import PageHeader from "../components/PageHeader";
import { showSuccessToast } from "../config/key";
import {
  acceptPolicies,
  getPoliciesList,
  getRequiredPolicies,
} from "../services/policyService";
import { isPolicyAccepted } from "../utils/policyUtils";
import {
  Button,
  Disclaimer,
  EmptyState,
  Skeleton,
  SkeletonText,
} from "../components/ui";
import { STATIC_COPY as T } from "../content/static";
import "../design/pages/static.css";
import "../design/pages/policy-detail.css";

export default function PolicyDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = location.state || {};
  const policyType = params.policyType;
  const requireAccept =
    params.requireAccept === true || params.agreed === false;

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [policyEntry, setPolicyEntry] = useState(null);

  const headerTitle =
    params.title ||
    policy?.title ||
    policy?.name ||
    (policyType === "terms_of_service"
      ? "Terms of Use"
      : policyType === "privacy_policy"
        ? "Privacy Policy"
        : "Legal Policy");

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await getRequiredPolicies(policyType);
      if (res?.success === false) {
        setError(res?.message || "Unable to load this policy right now.");
        setPolicy(null);
        setPolicyEntry(null);
        return;
      }
      const list = getPoliciesList(res);
      const entry = list[0];
      const doc = entry?.policy ?? entry ?? null;
      if (!doc) {
        setError("Unable to load this policy right now.");
        setPolicy(null);
        setPolicyEntry(null);
        return;
      }
      setPolicy(doc);
      setPolicyEntry(entry);
    } catch (e) {
      setError(e?.message || "Failed to load policy. Please try again.");
      setPolicy(null);
    } finally {
      setLoading(false);
    }
  }, [policyType]);

  useEffect(() => {
    load();
  }, [load]);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    if (requireAccept) {
      navigate("/access-mode");
      return;
    }
    navigate("/onboarding");
  };

  const handleAccept = async () => {
    if (accepting) return;
    setAccepting(true);
    try {
      const type = policy?.policy_type || policyType;
      if (type) {
        await acceptPolicies({ policy_type: type });
      } else {
        await acceptPolicies({ type: "all" });
      }
      showSuccessToast("Policy accepted", "success");
      if (requireAccept) {
        navigate("/onboarding");
      }
    } catch (e) {
      showSuccessToast(
        e?.message || "Unable to accept policy right now",
        "error",
      );
    } finally {
      setAccepting(false);
    }
  };

  return (
    <section
      className={`sx-page sx-policy-detail${requireAccept ? " has-sticky" : ""}`}
    >
      <PageHeader eyebrow="Policy document" onBack={handleBack} />

      {loading ? (
        <div aria-busy="true" aria-label={T.policyLoading}>
          <SkeletonText lines={2} />
          <Skeleton
            style={{
              height: 200,
              borderRadius: "var(--am-radius-lg)",
              marginTop: 16,
            }}
          />
        </div>
      ) : error ? (
        <EmptyState
          title={error}
          action={
            <Button variant="primary" onClick={load}>
              {T.policyRetry}
            </Button>
          }
        />
      ) : (
        <>
          <div
            className="sx-policy-banner sx-policy-detail__banner"
            style={{ marginTop: "-14px" }}
          >
            <strong>{policy?.title || headerTitle}</strong>
            {policy?.subtitle ? <p>{policy.subtitle}</p> : null}
            {isPolicyAccepted(policyEntry) ? (
              <em>{T.policyUpdated(policy?.version)}</em>
            ) : null}
          </div>
          <div className="sx-policy-card">
            <PolicyContent content={policy?.content} />
          </div>
          {requireAccept ? (
            <div className="sx-sticky-footer">
              <div className="sx-sticky-footer__inner">
                <Button
                  variant="primary"
                  block
                  loading={accepting}
                  disabled={accepting}
                  onClick={handleAccept}
                >
                  {accepting ? T.policyWait : T.policyAccept}
                </Button>
              </div>
            </div>
          ) : null}
          <Disclaimer />
        </>
      )}
    </section>
  );
}
