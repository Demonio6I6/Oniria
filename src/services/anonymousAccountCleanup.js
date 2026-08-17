import { createProtectedCallable } from '../firebase/callable';

export const deleteAnonymousAccountData = async () => {
  const callable = createProtectedCallable('deleteAnonymousUserData', {
    timeout: 120000,
  });

  const result = await callable({});
  return result.data;
};
