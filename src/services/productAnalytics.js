import { createProtectedCallable } from '../firebase/callable';

const trackProductEventCallable = createProtectedCallable(
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
