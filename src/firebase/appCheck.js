import { Platform } from 'react-native';
import { getApp as getNativeApp } from '@react-native-firebase/app';
import {
  getToken as getNativeAppCheckToken,
  initializeAppCheck as initializeNativeAppCheck,
  ReactNativeFirebaseAppCheckProvider,
} from '@react-native-firebase/app-check';
import {
  CustomProvider,
  initializeAppCheck as initializeWebAppCheck,
} from 'firebase/app-check';
import { app } from './config';

const APP_CHECK_TOKEN_FALLBACK_TTL_MS = 50 * 60 * 1000;

let appCheckInitializationPromise = null;

const getJwtExpirationMillis = (token) => {
  try {
    const encodedPayload = String(token || '').split('.')[1];
    if (!encodedPayload || typeof globalThis.atob !== 'function') {
      return Date.now() + APP_CHECK_TOKEN_FALLBACK_TTL_MS;
    }

    const normalizedPayload = encodedPayload
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(
      Math.ceil(normalizedPayload.length / 4) * 4,
      '='
    );
    const payload = JSON.parse(globalThis.atob(paddedPayload));
    const expirationMillis = Number(payload?.exp) * 1000;

    return Number.isFinite(expirationMillis)
      ? expirationMillis
      : Date.now() + APP_CHECK_TOKEN_FALLBACK_TTL_MS;
  } catch {
    return Date.now() + APP_CHECK_TOKEN_FALLBACK_TTL_MS;
  }
};

const initializeAppCheckBridge = async () => {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    throw new Error('App Check solo está configurado para Android e iOS.');
  }

  const useDebugProvider =
    __DEV__ || process.env.EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG === 'true';
  const nativeProvider = new ReactNativeFirebaseAppCheckProvider();

  nativeProvider.configure({
    android: {
      provider: useDebugProvider ? 'debug' : 'playIntegrity',
    },
    apple: {
      provider: useDebugProvider
        ? 'debug'
        : 'appAttestWithDeviceCheckFallback',
    },
  });

  const nativeAppCheck = await initializeNativeAppCheck(getNativeApp(), {
    provider: nativeProvider,
    isTokenAutoRefreshEnabled: true,
  });
  const bridgeProvider = new CustomProvider({
    getToken: async () => {
      const { token } = await getNativeAppCheckToken(nativeAppCheck, false);

      if (!token) {
        throw new Error('Firebase App Check no devolvió un token válido.');
      }

      return {
        token,
        expireTimeMillis: getJwtExpirationMillis(token),
      };
    },
  });

  return initializeWebAppCheck(app, {
    provider: bridgeProvider,
    isTokenAutoRefreshEnabled: true,
  });
};

export const ensureAppCheckReady = () => {
  if (!appCheckInitializationPromise) {
    appCheckInitializationPromise = initializeAppCheckBridge().catch(error => {
      appCheckInitializationPromise = null;
      console.error('No se pudo inicializar Firebase App Check:', error);
      throw error;
    });
  }

  return appCheckInitializationPromise;
};
