import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase/config';

const REGION = 'europe-west1';
const functions = getFunctions(app, REGION);
const trackProductEventCallable = httpsCallable(
  functions,
  'trackProductEvent',
  { timeout: 15000 }
);

export const trackProductEvent = async (name, properties = {}) => {
  try {
    await trackProductEventCallable({ name, properties });
    return true;
  } catch (error) {
    console.warn(`No se pudo registrar el evento ${name}:`, error);
    return false;
  }
};
