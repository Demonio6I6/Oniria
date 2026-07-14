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
  monthlyAnalysis: uid => `analisisMensual_${uid}`,
  monthlyAnalysisPrivacyConsent: uid => `monthlyAnalysisPrivacyConsent_${uid}`,
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

export const clearUserLocalDataById = async (uid) => {
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

export const clearCurrentUserLocalData = async () =>
  clearUserLocalDataById(getCurrentUserId());

const readProtectedStringById = async (uid, storageKey) => {
  const storedValue = await AsyncStorage.getItem(storageKey);
  if (storedValue === null) return null;

  const { value } = await unprotectStringFromStorage(
    uid,
    storageKey,
    storedValue
  );

  return value;
};

const writeProtectedStringById = async (uid, storageKey, value) => {
  const protectedValue = await protectStringForStorage(uid, storageKey, value);
  await AsyncStorage.setItem(storageKey, protectedValue);
};

const parseJsonOrNull = (value) => {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const isMeaningfulText = (value) => String(value || '').trim().length > 0;

const mergeProfileResponses = (sourceResponses, targetResponses) => {
  if (!sourceResponses || typeof sourceResponses !== 'object') {
    return targetResponses;
  }

  if (!targetResponses || typeof targetResponses !== 'object') {
    return sourceResponses;
  }

  const merged = { ...targetResponses };

  Object.entries(sourceResponses).forEach(([key, value]) => {
    if (!isMeaningfulText(merged[key]) && isMeaningfulText(value)) {
      merged[key] = value;
    }
  });

  return merged;
};

const getRecordMergeKey = (record, index) => {
  if (!record || typeof record !== 'object') return `primitive_${index}`;

  return String(
    record.id ||
      record.dreamId ||
      record.createdAt ||
      record.timestamp ||
      JSON.stringify(record)
  );
};

const mergeRecordArrays = (sourceRecords, targetRecords) => {
  if (!Array.isArray(sourceRecords)) return targetRecords;
  if (!Array.isArray(targetRecords)) return sourceRecords;

  const merged = new Map();

  [...sourceRecords, ...targetRecords].forEach((record, index) => {
    merged.set(getRecordMergeKey(record, index), record);
  });

  return Array.from(merged.values());
};

const pickNewestRecord = (sourceRecord, targetRecord) => {
  if (!targetRecord) return sourceRecord;
  if (!sourceRecord) return targetRecord;

  const sourceCreatedAt = Number(sourceRecord?.createdAt || 0);
  const targetCreatedAt = Number(targetRecord?.createdAt || 0);

  return sourceCreatedAt > targetCreatedAt ? sourceRecord : targetRecord;
};

const mergeStoredValue = (keyName, sourceValue, targetValue) => {
  if (sourceValue === null) return targetValue;
  if (targetValue === null) return sourceValue;

  const sourceJson = parseJsonOrNull(sourceValue);
  const targetJson = parseJsonOrNull(targetValue);

  if (keyName === 'profileResponses') {
    return JSON.stringify(mergeProfileResponses(sourceJson, targetJson));
  }

  if (keyName === 'dreams' || keyName === 'emotions') {
    return JSON.stringify(mergeRecordArrays(sourceJson, targetJson));
  }

  if (keyName === 'monthlyAnalysis') {
    return JSON.stringify(pickNewestRecord(sourceJson, targetJson));
  }

  return targetValue || sourceValue;
};

export const migrateUserLocalDataById = async (sourceUid, targetUid) => {
  if (!sourceUid || !targetUid || sourceUid === targetUid) return false;

  const entries = Object.entries(USER_STORAGE_KEYS);

  for (const [keyName, keyFactory] of entries) {
    const sourceStorageKey = keyFactory(sourceUid);
    const targetStorageKey = keyFactory(targetUid);
    const sourceValue = await readProtectedStringById(
      sourceUid,
      sourceStorageKey
    );

    if (sourceValue === null) continue;

    const targetValue = await readProtectedStringById(
      targetUid,
      targetStorageKey
    );
    const mergedValue = mergeStoredValue(keyName, sourceValue, targetValue);

    if (mergedValue !== null) {
      await writeProtectedStringById(targetUid, targetStorageKey, mergedValue);
    }
  }

  await clearUserLocalDataById(sourceUid);
  return true;
};
