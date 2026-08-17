import { DeviceEventEmitter } from 'react-native';
import {
  buildDreamCalendarData,
  getDreamId,
  sortDreamsByNewest,
} from '../domain/dreams';
import {
  USER_STORAGE_KEYS,
  readUserArray,
  writeUserJson,
} from './userStorage';

const DREAM_RECORDS_CHANGED_EVENT = 'dreamRecordsChanged';

const notifyDreamRecordsChanged = change => {
  DeviceEventEmitter.emit(DREAM_RECORDS_CHANGED_EVENT, change);
};

export const subscribeToDreamRecords = listener =>
  DeviceEventEmitter.addListener(DREAM_RECORDS_CHANGED_EVENT, listener);

export const loadSavedDreams = async () => {
  const dreams = await readUserArray(USER_STORAGE_KEYS.dreams);
  return sortDreamsByNewest(dreams);
};

export const saveDreamRecord = async (dream) => {
  const dreams = await readUserArray(USER_STORAGE_KEYS.dreams);
  const result = await writeUserJson(USER_STORAGE_KEYS.dreams, [...dreams, dream]);
  notifyDreamRecordsChanged({ type: 'saved', dreamIds: [getDreamId(dream)] });
  return result;
};

export const updateDreamRecordById = async (dreamId, updateDream) => {
  const dreams = await readUserArray(USER_STORAGE_KEYS.dreams);
  let updatedDream = null;

  const nextDreams = dreams.map(dream => {
    if (getDreamId(dream) !== dreamId) return dream;

    const changes =
      typeof updateDream === 'function' ? updateDream(dream) : updateDream;

    updatedDream = { ...dream, ...changes };
    return updatedDream;
  });

  if (!updatedDream) return null;

  await writeUserJson(USER_STORAGE_KEYS.dreams, nextDreams);
  notifyDreamRecordsChanged({ type: 'updated', dreamIds: [dreamId] });
  return updatedDream;
};

export const deleteSavedDreamsByIds = async (dreamIds) => {
  const selectedIds = new Set(dreamIds);
  const dreams = await readUserArray(USER_STORAGE_KEYS.dreams);
  const nextDreams = dreams.filter(dream => !selectedIds.has(getDreamId(dream)));
  const emotionRecords = await readUserArray(USER_STORAGE_KEYS.emotions);
  const nextEmotionRecords = emotionRecords.filter(
    record => !selectedIds.has(record?.dreamId)
  );

  await Promise.all([
    writeUserJson(USER_STORAGE_KEYS.dreams, nextDreams),
    writeUserJson(USER_STORAGE_KEYS.emotions, nextEmotionRecords),
  ]);
  notifyDreamRecordsChanged({ type: 'deleted', dreamIds: [...selectedIds] });
  return sortDreamsByNewest(nextDreams);
};

export const getDreamCalendarData = buildDreamCalendarData;
