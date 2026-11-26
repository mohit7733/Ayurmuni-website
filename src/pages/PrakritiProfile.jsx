import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronLeft,
  Droplet,
  Flower2,
  Heart,
  Home,
  Leaf,
  PieChart,
  RefreshCw,
  Share2,
  Sparkles,
  Sun,
  X,
  Zap,
} from 'lucide-react';
import logoImg from '/images/FinalLogo.webp';
import { buildVikritiFromMedicalHistory } from '../content/vikriti';
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
  vata: { color: '#0d614e', soft: '#e8f3ef' },
  pitta: { color: '#1c7c4f', soft: '#e8f5ee' },
  kapha: { color: '#3d6b5c', soft: '#eef3f1' },
};

const DOSHA_ICONS = { vata: Zap, pitta: Droplet, kapha: Leaf };

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
    vikriti: buildVikritiFromMedicalHistory(
      apiData?.medical_history || apiData?.medicalHistory,
    ),
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

function DoshaMeter({ item, index }) {
  const pct = Math.max(0, Math.min(100, item.percentage));
  const IconCmp = DOSHA_ICONS[item.key] || Leaf;
  return (
    <div className="pk-meter">
      <span className="pk-meter__icon">
        <IconCmp size={16} strokeWidth={2} aria-hidden="true" />
      </span>
      <div className="pk-meter__body">
        <div className="pk-meter__top">
          <div className="pk-meter__names">
            <span className="pk-meter__name">{item.name}</span>
            <span className="pk-meter__label">{item.label}</span>
          </div>
          <span className="pk-meter__pct">{item.percentage}%</span>
        </div>
        <div className="pk-meter__track">
          <span
            className="pk-meter__fill"
            style={{ width: `${pct}%`, animationDelay: `${120 + index * 120}ms` }}
          />
        </div>
      </div>
    </div>
  );
}

