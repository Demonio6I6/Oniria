import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase/config';

const functions = getFunctions(app, 'europe-west1');
const reportAiContentCallable = httpsCallable(
  functions,
  'reportAiContent',
  { timeout: 15000 }
);

export const reportAiContent = async ({ content, feature, reason }) => {
  const result = await reportAiContentCallable({
    content: String(content || '').trim(),
    feature,
    reason,
  });

  return result.data;
};
