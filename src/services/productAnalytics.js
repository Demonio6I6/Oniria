import { createProtectedCallable } from '../firebase/callable';
import {
  getTelemetryConsent,
  trackProductAnalyticsEvent,
} from './telemetry';

const trackProductEventCallable = createProtectedCallable(
  'trackProductEvent',
  { timeout: 15000 }
);

export const trackProductEvent = async (name, properties = {}) => {
  const consent = await getTelemetryConsent();
  if (consent !== true) return false;

  try {
    const [analyticsResult, serverResult] = await Promise.allSettled([
      trackProductAnalyticsEvent(name, properties),
      trackProductEventCallable({ name, properties }),
    ]);

    if (serverResult.status === 'rejected') {
      console.warn(
        `No se pudo registrar el evento ${name} en el servidor:`,
        serverResult.reason
      );
    }

    return serverResult.status === 'fulfilled' ||
      (analyticsResult.status === 'fulfilled' && analyticsResult.value === true);
  } catch (error) {
    console.warn(`No se pudo registrar el evento ${name}:`, error);
    return false;
  }
};
