import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';

const ENVELOPE_MARKER = '__lunentraEncrypted';
const ENVELOPE_VERSION = 1;
const ALGORITHM = 'XCHACHA20_POLY1305';
const KEY_BYTES = 32;
const NONCE_BYTES = 24;
const KEYCHAIN_SERVICE = 'lunentra.local-data-key';

const keyCache = new Map();
let secureStoreAvailable = null;

const secureStoreOptions = {
  keychainService: KEYCHAIN_SERVICE,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const bytesToHex = (bytes) =>
  Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');

const hexToBytes = (hex) => {
  if (typeof hex !== 'string' || hex.length % 2 !== 0) {
    throw new Error('Valor cifrado corrupto.');
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    const byte = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error('Valor cifrado corrupto.');
    }
    bytes[index] = byte;
  }
  return bytes;
};

const stringToUtf8Bytes = (value) => {
  const encoded = encodeURIComponent(value);
  const bytes = [];

  for (let index = 0; index < encoded.length; index += 1) {
    if (encoded[index] === '%') {
      bytes.push(Number.parseInt(encoded.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(encoded.charCodeAt(index));
    }
  }

  return Uint8Array.from(bytes);
};

const utf8BytesToString = (bytes) => {
  const encoded = Array.from(bytes)
    .map(byte => `%${byte.toString(16).padStart(2, '0')}`)
    .join('');

  return decodeURIComponent(encoded);
};

const getSecureStoreKey = (uid) => `lunentra.encryption-key.${uid}`;

const ensureSecureStoreAvailable = async () => {
  if (secureStoreAvailable === null) {
    secureStoreAvailable = await SecureStore.isAvailableAsync();
  }

  if (!secureStoreAvailable) {
    throw new Error('El almacenamiento seguro no esta disponible en este dispositivo.');
  }
};

export const getOrCreateUserEncryptionKey = async (uid) => {
  if (!uid) {
    throw new Error('No hay usuario autenticado para proteger los datos.');
  }

  if (keyCache.has(uid)) {
    return keyCache.get(uid);
  }

  await ensureSecureStoreAvailable();

  const secureKey = getSecureStoreKey(uid);
  let keyHex = await SecureStore.getItemAsync(secureKey, secureStoreOptions);

  if (!keyHex) {
    keyHex = bytesToHex(await Crypto.getRandomBytesAsync(KEY_BYTES));
    await SecureStore.setItemAsync(secureKey, keyHex, secureStoreOptions);
  }

  const keyBytes = hexToBytes(keyHex);
  if (keyBytes.length !== KEY_BYTES) {
    throw new Error('La clave local protegida no tiene un formato valido.');
  }

  keyCache.set(uid, keyBytes);
  return keyBytes;
};

const parseEncryptedEnvelope = (storedValue) => {
  try {
    const parsed = JSON.parse(storedValue);
    if (
      parsed &&
      parsed[ENVELOPE_MARKER] === true &&
      parsed.version === ENVELOPE_VERSION &&
      parsed.algorithm === ALGORITHM &&
      typeof parsed.nonce === 'string' &&
      typeof parsed.ciphertext === 'string'
    ) {
      return parsed;
    }
  } catch (error) {
    return null;
  }

  return null;
};

export const protectStringForStorage = async (uid, storageKey, value) => {
  const key = await getOrCreateUserEncryptionKey(uid);
  const nonce = await Crypto.getRandomBytesAsync(NONCE_BYTES);
  const aad = stringToUtf8Bytes(storageKey);
  const plaintext = stringToUtf8Bytes(String(value));
  const ciphertext = xchacha20poly1305(key, nonce, aad).encrypt(plaintext);

  return JSON.stringify({
    [ENVELOPE_MARKER]: true,
    version: ENVELOPE_VERSION,
    algorithm: ALGORITHM,
    nonce: bytesToHex(nonce),
    ciphertext: bytesToHex(ciphertext),
  });
};

export const unprotectStringFromStorage = async (uid, storageKey, storedValue) => {
  const envelope = parseEncryptedEnvelope(storedValue);
  if (!envelope) {
    return {
      value: storedValue,
      needsMigration: true,
    };
  }

  const key = await getOrCreateUserEncryptionKey(uid);
  const aad = stringToUtf8Bytes(storageKey);
  const nonce = hexToBytes(envelope.nonce);
  const ciphertext = hexToBytes(envelope.ciphertext);
  const plaintext = xchacha20poly1305(key, nonce, aad).decrypt(ciphertext);

  return {
    value: utf8BytesToString(plaintext),
    needsMigration: false,
  };
};

export const deleteUserEncryptionKey = async (uid) => {
  if (!uid) return;

  keyCache.delete(uid);
  await ensureSecureStoreAvailable();
  await SecureStore.deleteItemAsync(getSecureStoreKey(uid), secureStoreOptions);
};
