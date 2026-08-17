import { createProtectedCallable } from '../firebase/callable';

const deleteUserAccountCallable = createProtectedCallable(
  'deleteUserAccountData',
  { timeout: 120000 }
);

export const deleteRemoteUserAccount = async () => {
  const result = await deleteUserAccountCallable({});
  return result.data;
};
