import { createProtectedCallable } from '../firebase/callable';

const migrateAnonymousServerStateCallable = createProtectedCallable(
  'migrateAnonymousServerState',
  { timeout: 120000 }
);

export const migrateAnonymousServerState = async (anonymousIdToken) => {
  if (!anonymousIdToken) return { migrated: false };
  const result = await migrateAnonymousServerStateCallable({
    anonymousIdToken,
  });
  return result.data;
};
