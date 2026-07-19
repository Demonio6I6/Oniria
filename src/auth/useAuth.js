// src/auth/useAuth.js
import { useEffect, useState } from 'react';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  PhoneAuthProvider,
  createUserWithEmailAndPassword,
  linkWithCredential,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import * as Notifications from 'expo-notifications';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { auth } from '../firebase/config';
import {
  saveUserSessionInFirestore,
  registerForPushNotificationsAsync,
  saveTokenInFirestore,
} from '../firebase/notification';
import { deleteAnonymousAccountData } from '../services/anonymousAccountCleanup';
import {
  clearUserLocalDataById,
  migrateUserLocalDataById,
} from '../services/userStorage';
import { migrateAnonymousServerState } from '../services/anonymousAccountMigration';
import { deleteRemoteUserAccount } from '../services/accountDeletion';
import { resetRevenueCatUser } from '../services/subscriptionService';

const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';

GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID,
});

const LINK_CONFLICT_ERROR_CODES = new Set([
  'auth/account-exists-with-different-credential',
  'auth/credential-already-in-use',
  'auth/email-already-in-use',
]);

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pushToken, setPushToken] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [phoneVerificationId, setPhoneVerificationId] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user) {
      saveUserSessionInFirestore(user, pushToken);
    }
  }, [user, pushToken]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const message = response.notification.request.content.body;
      setNotificationMessage(message);
      setModalVisible(true);
    });

    return () => subscription.remove();
  }, []);

  const clearCurrentSession = async () => {
    await GoogleSignin.signOut().catch(() => null);
    await signOut(auth).catch(() => null);
    setUser(null);
  };

  const migrateAnonymousState = async (
    anonymousUid,
    targetUid,
    anonymousIdToken
  ) => {
    if (!anonymousUid || !targetUid || anonymousUid === targetUid) return;

    await migrateUserLocalDataById(anonymousUid, targetUid);
    await migrateAnonymousServerState(anonymousIdToken).catch(error => {
      console.warn('No se pudo migrar el estado remoto del invitado:', error);
    });
  };

  const signInExistingAccount = async (signInAction) => {
    const anonymousUser = auth.currentUser?.isAnonymous
      ? auth.currentUser
      : null;
    const anonymousUid = anonymousUser?.uid || null;
    const anonymousIdToken = anonymousUser
      ? await anonymousUser.getIdToken()
      : '';

    if (!anonymousUid) {
      await clearCurrentSession();
    }

    const userCredential = await signInAction();

    if (anonymousUid && userCredential.user.uid !== anonymousUid) {
      await migrateAnonymousState(
        anonymousUid,
        userCredential.user.uid,
        anonymousIdToken
      );
    }

    setUser(userCredential.user);
    return userCredential.user;
  };

  const linkAnonymousAccount = async (credential, fallbackSignInAction) => {
    const currentUser = auth.currentUser;
    const anonymousUid = currentUser?.isAnonymous ? currentUser.uid : null;
    const anonymousIdToken = currentUser?.isAnonymous
      ? await currentUser.getIdToken()
      : '';

    if (!anonymousUid) {
      return signInExistingAccount(fallbackSignInAction);
    }

    try {
      const userCredential = await linkWithCredential(currentUser, credential);
      setUser(userCredential.user);
      return userCredential.user;
    } catch (error) {
      if (!LINK_CONFLICT_ERROR_CODES.has(error?.code)) {
        throw error;
      }

      const userCredential = await fallbackSignInAction();

      if (userCredential.user.uid !== anonymousUid) {
        await migrateAnonymousState(
          anonymousUid,
          userCredential.user.uid,
          anonymousIdToken
        );
      }

      setUser(userCredential.user);
      return userCredential.user;
    }
  };

  const signInWithGoogle = async () => {
    try {
      if (!GOOGLE_WEB_CLIENT_ID) {
        throw new Error(
          'Google Sign-In no esta configurado para este entorno.'
        );
      }

      await GoogleSignin.signOut().catch(() => null);

      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();

      if (response.type !== 'success') {
        return null;
      }

      const { idToken } = response.data;

      if (!idToken) {
        throw new Error('Google no devolvio un idToken para Firebase.');
      }

      const credential = GoogleAuthProvider.credential(idToken);

      return linkAnonymousAccount(
        credential,
        () => signInWithCredential(auth, credential)
      );
    } catch (error) {
      console.error('Error al autenticar con Google:', error);
      throw error;
    }
  };

  const signInWithEmail = async (email, password) => {
    try {
      return signInExistingAccount(() =>
        signInWithEmailAndPassword(auth, email.trim(), password)
      );
    } catch (error) {
      console.error('Error al autenticar con correo:', error);
      throw error;
    }
  };

  const registerWithEmail = async (email, password) => {
    try {
      const currentUser = auth.currentUser;
      const credential = EmailAuthProvider.credential(
        email.trim(),
        password
      );

      if (currentUser?.isAnonymous) {
        const userCredential = await linkWithCredential(currentUser, credential);
        setUser(userCredential.user);
        return userCredential.user;
      }

      await clearCurrentSession();
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      setUser(userCredential.user);
      return userCredential.user;
    } catch (error) {
      console.error('Error al registrar con correo:', error);
      throw error;
    }
  };

  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (error) {
      console.error('Error al enviar recuperacion de contrasena:', error);
      throw error;
    }
  };

  const sendPhoneVerificationCode = async (phoneNumber, appVerifier) => {
    try {
      if (!appVerifier) {
        throw new Error('No se encontro el verificador reCAPTCHA.');
      }

      const provider = new PhoneAuthProvider(auth);
      const verificationId = await provider.verifyPhoneNumber(phoneNumber.trim(), appVerifier);
      setPhoneVerificationId(verificationId);
      return verificationId;
    } catch (error) {
      console.error('Error al enviar SMS de autenticacion:', error);
      throw error;
    }
  };

  const confirmPhoneVerificationCode = async (verificationCode) => {
    try {
      if (!phoneVerificationId) {
        throw new Error('Primero solicita el codigo SMS.');
      }

      const credential = PhoneAuthProvider.credential(
        phoneVerificationId,
        verificationCode.trim()
      );

      const user = await linkAnonymousAccount(
        credential,
        () => signInWithCredential(auth, credential)
      );
      setPhoneVerificationId(null);
      return user;
    } catch (error) {
      console.error('Error al confirmar codigo de telefono:', error);
      throw error;
    }
  };

  const signInAsGuest = async () => {
    try {
      await clearCurrentSession();
      const userCredential = await signInAnonymously(auth);
      setUser(userCredential.user);
      return userCredential.user;
    } catch (error) {
      console.error('Error al autenticar como invitado:', error);
      throw error;
    }
  };

  const signOutUser = async () => {
    const currentUser = auth.currentUser;
    const anonymousUid = currentUser?.isAnonymous ? currentUser.uid : null;
    let remoteAnonymousCleanupDone = false;

    try {
      if (anonymousUid) {
        await deleteAnonymousAccountData();
        remoteAnonymousCleanupDone = true;
        await clearUserLocalDataById(anonymousUid);
      }

      await resetRevenueCatUser().catch(error => {
        console.warn('No se pudo cerrar la identidad de RevenueCat:', error);
      });

      await clearCurrentSession();
      setPhoneVerificationId(null);
      console.log('Usuario cerro sesion correctamente');
    } catch (error) {
      console.error('Error al cerrar sesion:', error);

      if (remoteAnonymousCleanupDone) {
        await clearCurrentSession();
        setPhoneVerificationId(null);
      }

      throw error;
    }
  };

  const deleteAccount = async () => {
    const currentUser = auth.currentUser;
    const uid = currentUser?.uid || '';
    let remoteAccountDeleted = false;

    if (!uid) {
      throw new Error('No hay una cuenta activa que eliminar.');
    }

    try {
      await deleteRemoteUserAccount();
      remoteAccountDeleted = true;
      await resetRevenueCatUser().catch(error => {
        console.warn('No se pudo cerrar la identidad de RevenueCat:', error);
      });
      await clearUserLocalDataById(uid);
      await clearCurrentSession();
      setPhoneVerificationId(null);
      return true;
    } catch (error) {
      if (remoteAccountDeleted) {
        await clearCurrentSession();
        setPhoneVerificationId(null);
      }
      throw error;
    }
  };

  const enableNotifications = async () => {
    const token = await registerForPushNotificationsAsync();
    if (!token) return null;

    setPushToken(token);
    if (auth.currentUser?.uid) {
      await saveTokenInFirestore(token, auth.currentUser.uid);
    }

    return token;
  };

  return {
    user,
    loading,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    resetPassword,
    sendPhoneVerificationCode,
    confirmPhoneVerificationCode,
    phoneVerificationId,
    signInAsGuest,
    modalVisible,
    setModalVisible,
    notificationMessage,
    enableNotifications,
    deleteAccount,
    signOut: signOutUser,
  };
}
