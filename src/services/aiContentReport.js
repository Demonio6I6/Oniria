import { createProtectedCallable } from '../firebase/callable';

const reportAiContentCallable = createProtectedCallable(
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
