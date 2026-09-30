import * as AssessService from '../services/assessmentService';

export const fetchQuestions = (experienceType) =>
  AssessService.GetQuestionOptions({ experience_type: experienceType });

export const submitKnowPrakriti = (doesKnow) =>
  AssessService.KnowPrakritiSubmit({ does_know_prakriti: doesKnow });

export const submitPrakritiType = (answer) =>
  AssessService.AssesmentYesSubmit({ answer });

export const submitQuestionnaire = (experienceType, answers) =>
  AssessService.QuestionnaireSubmit({
    experience_type: experienceType,
    answers,
  });
