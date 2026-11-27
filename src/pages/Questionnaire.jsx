import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PrakritiNoteModal from '../components/PrakritiNoteModal';
import { Button, Modal } from '../components/ui';
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
  const [exitOpen, setExitOpen] = useState(false);

  const exitTitle = mode === 'medical' ? 'Exit Health Quest?' : 'Exit Prakriti Quest?';

  const leaveQuest = useCallback(() => {
    setExitOpen(false);
    if (window.history.length > 1) navigate(-1);
    else navigate('/assessment');
  }, [navigate]);

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
    <>
      <QuestLayout flow={flow} config={config} onExit={() => setExitOpen(true)} />
      <Modal
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        title={exitTitle}
        description="Your progress on this attempt will be lost."
        footer={
          <>
            <Button variant="secondary" onClick={() => setExitOpen(false)}>
              Stay
            </Button>
            <Button variant="danger" onClick={leaveQuest}>
              Exit Quest
            </Button>
          </>
        }
      />
    </>
  );
}