function GuidelineCard({ title, subtitle, Icon: IconCmp, data, positive, className = '' }) {
  if (!Array.isArray(data) || data.length === 0) return null;
  const BulletIcon = positive ? Check : X;
  return (
    <section className={`pk-guide-card${className ? ` ${className}` : ''}`}>
      <div className="pk-guide-card__top">
        <span className={`pk-guide-card__icon${positive ? '' : ' pk-guide-card__icon--ease'}`}>
          <IconCmp size={15} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>
      <ul>
        {data.map((item, index) => (
          <li key={`${title}-${index}`}>
            <span className={positive ? 'pk-bullet pk-bullet--yes' : 'pk-bullet pk-bullet--no'}>
              <BulletIcon size={positive ? 12 : 11} strokeWidth={positive ? 3 : 2.25} aria-hidden="true" />
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function VikritiResult({ label, item }) {
  return (
    <article className="pk-vik-yours">
      <div className="pk-vik-yours__top">
        <p className="pk-vik-yours__label">{label}</p>
        <span className="pk-vik-yours__badge">
          <Check size={11} strokeWidth={3} aria-hidden="true" />
          Yours
        </span>
      </div>
      <h4>{item.name}</h4>
      <p className="pk-vik-yours__trait">{item.trait}</p>
      <p className="pk-vik-yours__guidance">{item.guidance}</p>
    </article>
  );
}

function VikritiOthers({ label, items }) {
  if (!items.length) return null;
  return (
    <div className="pk-vik-others__col">
      <p className="pk-vik-others__label">{label}</p>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <div className="pk-vik-others__name">
              <strong>{item.name}</strong>
              <span>{item.trait}</span>
            </div>
            <p>{item.guidance}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VikritiSection({ vikriti, justCompleted = false }) {
  if (!vikriti) return null;
  const gutOutcomes = vikriti.gut?.outcomes || [];
  const agniOutcomes = vikriti.agni?.outcomes || [];
  const gutSelected = gutOutcomes.find((item) => item.selected);
  const agniSelected = agniOutcomes.find((item) => item.selected);
  const gutOthers = gutOutcomes.filter((item) => !item.selected);
  const agniOthers = agniOutcomes.filter((item) => !item.selected);
  if (!gutSelected && !agniSelected) return null;

  return (
    <section className="pk-vikriti" aria-label="Vikriti">
      <div className="pk-vikriti__head">
        <span className="pk-vikriti__icon" aria-hidden="true">
          <Heart size={15} strokeWidth={2} />
        </span>
        <div className="pk-vikriti__copy">
          <div className="pk-vikriti__title">
            <h3>Vikriti</h3>
            <span className="pk-pill">
              <Sparkles size={12} strokeWidth={2} aria-hidden="true" />
              {justCompleted ? 'Just completed' : 'Current state'}
            </span>
          </div>
          <p>Your gut and digestion, from the options you chose</p>
        </div>
      </div>

      <div className="pk-vik-results">
        {gutSelected ? <VikritiResult label="Gut constitution" item={gutSelected} /> : null}
        {agniSelected ? <VikritiResult label="Digestive strength" item={agniSelected} /> : null}
      </div>

      {gutOthers.length || agniOthers.length ? (
        <div className="pk-vik-others">
          <p className="pk-vik-others__head">Other types</p>
          <div className="pk-vik-others__grid">
            <VikritiOthers label="Gut constitution" items={gutOthers} />
            <VikritiOthers label="Digestive strength" items={agniOthers} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PrakritiHeader({ hideBack, onBack, onShare, shareNote, title = 'Prakriti Analysis' }) {
  return (
    <header className="pk-head">
      {hideBack ? (
        <span className="pk-head__btn pk-head__btn--ghost" />
      ) : (
        <button type="button" className="pk-head__btn" onClick={onBack} aria-label="Back">
          <ChevronLeft size={18} strokeWidth={2.25} aria-hidden="true" />
        </button>
      )}
      <h1>{title}</h1>
      {onShare ? (
        <button type="button" className="pk-head__btn" onClick={onShare} aria-label="Share">
          <Share2 size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      ) : (
        <span className="pk-head__btn pk-head__btn--ghost" />
      )}
      {shareNote ? (
        <span className="pk-head__note" role="status">
          {shareNote}
        </span>
      ) : null}
    </header>
  );
}

export default function PrakritiProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromAssessment = Boolean(location.state?.fromAssessment);
  const fromMedical = Boolean(location.state?.fromMedical);
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasPrakriti, setHasPrakriti] = useState(false);
  const [shareNote, setShareNote] = useState('');
  const [photoFailed, setPhotoFailed] = useState(false);

  const getPrakritiInfo = useCallback(async () => {
    try {
      setLoading(true);
      setHasPrakriti(false);
      setAnalysisData(null);
      let response = await ProfileServices.get_prakriti_info();
      const arrivedFromFlow = fromAssessment || fromMedical;
      const vikritiMissing = () =>
        hasValidPrakritiPayload(response) &&
        !formatPrakritiData(response.data).vikriti;
      if (
        arrivedFromFlow &&
        (!hasValidPrakritiPayload(response) || (fromMedical && vikritiMissing()))
      ) {
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
  }, [fromAssessment, fromMedical]);

  useEffect(() => {
    getPrakritiInfo();
  }, [getPrakritiInfo]);

  useEffect(() => {
    setPhotoFailed(false);
  }, [analysisData?.imageUrl]);

  const handleGoHome = () => navigate('/home', { replace: true });

  const handleHeaderBack = () => {
    if (fromAssessment || fromMedical) {
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

  const handleShare = async () => {
    const url = window.location.href;
    const title = 'Prakriti Analysis';
    const text = analysisData?.dominantLabel
      ? `My Prakriti is ${analysisData.dominantLabel}`
      : title;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title, text, url });
        return;
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareNote('Link copied');
      window.setTimeout(() => setShareNote(''), 2000);
    } catch {
      setShareNote('');
    }
  };

  const dominantHighlight = useMemo(() => {
    if (!analysisData?.doshas?.length) return '#0D614E';
    const top = [...analysisData.doshas].sort((a, b) => b.percentage - a.percentage)[0];
    return top?.color || '#0D614E';
  }, [analysisData]);

  const renderHeader = (showShare, title) => (
    <PrakritiHeader
      hideBack={false}
      onBack={handleHeaderBack}
      onShare={showShare ? handleShare : null}
      shareNote={showShare ? shareNote : ''}
      title={title}
    />
  );

  if (loading) {
    return (
      <section className="catalog-page pk-page">
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
      <section className="catalog-page pk-page">
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
              { Icon: PieChart, title: 'Dosha balance', copy: 'See your Vata, Pitta & Kapha mix' },
              { Icon: Leaf, title: 'Diet guidance', copy: 'Foods that support your constitution' },
              { Icon: Heart, title: 'Daily rituals', copy: "Simple do’s and don’ts for balance" },
            ].map((item) => (
              <div className="pk-feature" key={item.title}>
                <span className="pk-feature__icon">
                  <item.Icon size={18} strokeWidth={1.8} aria-hidden="true" />
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
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </section>
    );
  }

  const doList = analysisData.lifestyleGuidelines.doList || [];
  const dontList = analysisData.lifestyleGuidelines.dontList || [];
  const showVikriti = !fromAssessment && Boolean(analysisData.vikriti);
  const showPrakriti = !fromMedical || !showVikriti;
  const pageTitle = showVikriti && !showPrakriti ? 'Vikriti' : 'Prakriti Analysis';

  return (
    <section className="catalog-page pk-page pk-page--result">
      {renderHeader(true, pageTitle)}

      <div className={`pk-board${showPrakriti ? '' : ' pk-board--vikriti'}`}>
      {showPrakriti ? (
      <>
      <div className="pk-layout">
        <div className="pk-hero">
          <div className="pk-hero__badge">
            <BarChart3 size={13} strokeWidth={2.2} aria-hidden="true" />
            <span>{fromAssessment ? 'Assessment complete' : 'Prakriti analysis'}</span>
          </div>
          <div className="pk-hero__main">
            <div className="pk-hero__copy">
              <p className="pk-hero__kicker">Your dominant type</p>
              <h2>{analysisData.dominantLabel}</h2>
              <p className="pk-hero__sub">
                {analysisData.coreEssence.title} • personalized for your balance
              </p>
            </div>
            <div className="pk-hero__art">
              {analysisData.imageUrl && !photoFailed ? (
                <div className="pk-hero__photo">
                  <img src={analysisData.imageUrl} alt="" onError={() => setPhotoFailed(true)} />
                </div>
              ) : (
                <div className="pk-hero__photo pk-hero__photo--fallback" style={{ borderColor: dominantHighlight }}>
                  <Leaf size={36} aria-hidden="true" />
                </div>
              )}
            </div>
          </div>
        </div>

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
          <span className="pk-essence__icon" aria-hidden="true">
            <Leaf size={16} strokeWidth={2} />
          </span>
          <div className="pk-essence__copy">
            <p className="pk-essence__kicker">Core essence</p>
            <h3>{analysisData.coreEssence.title}</h3>
            <p>
              {analysisData.coreEssence.description ||
                'Your constitution guides how you digest, think, and restore. Follow the rituals below to stay in balance.'}
            </p>
          </div>
        </section>
      </div>

        <section className="pk-guide" aria-label="Lifestyle guidelines">
          <div className="pk-guide-head">
            <span className="pk-guide-head__icon" aria-hidden="true">
              <Leaf size={15} strokeWidth={2} />
            </span>
            <div className="pk-guide-head__copy">
              <div className="pk-guide-head__title">
                <h3>Lifestyle guidelines</h3>
                <span className="pk-pill">
                  <Sparkles size={12} strokeWidth={2} aria-hidden="true" />
                  For you
                </span>
              </div>
              <p>Built around your {analysisData.dominantLabel} nature</p>
            </div>
          </div>
          <div className="pk-guides">
            <GuidelineCard
              className="pk-guide-card--do"
              title="Daily rituals"
              subtitle="Support balance every day"
              Icon={Sun}
              positive
              data={doList}
            />
            <GuidelineCard
              className="pk-guide-card--ease"
              title="Things to ease"
              subtitle="Reduce friction for your dosha"
              Icon={Flower2}
              data={dontList}
            />
          </div>
        </section>
      </>
      ) : null}

        {showVikriti ? (
          <VikritiSection vikriti={analysisData.vikriti} justCompleted={fromMedical} />
        ) : null}
      </div>

        <div className="pk-end">
          <button type="button" className="pk-ghost" onClick={handleEditAssessment}>
            <RefreshCw size={15} aria-hidden="true" />
            Retake assessment
          </button>
          <button type="button" className="pk-ghost" onClick={handleGoHome}>
            <Home size={15} aria-hidden="true" />
            Go to Home
          </button>
          <button type="button" className="pk-cta" onClick={handleVikritiAssessment}>
            {analysisData.vikriti ? 'Retake Vikriti assessment' : 'Vikriti assessment'}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
    </section>
  );
}
