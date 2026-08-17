import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './config';
import { ensureAppCheckReady } from './appCheck';

const REGION = 'europe-west1';
const functions = getFunctions(app, REGION);

export const createProtectedCallable = (name, options) => {
  const callable = httpsCallable(functions, name, options);

  return async (data = {}) => {
    await ensureAppCheckReady();
    return callable(data);
  };
};
