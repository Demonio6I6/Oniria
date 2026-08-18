import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  getAnalytics,
  logEvent,
  logScreenView,
  setAnalyticsCollectionEnabled,
  setConsent,
  setUserProperty,
} from '@react-native-firebase/analytics';
import {
  getCrashlytics,
  log as logCrashBreadcrumb,
  recordError,
  setAttributes,
  setCrashlyticsCollectionEnabled,
} from '@react-native-firebase/crashlytics';
import {
  getPerformance,
  startScreenTrace,
  trace as createPerformanceTrace,
} from '@react-native-firebase/perf';

const TELEMETRY_CONSENT_KEY = 'lunentra.telemetry-consent.v1';
const CONSENT_GRANTED = 'granted_v1';
const CONSENT_DENIED = 'denied_v1';
const NATIVE_PLATFORM = Platform.OS === 'android' || Platform.OS === 'ios';

const SCREEN_NAMES = {
  Home: 'home',
  NuevoSueno: 'dream_interpretation',
  Perfil: 'profile',
  SuenosGuardados: 'dream_history',
  DiagramaEmocional: 'emotional_patterns',
  DetalleSueno: 'dream_detail',
  Cuenta: 'account',
  PlanPremium: 'premium_plan',
  Configuracion: 'settings',
};

let telemetryConsent = null;
let telemetryInitializationPromise = null;
let activeScreenTrace = null;
let latestUserProperties = {};

const sanitizeName = (value, maxLength = 40) =>
  String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
    .slice(0, maxLength);

const sanitizeParameterValue = value => {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') return value.slice(0, 100);
  return undefined;
};

const sanitizeParameters = properties => Object.fromEntries(
  Object.entries(properties || {})
    .map(([key, value]) => [
      sanitizeName(key),
      sanitizeParameterValue(value),
    ])
    .filter(([key, value]) => key && value !== undefined)
    .slice(0, 25)
);

const readStoredConsent = async () => {
  const storedValue = await AsyncStorage.getItem(TELEMETRY_CONSENT_KEY);
  if (storedValue === CONSENT_GRANTED) return true;
  if (storedValue === CONSENT_DENIED) return false;
  return null;
};

const applyAnalyticsConsent = async enabled => {
  if (!NATIVE_PLATFORM) return;

  const analytics = getAnalytics();
  await setConsent(analytics, {
    ad_personalization: false,
    ad_storage: false,
    ad_user_data: false,
    analytics_storage: enabled,
    functionality_storage: true,
    personalization_storage: false,
    security_storage: 'granted',
  });
  await setAnalyticsCollectionEnabled(analytics, enabled);
};

const applyTelemetryCollectionState = async enabled => {
  if (!NATIVE_PLATFORM) return;

  const performance = getPerformance();
  performance.dataCollectionEnabled = enabled;
  if (Platform.OS === 'ios') {
    performance.instrumentationEnabled = enabled;
  }

  await Promise.allSettled([
    applyAnalyticsConsent(enabled),
    setCrashlyticsCollectionEnabled(getCrashlytics(), enabled),
  ]);
};

const applyUserProperties = async () => {
  if (!NATIVE_PLATFORM || telemetryConsent !== true) return;

  const analytics = getAnalytics();
  const normalizedProperties = sanitizeParameters(latestUserProperties);
  await Promise.allSettled(
    Object.entries(normalizedProperties).map(([key, value]) =>
      setUserProperty(analytics, key.slice(0, 24), String(value))
    )
  );
  await setAttributes(
    getCrashlytics(),
    Object.fromEntries(
      Object.entries(normalizedProperties).map(([key, value]) => [
        key.slice(0, 40),
        String(value).slice(0, 100),
      ])
    )
  ).catch(() => null);
};

export const initializeTelemetry = async () => {
  if (!telemetryInitializationPromise) {
    telemetryInitializationPromise = (async () => {
      telemetryConsent = await readStoredConsent();
      await applyTelemetryCollectionState(telemetryConsent === true);
      await applyUserProperties();
      return telemetryConsent;
    })().catch(error => {
      telemetryInitializationPromise = null;
      console.warn('No se pudo inicializar la medición de la app:', error);
      return null;
    });
  }

  return telemetryInitializationPromise;
};

export const getTelemetryConsent = async () => {
  if (!telemetryInitializationPromise) {
    return initializeTelemetry();
  }

  await telemetryInitializationPromise;
  return telemetryConsent;
};

