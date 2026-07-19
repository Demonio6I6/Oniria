import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase/config';

const functions = getFunctions(app, 'europe-west1');
const deleteUserAccountCallable = httpsCallable(
  functions,
  'deleteUserAccountData',
  { timeout: 120000 }
);

export const deleteRemoteUserAccount = async () => {
  const result = await deleteUserAccountCallable({});
  return result.data;
};
