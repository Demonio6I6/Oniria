import * as Crypto from 'expo-crypto';

const PASSWORD_RECORD_VERSION = 1;
const PASSWORD_HASH_ITERATIONS = 750;
const SALT_BYTES = 16;

const bytesToHex = (bytes) =>
  Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');

const hashPassword = async (password, salt, iterations) => {
  let digest = `${salt}:${password}`;

  for (let index = 0; index < iterations; index += 1) {
    digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA512,
      `${salt}:${index}:${digest}`
    );
  }

  return digest;
};

const parsePasswordRecord = (storedValue) => {
  try {
    const parsed = JSON.parse(storedValue);
    if (
      parsed &&
      parsed.version === PASSWORD_RECORD_VERSION &&
      typeof parsed.salt === 'string' &&
      typeof parsed.passwordHash === 'string' &&
      Number.isInteger(parsed.iterations)
    ) {
      return parsed;
    }
  } catch (error) {
    return null;
  }

  return null;
};

const safeCompare = (left, right) => {
  if (typeof left !== 'string' || typeof right !== 'string') return false;

  let mismatch = left.length ^ right.length;
  const maxLength = Math.max(left.length, right.length);

  for (let index = 0; index < maxLength; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return mismatch === 0;
};

export const createPasswordRecord = async (password) => {
  const salt = bytesToHex(await Crypto.getRandomBytesAsync(SALT_BYTES));
  const passwordHash = await hashPassword(
    password,
    salt,
    PASSWORD_HASH_ITERATIONS
  );

  return JSON.stringify({
    version: PASSWORD_RECORD_VERSION,
    algorithm: 'SHA512',
    iterations: PASSWORD_HASH_ITERATIONS,
    salt,
    passwordHash,
  });
};

export const verifyPasswordRecord = async (password, storedValue) => {
  const record = parsePasswordRecord(storedValue);

  if (!record) {
    const ok = password === storedValue;
    return { ok, needsMigration: ok };
  }

  const passwordHash = await hashPassword(
    password,
    record.salt,
    record.iterations
  );

  return {
    ok: safeCompare(passwordHash, record.passwordHash),
    needsMigration: false,
  };
};