export const setTelemetryConsent = async enabled => {
  const nextConsent = Boolean(enabled);
  await AsyncStorage.setItem(
    TELEMETRY_CONSENT_KEY,
    nextConsent ? CONSENT_GRANTED : CONSENT_DENIED
  );
  telemetryConsent = nextConsent;
  telemetryInitializationPromise = Promise.resolve(nextConsent);
  await applyTelemetryCollectionState(nextConsent);

  if (nextConsent) {
    await applyUserProperties();
    await trackAnalyticsEvent('telemetry_consent_updated', {
      analytics_enabled: true,
    });
  } else if (activeScreenTrace) {
    await activeScreenTrace.stop().catch(() => null);
    activeScreenTrace = null;
  }

  return nextConsent;
};

export const resetTelemetryConsent = async () => {
  await AsyncStorage.removeItem(TELEMETRY_CONSENT_KEY);
  telemetryConsent = null;
  telemetryInitializationPromise = Promise.resolve(null);
  await applyTelemetryCollectionState(false);
  return null;
};

export const setTelemetryUserProperties = async properties => {
  latestUserProperties = {
    ...latestUserProperties,
    ...properties,
  };
  await applyUserProperties();
};

export const trackAnalyticsEvent = async (name, properties = {}) => {
  if (!NATIVE_PLATFORM || telemetryConsent !== true) return false;

  const eventName = sanitizeName(name);
  if (!eventName) return false;

  await logEvent(
    getAnalytics(),
    eventName,
    sanitizeParameters(properties)
  );
  return true;
};

export const trackProductAnalyticsEvent = async (name, properties = {}) => {
  if (!NATIVE_PLATFORM || telemetryConsent !== true) return false;

  const tasks = [trackAnalyticsEvent(name, properties)];
  if (name === 'account_conversion_completed') {
    tasks.push(
      logEvent(getAnalytics(), 'sign_up', {
        method: String(properties.method || 'account_conversion').slice(0, 100),
      })
    );
  }

  logCrashBreadcrumb(getCrashlytics(), `product_event:${sanitizeName(name)}`);
  await Promise.allSettled(tasks);
  return true;
};

export const trackScreen = async routeName => {
  if (!NATIVE_PLATFORM || telemetryConsent !== true) return false;

  const screenName = SCREEN_NAMES[routeName] || sanitizeName(routeName, 100);
  if (!screenName) return false;

  await logScreenView(getAnalytics(), {
    screen_class: String(routeName || screenName).slice(0, 100),
    screen_name: screenName,
  });
  logCrashBreadcrumb(getCrashlytics(), `screen:${screenName}`);

  if (Platform.OS === 'android') {
    if (activeScreenTrace) {
      await activeScreenTrace.stop().catch(() => null);
    }
    activeScreenTrace = await startScreenTrace(
      getPerformance(),
      screenName
    ).catch(() => null);
  }

  return true;
};

export const recordTelemetryError = (error, context = {}) => {
  if (!NATIVE_PLATFORM || telemetryConsent !== true) return false;

  const operation = sanitizeName(context.operation || 'unknown', 80);
  const code = sanitizeName(error?.code || error?.name || 'unknown', 80);
  const safeError = new Error(`${operation || 'operation'} failed (${code})`);
  safeError.name = 'LunentraNonFatalError';

  if (error?.stack) {
    const stackLines = String(error.stack).split('\n').slice(1);
    safeError.stack = `${safeError.name}: ${safeError.message}\n${stackLines.join('\n')}`;
  }

  recordError(getCrashlytics(), safeError, operation || undefined);
  return true;
};

export const runWithPerformanceTrace = async (
  name,
  operation,
  attributes = {}
) => {
  if (!NATIVE_PLATFORM || telemetryConsent !== true) {
    return operation();
  }

  const traceName = sanitizeName(name, 100);
  const performanceTrace = createPerformanceTrace(
    getPerformance(),
    traceName || 'operation'
  );
  Object.entries(sanitizeParameters(attributes)).forEach(([key, value]) => {
    performanceTrace.putAttribute(key.slice(0, 40), String(value).slice(0, 100));
  });
  await performanceTrace.start();

  try {
    const result = await operation();
    performanceTrace.putAttribute('outcome', 'success');
    return result;
  } catch (error) {
    performanceTrace.putAttribute('outcome', 'error');
    recordTelemetryError(error, { operation: traceName });
    throw error;
  } finally {
    await performanceTrace.stop().catch(() => null);
  }
};
