import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './config';
import { ensureAppCheckReady } from './appCheck';
import { runWithPerformanceTrace } from '../services/telemetry';

const REGION = 'europe-west1';
const functions = getFunctions(app, REGION);

export const createProtectedCallable = (name, options) => {
  const callable = httpsCallable(functions, name, options);

  return async (data = {}) => {
    return runWithPerformanceTrace(
      `callable_${name}`,
      async () => {
        await ensureAppCheckReady();
        return callable(data);
      },
      { region: REGION }
    );
  };
};
