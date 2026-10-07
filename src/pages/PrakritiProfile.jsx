import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import logoImg from '/images/FinalLogo.png';
import { PRAKRITI_IMAGES } from '../questionnaire/configs';
import * as ProfileServices from '../services/profileService';

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
      name: 'VATA',
      label: 'Air & Space',
      percentage: Number(apiData?.vata) || 0,
      color: '#2563EB',
    },
    {
      id: 2,
      name: 'PITTA',
      label: 'Fire & Water',
      percentage: Number(apiData?.pitta) || 0,
      color: '#F59E0B',
    },
    {
      id: 3,
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
  const handleEditAssessment = () =>
    navigate('/patient-faq', { state: { allowBack: true } });
  const handleStartAssessment = () => navigate('/patient-faq');

  const dominantHighlight = useMemo(() => {
    if (!analysisData?.doshas?.length) return '#0D614E';
    const top = [...analysisData.doshas].sort(
      (a, b) => b.percentage - a.percentage,
    )[0];
    return top?.color || '#0D614E';
  }, [analysisData]);

  if (loading) {
    return (
      <section className="prakriti-page">
        <div className="quest-loader">Loading your Prakriti…</div>
      </section>
    );
  }

  if (!hasPrakriti) {
    return (
      <section className="prakriti-page">
        <div className="empty-prakriti">
          <img src={logoImg} alt="Ayurmuni" />
          <h1>Know your Prakriti</h1>
          <p>
            A short Ayurvedic assessment reveals your body constitution and unlocks
            personalized diet & lifestyle guidance.
          </p>
          <button className="cta" type="button" onClick={handleStartAssessment}>
            Start assessment →
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="prakriti-page">
      <header className="policy-head">
        {fromAssessment ? <span /> : (
          <button type="button" className="onboard-back" onClick={() => navigate(-1)}>
            ←
          </button>
        )}
        <h1>Prakriti Analysis</h1>
        <button type="button" onClick={handleEditAssessment}>
          Edit
        </button>
      </header>

      <div className="prakriti-content">
        <div className="prakriti-hero">
          <span className="hero-badge">
            {fromAssessment ? 'Assessment complete' : 'Prakriti analysis'}
          </span>
          <div className="hero-main">
            <div>
              <small>Your dominant type</small>
              <h2>{analysisData.dominantLabel}</h2>
              <p>
                {analysisData.coreEssence.title} · personalized for your balance
              </p>
            </div>
            {analysisData.imageUrl ? (
              <img src={analysisData.imageUrl} alt="" />
            ) : (
              <div className="hero-fallback" style={{ borderColor: dominantHighlight }} />
            )}
          </div>
        </div>

        <div className="prakriti-body">
          <div className="dosha-card">
            <h3>Dosha composition</h3>
            {analysisData.doshas.map((item) => (
              <div className="meter" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.label}</small>
                </div>
                <b style={{ color: item.color }}>{item.percentage}%</b>
                <div className="meter-track">
                  <i style={{ width: `${item.percentage}%`, background: item.color }} />
                </div>
              </div>
            ))}
          </div>

          <div className="essence-card">
            <small>Core essence</small>
            <h3>{analysisData.coreEssence.title}</h3>
            <p>
              {analysisData.coreEssence.description ||
                'Your constitution guides how you digest, think, and restore. Follow the rituals below to stay in balance.'}
            </p>
          </div>

          <div className="guide-card good">
            <h3>Daily rituals</h3>
            <ul>
              {(analysisData.lifestyleGuidelines.doList || []).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="guide-card caution">
            <h3>Things to ease</h3>
            <ul>
              {(analysisData.lifestyleGuidelines.dontList || []).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          <div className="secondary-row">
            <button type="button" onClick={handleEditAssessment}>
              Retake assessment
            </button>
            <button
              type="button"
              onClick={() => navigate('/assessment', { state: { form: 'medical' } })}
            >
              Vikriti assessment
            </button>
          </div>
        </div>
      </div>

      <div className="policy-footer">
        <button className="cta" type="button" onClick={handleGoHome}>
          {fromAssessment ? 'Continue to Home' : 'Go to Home'}
        </button>
      </div>
    </section>
  );
}
