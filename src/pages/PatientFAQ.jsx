import Questionnaire from './Questionnaire';

/** Prakriti assessment — public entry (footer / nav). APIs still need a session when answering. */
export default function PatientFAQ() {
  return <Questionnaire mode="prakriti" />;
}
