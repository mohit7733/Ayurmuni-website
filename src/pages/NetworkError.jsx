import { useNavigate } from "react-router-dom";
import { WifiOff, ArrowLeft } from "lucide-react";
import AuthShell from "../components/AuthShell";
import { Button } from "../components/ui";
import { STATIC_COPY as T } from "../content/static";
import "../design/pages/static.css";

export default function NetworkError({ onGoBack }) {
  const navigate = useNavigate();

  const goBack = () => {
    if (onGoBack) {
      onGoBack();
      return;
    }

    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/home");
    }
  };

  return (
    <AuthShell>
      <section className="sx-network">
        <div className="sx-network__card">
          {/* Back button stays aligned to the card's content edge */}
          <button
            type="button"
            className="sx-network__back"
            onClick={goBack}
            aria-label="Go back"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            <span>{T.goBack}</span>
          </button>

          <div className="sx-network__content">
            <div className="sx-network__visual" aria-hidden="true">
              <div className="sx-network__visual-ring">
                <WifiOff size={46} strokeWidth={1.6} />
              </div>
              <span className="sx-network__visual-caption">
                CONNECTION INTERRUPTED
              </span>
            </div>

            <div className="sx-network__message">
              <span className="sx-network__mark">
                <span className="sx-network__status-dot" />
                {T.networkMark}
              </span>

              <h1>{T.networkTitle}</h1>

              <p className="sx-network__description">{T.networkText}</p>

              <div className="sx-network__hint">
                Check your internet connection, then return to Ayurmuni.
              </div>
            </div>
          </div>
        </div>
      </section>
    </AuthShell>
  );
}
