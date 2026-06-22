import {
  USER_STORAGE_KEYS,
  readUserString,
  writeUserString,
} from './userStorage';

const AI_PRIVACY_CONSENT_VERSION = 'accepted_v1';

export const hasAcceptedAiPrivacyNotice = async () => {
  const storedValue = await readUserString(
    USER_STORAGE_KEYS.aiPrivacyConsent,
    ''
  );

  return storedValue === AI_PRIVACY_CONSENT_VERSION;
};

export const acceptAiPrivacyNotice = async () =>
  writeUserString(
    USER_STORAGE_KEYS.aiPrivacyConsent,
    AI_PRIVACY_CONSENT_VERSION
  );
