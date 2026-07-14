import {
  USER_STORAGE_KEYS,
  readUserJson,
  writeUserJson,
} from './userStorage';

export const loadMonthlyAnalysis = async () =>
  readUserJson(USER_STORAGE_KEYS.monthlyAnalysis, null);

export const saveMonthlyAnalysis = async (analysis) =>
  writeUserJson(USER_STORAGE_KEYS.monthlyAnalysis, analysis);
