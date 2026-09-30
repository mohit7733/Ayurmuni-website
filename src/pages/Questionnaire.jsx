import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PrakritiNoteModal from '../components/PrakritiNoteModal';
import QuestLayout from '../questionnaire/QuestLayout';
import { QUESTIONNAIRE_SETUP } from '../questionnaire/configs';
import { useQuestionnaireFlow } from '../questionnaire/useQuestionnaireFlow';

export default function Questionnaire({ mode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const noteSeen = Boolean(location.state?.noteSeen);
  const flow = useQuestionnaireFlow(mode);
  const { config } = QUESTIONNAIRE_SETUP[mode];
  const [questReady, setQuestReady] = useState(mode !== 'prakriti' || noteSeen);

  const confirmExit = useCallback(() => {
    const ok = window.confirm(
      `${mode === 'medical' ? 'Exit Health Quest?' : 'Exit Prakriti Quest?'}\nYour progress on this attempt will be lost.`,
    );
    if (ok) {
      if (window.history.length > 1) navigate(-1);
      else navigate('/assessment');
    }
  }, [mode, navigate]);

  if (mode === 'prakriti' && !questReady) {
    return (
      <div className="quest-gate">
        <PrakritiNoteModal
          visible
          onClose={() => navigate(-1)}
          onBegin={() => setQuestReady(true)}
        />
      </div>
    );
  }

  return (
    <QuestLayout flow={flow} config={config} onExit={confirmExit} />
  );
}
