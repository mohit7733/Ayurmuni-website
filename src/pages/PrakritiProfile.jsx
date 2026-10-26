import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import logoImg from '/images/FinalLogo.webp';
import { PRAKRITI_IMAGES } from '../questionnaire/configs';
import * as ProfileServices from '../services/profileService';
import { requireAuth } from '../services/guestAuth';
import { ElementIcon, Lotus, Mandala, Ornament } from '../components/LuxuryOrnaments';
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

const formatPrakritiData = (apiData) => {
  const dominantType = apiData?.result || '';
  const doshas = [
    {
      id: 1,
      key: 'vata',
      name: 'VATA',
      label: 'Air & Space',
      percentage: Number(apiData?.vata) || 0,
      color: '#2563EB',
    },
    {
      id: 2,
      key: 'pitta',
      name: 'PITTA',
      label: 'Fire & Water',
      percentage: Number(apiData?.pitta) || 0,
      color: '#F59E0B',
    },
    {
      id: 3,
      key: 'kapha',
      name: 'KAPHA',
      label: 'Earth & Water',
      percentage: Number(apiData?.kapha) || 0,
      color: '#0EA5E9',
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

const hasValidPrakritiPayload = (response) => {
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

function Stage({ children }) {
  return (
    <section className="pk-page">
      <div className="pk-backdrop" aria-hidden>
        <Mandala className="pk-mandala" />
        <Mandala className="pk-mandala" />
      </div>
      {children}
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
  // App: both entry points require a complete profile first.
  const handleEditAssessment = async () => {
    if (!(await requireAuth('Complete your profile to start prakriti assessment'))) return;
    navigate('/patient-faq', { state: { allowBack: true } });
  };
  const handleStartAssessment = async () => {
    if (!(await requireAuth('Complete your profile to start prakriti assessment'))) return;
    navigate('/patient-faq');
  };

  const topKey = useMemo(() => {
    if (!analysisData?.doshas?.length) return '';
    return [...analysisData.doshas].sort((a, b) => b.percentage - a.percentage)[0]?.key || '';
  }, [analysisData]);

  if (loading) {
    return (
      <Stage>
        <div className="pk-loader" role="status">
          <span className="pk-loader__seal">
            <Lotus />
          </span>
          Loading your Prakriti…
        </div>
      </Stage>
    );
  }

  if (!hasPrakriti) {
    return (
      <Stage>
        <div className="pk-empty pk-card">
          <img src={logoImg} alt="Ayurmuni" />
          <span className="pk-eyebrow">
            PRAKRITI <Ornament />
          </span>
          <h1>Know your Prakriti</h1>
          <p>
            A short Ayurvedic assessment reveals your body constitution and unlocks
            personalized diet & lifestyle guidance.
          </p>
          <button className="pk-cta" type="button" onClick={handleStartAssessment}>
            Start assessment →
          </button>
        </div>
      </Stage>
    );
  }

  const doList = analysisData.lifestyleGuidelines.doList || [];
  const dontList = analysisData.lifestyleGuidelines.dontList || [];

  return (
    <Stage>
      <header className="pk-top">
        {fromAssessment ? (
          <span className="pk-top__spacer" />
        ) : (
          <button type="button" className="pk-icon-btn" onClick={() => navigate(-1)} aria-label="Go back">
            ←
          </button>
        )}
        <h1>Prakriti Analysis</h1>
        <button type="button" className="pk-chip-btn" onClick={handleEditAssessment}>
          Edit
        </button>
      </header>

      <div className="pk-grid">
        <div className="pk-hero pk-card">
          <div className="pk-seal" aria-hidden>
            <span className="pk-seal__rays" />
            <span className="pk-seal__medal">
              {analysisData.imageUrl ? <img src={analysisData.imageUrl} alt="" /> : <Lotus />}
            </span>
          </div>
          <div className="pk-hero__copy">
            <span className="pk-eyebrow">
              {fromAssessment ? 'ASSESSMENT COMPLETE' : 'YOUR DOMINANT TYPE'} <Ornament />
            </span>
            <h2>{analysisData.dominantLabel}</h2>
            <p>
              <strong>{analysisData.coreEssence.title}</strong> · personalized for your balance
            </p>
          </div>
        </div>

        <div className="pk-doshas pk-card">
          <span className="pk-eyebrow">
            DOSHA COMPOSITION <Ornament />
          </span>
          <div className="pk-gauges">
            {analysisData.doshas.map((item) => {
              const pct = Math.max(0, Math.min(100, item.percentage));
              return (
                <div className={`pk-gauge ${item.key === topKey ? 'top' : ''}`} key={item.id}>
                  <div className="pk-gauge__ring" style={{ '--pct': pct }}>
                    <span className={`pk-ico ${item.key}`}>
                      <ElementIcon type={item.key} />
                    </span>
                  </div>
                  <b>{item.percentage}%</b>
                  <strong>{item.name}</strong>
                  <small>{item.label}</small>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pk-essence pk-card">
          <span className="pk-eyebrow">
            CORE ESSENCE <Ornament />
          </span>
          <h3>{analysisData.coreEssence.title}</h3>
          <p>
            {analysisData.coreEssence.description ||
              'Your constitution guides how you digest, think, and restore. Follow the rituals below to stay in balance.'}
          </p>
        </div>

        {doList.length ? (
          <div className="pk-list pk-card good">
            <span className="pk-eyebrow">
              DAILY RITUALS <Ornament />
            </span>
            <ul>
              {doList.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {dontList.length ? (
          <div className="pk-list pk-card ease">
            <span className="pk-eyebrow">
              THINGS TO EASE <Ornament />
            </span>
            <ul>
              {dontList.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="pk-actions">
        <button type="button" className="pk-ghost" onClick={handleEditAssessment}>
          Retake assessment
        </button>
        <button
          type="button"
          className="pk-ghost"
          onClick={() => navigate('/assessment', { state: { form: 'medical' } })}
        >
          Vikriti assessment
        </button>
        <button className="pk-cta" type="button" onClick={handleGoHome}>
          {fromAssessment ? 'Continue to Home' : 'Go to Home'}
        </button>
      </div>
    </Stage>
  );
}
