import {
  USER_STORAGE_KEYS,
  readUserString,
  writeUserString,
} from './userStorage';

export const loadDiaryData = async () => {
  const [passwordRecord, diaryText] = await Promise.all([
    readUserString(USER_STORAGE_KEYS.diaryPassword),
    readUserString(USER_STORAGE_KEYS.diaryContent, ''),
  ]);

  return { passwordRecord, diaryText };
};

export const saveDiaryPasswordRecord = async (passwordRecord) =>
  writeUserString(USER_STORAGE_KEYS.diaryPassword, passwordRecord);

export const saveDiaryContent = async (diaryText) =>
  writeUserString(USER_STORAGE_KEYS.diaryContent, diaryText);
