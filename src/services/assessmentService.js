import { apiClient } from './apiClient';

export const GetQuestionOptions = async (data) => {
  return apiClient('customers/questionnaires/questions/list/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const KnowPrakritiSubmit = async (data) => {
  return apiClient('customers/initiate_onboarding/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const QuestionnaireSubmit = async (data) => {
  return apiClient('customers/questionnaires/responses/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const AssesmentYesSubmit = async (data) => {
  return apiClient('customers/answer_prakriti/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const SkipAssesment = async (data) => {
  return apiClient('customers/initiate_onboarding/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};
