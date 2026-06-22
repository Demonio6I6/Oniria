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

export const loadSavedDreams = async () => {
  const dreams = await readUserArray(USER_STORAGE_KEYS.dreams);
  return sortDreamsByNewest(dreams);
};

export const saveDreamRecord = async (dream) => {
  const dreams = await readUserArray(USER_STORAGE_KEYS.dreams);
  return writeUserJson(USER_STORAGE_KEYS.dreams, [...dreams, dream]);
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
  return updatedDream;
};

export const deleteSavedDreamsByIds = async (dreamIds) => {
  const selectedIds = new Set(dreamIds);
  const dreams = await readUserArray(USER_STORAGE_KEYS.dreams);
  const nextDreams = dreams.filter(dream => !selectedIds.has(getDreamId(dream)));

  await writeUserJson(USER_STORAGE_KEYS.dreams, nextDreams);
  return sortDreamsByNewest(nextDreams);
};

export const getDreamCalendarData = buildDreamCalendarData;
