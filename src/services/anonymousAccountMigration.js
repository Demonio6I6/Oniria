import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase/config';

const REGION = 'europe-west1';
const functions = getFunctions(app, REGION);
const migrateAnonymousServerStateCallable = httpsCallable(
  functions,
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
