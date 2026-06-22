import { createEmptyProfileResponses } from '../domain/profile';
import {
  USER_STORAGE_KEYS,
  readUserJson,
  writeUserJson,
} from './userStorage';

export const loadProfileResponses = async () => {
  const storedResponses = await readUserJson(
    USER_STORAGE_KEYS.profileResponses,
    null
  );

  if (!storedResponses || typeof storedResponses !== 'object') {
    return createEmptyProfileResponses();
  }

  return {
    ...createEmptyProfileResponses(),
    ...storedResponses,
  };
};

export const saveProfileResponses = async (responses) =>
  writeUserJson(USER_STORAGE_KEYS.profileResponses, responses);
