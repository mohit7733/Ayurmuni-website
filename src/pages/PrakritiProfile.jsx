import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import logoImg from '/images/FinalLogo.webp';
import { PRAKRITI_IMAGES } from '../questionnaire/configs';
import * as ProfileServices from '../services/profileService';
import { requireAuth } from '../services/guestAuth';
import './prakriti-profile.css';

const getDynamicTitle = (result) => {
  switch (result?.toLowerCase()) {
    case 'vata':
      return 'The Visionary';
    case 'pitta':
      return 'The Leader';
    case 'kapha':
      return 'The Nurturer';
    case 'vata-pitta':
    case 'pitta-vata':
      return 'The Dynamic Creator';
    case 'pitta-kapha':
    case 'kapha-pitta':
      return 'The Strategic Builder';
    case 'vata-kapha':
    case 'kapha-vata':
      return 'The Calm Innovator';
    default:
      return 'Balanced Soul';
  }
};

const formatDominantLabel = (result) => {
  if (!result) return 'Your Prakriti';
  return String(result)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('-');
};

const resolvePrakritiImage = (result) => {
  if (!result) return undefined;
  const raw = String(result).trim();
  if (PRAKRITI_IMAGES[raw]) return PRAKRITI_IMAGES[raw];
  const titled = raw
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('-');
  const match = Object.entries(PRAKRITI_IMAGES).find(
    ([key]) =>
      key.toLowerCase() === raw.toLowerCase() ||
      key.toLowerCase() === titled.toLowerCase(),
  );
  return match?.[1];
};

const DOSHA_META = {
  vata: { color: '#2563EB', soft: '#EFF6FF', icon: 'bolt' },
  pitta: { color: '#F59E0B', soft: '#FFFBEB', icon: 'flame' },
  kapha: { color: '#0EA5E9', soft: '#F0F9FF', icon: 'leaf' },
};

export const formatPrakritiData = (apiData) => {
  const dominantType = apiData?.result || '';
  const doshas = [
    {
      id: 1,
      key: 'vata',
      name: 'VATA',
      label: 'Air & Space',
      percentage: Number(apiData?.vata) || 0,
      ...DOSHA_META.vata,
    },
    {
      id: 2,
      key: 'pitta',
      name: 'PITTA',
      label: 'Fire & Water',
      percentage: Number(apiData?.pitta) || 0,
      ...DOSHA_META.pitta,
    },
    {
      id: 3,
      key: 'kapha',
      name: 'KAPHA',
      label: 'Earth & Water',
      percentage: Number(apiData?.kapha) || 0,
      ...DOSHA_META.kapha,
    },
  ];
  return {
    dominantType,
    dominantLabel: formatDominantLabel(dominantType),
    imageUrl: resolvePrakritiImage(dominantType),
    doshas,
    coreEssence: {
      title: getDynamicTitle(dominantType),
      description: apiData?.content?.core_essence || '',
    },
    lifestyleGuidelines: {
      doList: apiData?.content?.lifestyle?.["do's"] || [],
      dontList: apiData?.content?.lifestyle?.["don'ts"] || [],
    },
  };
};

export const hasValidPrakritiPayload = (response) => {
  if (!response || response.success !== true || !response?.data?.result) {
    return false;
  }
  const apiData = response?.data;
  const hasResult = Boolean(apiData?.result);
  const hasDoshas = [apiData?.vata, apiData?.pitta, apiData?.kapha].some(
    (value) => value != null && value !== '',
  );
  return hasResult || hasDoshas;
};

const ICON_PATHS = {
  bolt: 'M13 2 4 14h7l-1 8 10-13h-7l1-7z',
  flame: 'M12 3c2 4-3 5-2 10 3-2 6-4 6-8 3 3 5 6 5 9a9 9 0 1 1-18 0c0-4 3-7 9-11z',
  leaf: 'M5 19c8 0 14-6 14-14-8 0-14 6-14 14zm0 0 6-6',
  check: 'm5 12 5 5L20 7',
  x: 'M18 6 6 18M6 6l12 12',
  'circle-check': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M9 12l2 2 4-4',
  'alert-circle': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 8v5 M12 16h.01',
  edit: 'M4 20h4L19 9l-4-4L4 16v4z M13.5 6.5l4 4',
  refresh: 'M4 12a8 8 0 0 1 14-4m2 8a8 8 0 0 1-14 4 M20 4v5h-5 M4 20v-5h5',
  home: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z',
  'arrow-right': 'M5 12h14M13 6l6 6-6 6',
  'arrow-left': 'M19 12H5M11 18l-6-6 6-6',
  'chart-pie': 'M12 3a9 9 0 1 0 9 9h-9V3z M12 3a9 9 0 0 1 9 9',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.6-7 10-7 10z',
};

