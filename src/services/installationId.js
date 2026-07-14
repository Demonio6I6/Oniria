import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const SECURE_KEY = 'lunentra.installation-id.v1';
const FALLBACK_KEY = 'lunentra_installation_id_v1';
let cachedInstallationId = '';

const bytesToHex = (bytes) =>
  Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');

const createInstallationId = async () =>
  bytesToHex(await Crypto.getRandomBytesAsync(24));

export const getInstallationId = async () => {
  if (cachedInstallationId) return cachedInstallationId;

  const secureStoreAvailable = await SecureStore.isAvailableAsync()
    .catch(() => false);
  let installationId = secureStoreAvailable
    ? await SecureStore.getItemAsync(SECURE_KEY).catch(() => '')
    : await AsyncStorage.getItem(FALLBACK_KEY).catch(() => '');

  if (!installationId) {
    installationId = await createInstallationId();
    if (secureStoreAvailable) {
      await SecureStore.setItemAsync(SECURE_KEY, installationId);
    } else {
      await AsyncStorage.setItem(FALLBACK_KEY, installationId);
    }
  }

  cachedInstallationId = installationId;
  return installationId;
};
