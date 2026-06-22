import {
  USER_STORAGE_KEYS,
  readUserArray,
  writeUserJson,
} from './userStorage';

export const loadEmotionRecords = async () =>
  readUserArray(USER_STORAGE_KEYS.emotions);

export const appendEmotionRecord = async (record) => {
  const records = await readUserArray(USER_STORAGE_KEYS.emotions);
  return writeUserJson(USER_STORAGE_KEYS.emotions, [...records, record]);
};
