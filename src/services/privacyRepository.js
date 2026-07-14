import {
  USER_STORAGE_KEYS,
  readUserString,
  writeUserString,
} from './userStorage';

const AI_PRIVACY_CONSENT_VERSION = 'accepted_v1';
const MONTHLY_ANALYSIS_PRIVACY_CONSENT_VERSION = 'accepted_v1';

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

export const revokeAiPrivacyNotice = async () =>
  writeUserString(USER_STORAGE_KEYS.aiPrivacyConsent, '');

export const hasAcceptedMonthlyAnalysisPrivacyNotice = async () => {
  const storedValue = await readUserString(
    USER_STORAGE_KEYS.monthlyAnalysisPrivacyConsent,
    ''
  );

  return storedValue === MONTHLY_ANALYSIS_PRIVACY_CONSENT_VERSION;
};

export const acceptMonthlyAnalysisPrivacyNotice = async () =>
  writeUserString(
    USER_STORAGE_KEYS.monthlyAnalysisPrivacyConsent,
    MONTHLY_ANALYSIS_PRIVACY_CONSENT_VERSION
  );

export const revokeMonthlyAnalysisPrivacyNotice = async () =>
  writeUserString(USER_STORAGE_KEYS.monthlyAnalysisPrivacyConsent, '');
