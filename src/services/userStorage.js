import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth } from 'firebase/auth';
import {
  deleteUserEncryptionKey,
  protectStringForStorage,
  unprotectStringFromStorage,
} from './secureStorage';

export const USER_STORAGE_KEYS = {
  profileResponses: uid => `respuestas_${uid}`,
  dreams: uid => `suenosGuardados_${uid}`,
  emotions: uid => `emocionesGuardadas_${uid}`,
  aiPrivacyConsent: uid => `aiPrivacyConsent_${uid}`,
};

const LEGACY_USER_STORAGE_KEYS = [
  uid => `diarioPassword_${uid}`,
  uid => `diarioContent_${uid}`,
];

export const getCurrentUser = () => getAuth().currentUser;

export const getCurrentUserId = () => getCurrentUser()?.uid || null;

const resolveUserStorageKey = (keyFactory) => {
  const uid = getCurrentUserId();
  return uid ? { uid, storageKey: keyFactory(uid) } : null;
};

export const readUserString = async (keyFactory, fallbackValue = null) => {
  const resolved = resolveUserStorageKey(keyFactory);
  if (!resolved) return fallbackValue;

  const storedValue = await AsyncStorage.getItem(resolved.storageKey);
  if (storedValue === null) return fallbackValue;

  const { value, needsMigration } = await unprotectStringFromStorage(
    resolved.uid,
    resolved.storageKey,
    storedValue
  );

  if (needsMigration) {
    const protectedValue = await protectStringForStorage(
      resolved.uid,
      resolved.storageKey,
      value
    );
    await AsyncStorage.setItem(resolved.storageKey, protectedValue);
  }

  return value;
};

export const writeUserString = async (keyFactory, value) => {
  const resolved = resolveUserStorageKey(keyFactory);
  if (!resolved) return false;

  const protectedValue = await protectStringForStorage(
    resolved.uid,
    resolved.storageKey,
    value
  );
  await AsyncStorage.setItem(resolved.storageKey, protectedValue);
  return true;
};

export const readUserJson = async (keyFactory, fallbackValue) => {
  const storedValue = await readUserString(keyFactory, null);

  if (!storedValue) return fallbackValue;

  try {
    return JSON.parse(storedValue);
  } catch (error) {
    console.error('No se pudo leer un valor local protegido:', error);
    return fallbackValue;
  }
};

export const writeUserJson = async (keyFactory, value) => {
  return writeUserString(keyFactory, JSON.stringify(value));
};

export const readUserArray = async (keyFactory) => {
  const storedValue = await readUserJson(keyFactory, []);
  return Array.isArray(storedValue) ? storedValue : [];
};

export const clearCurrentUserLocalData = async () => {
  const uid = getCurrentUserId();
  if (!uid) return false;

  const storageKeys = [
    ...Object.values(USER_STORAGE_KEYS),
    ...LEGACY_USER_STORAGE_KEYS,
  ]
    .map(keyFactory => keyFactory(uid));

  await AsyncStorage.multiRemove(storageKeys);
  await deleteUserEncryptionKey(uid);
  return true;
};
