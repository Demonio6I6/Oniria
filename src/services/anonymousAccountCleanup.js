import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase/config';

const REGION = 'europe-west1';
const functions = getFunctions(app, REGION);

export const deleteAnonymousAccountData = async () => {
  const callable = httpsCallable(functions, 'deleteAnonymousUserData', {
    timeout: 120000,
  });

  const result = await callable({});
  return result.data;
};