function Icon({ name, size = 18, color = 'currentColor', strokeWidth = 1.75 }) {
  const d = ICON_PATHS[name];
  if (!d) return null;
  const filled = name === 'bolt';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : 'none'}
      stroke={color}
      strokeWidth={filled ? 0 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

function DoshaMeter({ item, index }) {
  const pct = Math.max(0, Math.min(100, item.percentage));
  return (
    <div className="pk-meter">
      <span className="pk-meter__icon" style={{ background: item.soft, color: item.color }}>
        <Icon name={item.icon} size={16} color={item.color} />
      </span>
      <div className="pk-meter__body">
        <div className="pk-meter__top">
          <div className="pk-meter__names">
            <span className="pk-meter__name">{item.name}</span>
            <span className="pk-meter__label">{item.label}</span>
          </div>
          <span className="pk-meter__pct" style={{ color: item.color }}>
            {item.percentage}%
          </span>
        </div>
        <div className="pk-meter__track">
          <span
            className="pk-meter__fill"
            style={{
              width: `${pct}%`,
              background: item.color,
              animationDelay: `${120 + index * 120}ms`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function GuidelineCard({ title, subtitle, color, soft, icon, data, positive }) {
  if (!Array.isArray(data) || data.length === 0) return null;
  return (
    <section className="pk-guide-card">
      <div className="pk-guide-card__top">
        <span className="pk-guide-card__icon" style={{ background: soft, color }}>
          <Icon name={icon} size={18} color={color} />
        </span>
        <div>
          <h3 style={{ color }}>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>
      <ul>
        {data.map((item, index) => (
          <li key={`${title}-${index}`}>
            <span className="pk-bullet" style={{ background: soft, borderColor: `${color}33`, color }}>
              <Icon name={positive ? 'check' : 'x'} size={12} color={color} />
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function PrakritiProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromAssessment = Boolean(location.state?.fromAssessment);
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasPrakriti, setHasPrakriti] = useState(false);

  const getPrakritiInfo = useCallback(async () => {
    try {
      setLoading(true);
      setHasPrakriti(false);
      setAnalysisData(null);
      let response = await ProfileServices.get_prakriti_info();
      if (!hasValidPrakritiPayload(response) && fromAssessment) {
        await new Promise((resolve) => setTimeout(resolve, 700));
        response = await ProfileServices.get_prakriti_info();
      }
      if (!hasValidPrakritiPayload(response)) {
        setHasPrakriti(false);
        setAnalysisData(null);
        return;
      }
      setAnalysisData(formatPrakritiData(response.data));
      setHasPrakriti(true);
    } catch (error) {
      console.log('prakriti-error', error);
      setHasPrakriti(false);
      setAnalysisData(null);
    } finally {
      setLoading(false);
    }
  }, [fromAssessment]);

  useEffect(() => {
    getPrakritiInfo();
  }, [getPrakritiInfo]);

  const handleGoHome = () => navigate('/home', { replace: true });

  const handleHeaderBack = () => {
    if (fromAssessment) {
      handleGoHome();
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }
    handleGoHome();
  };

  const handleEditAssessment = async () => {
    if (!(await requireAuth('Complete your profile to start prakriti assessment'))) return;
    navigate('/patient-faq', { state: { allowBack: true } });
  };

  const handleStartAssessment = async () => {
    if (!(await requireAuth('Complete your profile to start prakriti assessment'))) return;
    navigate('/patient-faq');
  };

  const handleVikritiAssessment = () => {
    navigate('/assessment', { state: { form: 'medical' } });
  };

  const dominantHighlight = useMemo(() => {
    if (!analysisData?.doshas?.length) return '#0D614E';
    const top = [...analysisData.doshas].sort((a, b) => b.percentage - a.percentage)[0];
    return top?.color || '#0D614E';
  }, [analysisData]);

  const renderHeader = (showEdit) => (
    <header className="pk-top">
      {fromAssessment ? (
        <span className="pk-icon-btn pk-icon-btn--ghost" />
      ) : (
        <button type="button" className="pk-icon-btn" onClick={handleHeaderBack} aria-label="Go back">
          <Icon name="arrow-left" size={18} color="#0D614E" />
        </button>
      )}
      <h1>Prakriti Analysis</h1>
      {showEdit ? (
        <button type="button" className="pk-icon-btn" onClick={handleEditAssessment} aria-label="Edit">
          <Icon name="edit" size={18} color="#0D614E" />
        </button>
      ) : (
        <span className="pk-icon-btn pk-icon-btn--ghost" />
      )}
    </header>
  );

  if (loading) {
    return (
      <section className="pk-page">
        {renderHeader(false)}
        <div className="pk-skel" role="status" aria-label="Loading your Prakriti">
          <div className="pk-skel__hero" />
          <div className="pk-skel__card" />
          <div className="pk-skel__card" />
        </div>
      </section>
    );
  }

  if (!hasPrakriti) {
    return (
      <section className="pk-page">
        {renderHeader(false)}
        <div className="pk-empty">
          <div className="pk-empty__hero">
            <span className="pk-empty__logo">
              <img src={logoImg} alt="" />
            </span>
            <p className="pk-empty__eyebrow">Discover your nature</p>
            <h2>Know your Prakriti</h2>
            <p className="pk-empty__copy">
              A short Ayurvedic assessment reveals your body constitution and unlocks
              personalized diet & lifestyle guidance.
            </p>
          </div>
          <div className="pk-features">
            {[
              { icon: 'chart-pie', title: 'Dosha balance', copy: 'See your Vata, Pitta & Kapha mix' },
              { icon: 'leaf', title: 'Diet guidance', copy: 'Foods that support your constitution' },
              { icon: 'heart', title: 'Daily rituals', copy: "Simple do’s and don’ts for balance" },
            ].map((item) => (
              <div className="pk-feature" key={item.title}>
                <span className="pk-feature__icon">
                  <Icon name={item.icon} size={18} color="#0D614E" />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.copy}</p>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="pk-cta" onClick={handleStartAssessment}>
            Start assessment
            <Icon name="arrow-right" size={18} color="#FFFFFF" />
          </button>
        </div>
      </section>
    );
  }

  const doList = analysisData.lifestyleGuidelines.doList || [];
  const dontList = analysisData.lifestyleGuidelines.dontList || [];

  return (
    <section className="pk-page pk-page--result">
      {renderHeader(true)}

      <div className="pk-hero">
        <div className="pk-hero__badge">
          <Icon name="circle-check" size={14} color="#6EE7B7" />
          <span>{fromAssessment ? 'Assessment complete' : 'Prakriti analysis'}</span>
        </div>
        <div className="pk-hero__main">
          <div className="pk-hero__copy">
            <p className="pk-hero__kicker">Your dominant type</p>
            <h2>{analysisData.dominantLabel}</h2>
            <p className="pk-hero__sub">
              {analysisData.coreEssence.title} · personalized for your balance
            </p>
          </div>
          {analysisData.imageUrl ? (
            <div className="pk-hero__photo">
              <img src={analysisData.imageUrl} alt="" />
            </div>
          ) : (
            <div className="pk-hero__photo pk-hero__photo--fallback" style={{ borderColor: dominantHighlight }}>
              <Icon name="leaf" size={28} color="#FFFFFF" />
            </div>
          )}
        </div>
      </div>

      <div className="pk-stack">
        <section className="pk-doshas">
          <div className="pk-doshas__head">
            <h3>Dosha composition</h3>
            <span>Your unique mix</span>
          </div>
          {analysisData.doshas.map((item, index) => (
            <DoshaMeter key={item.id} item={item} index={index} />
          ))}
        </section>

        <section className="pk-essence">
          <p className="pk-essence__kicker">Core essence</p>
          <h3>{analysisData.coreEssence.title}</h3>
          <p>
            {analysisData.coreEssence.description ||
              'Your constitution guides how you digest, think, and restore. Follow the rituals below to stay in balance.'}
          </p>
        </section>

        <div className="pk-guide-head">
          <div>
            <h3>Lifestyle guidelines</h3>
            <p>Built around your {analysisData.dominantLabel} nature</p>
          </div>
          <span className="pk-pill">For you</span>
        </div>

        <div className="pk-guides">
          <GuidelineCard
            title="Daily rituals"
            subtitle="Support balance every day"
            color="#0D614E"
            soft="#ECF8F3"
            icon="circle-check"
            positive
            data={doList}
          />
          <GuidelineCard
            title="Things to ease"
            subtitle="Reduce friction for your dosha"
            color="#EA580C"
            soft="#FFF7ED"
            icon="alert-circle"
            data={dontList}
          />
        </div>

        <div className="pk-secondary">
          <button type="button" className="pk-ghost" onClick={handleEditAssessment}>
            <Icon name="refresh" size={16} color="#0D614E" />
            Retake assessment
          </button>
          <button type="button" className="pk-ghost" onClick={handleGoHome}>
            <Icon name="home" size={16} color="#0D614E" />
            Go to Home
          </button>
        </div>
      </div>

      <div className="pk-sticky">
        <button type="button" className="pk-cta" onClick={handleVikritiAssessment}>
          Vikriti assessment
          <Icon name="arrow-right" size={18} color="#FFFFFF" />
        </button>
      </div>
    </section>
  );
}
