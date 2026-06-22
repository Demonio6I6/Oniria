// src/auth/useAuth.js
import { useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  PhoneAuthProvider,
  createUserWithEmailAndPassword,
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
import { saveTokenInFirestore, registerForPushNotificationsAsync } from '../firebase/notification';

GoogleSignin.configure({
  webClientId: '713716281775-h6bc1cec3i5plmkn8bsmlicg3mm0a4u2.apps.googleusercontent.com',
});

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pushToken, setPushToken] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [phoneVerificationId, setPhoneVerificationId] = useState(null);

  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      if (token) setPushToken(token);
    });
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user && pushToken) {
      saveTokenInFirestore(pushToken, user.uid);
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

  const signInWithGoogle = async () => {
    try {
      await clearCurrentSession();

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
      const userCredential = await signInWithCredential(auth, credential);
      setUser(userCredential.user);
      return userCredential.user;
    } catch (error) {
      console.error('Error al autenticar con Google:', error);
      throw error;
    }
  };

  const signInWithEmail = async (email, password) => {
    try {
      await clearCurrentSession();
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      setUser(userCredential.user);
      return userCredential.user;
    } catch (error) {
      console.error('Error al autenticar con correo:', error);
      throw error;
    }
  };

  const registerWithEmail = async (email, password) => {
    try {
      await clearCurrentSession();
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
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

      await clearCurrentSession();
      const credential = PhoneAuthProvider.credential(
        phoneVerificationId,
        verificationCode.trim()
      );
      const userCredential = await signInWithCredential(auth, credential);
      setPhoneVerificationId(null);
      setUser(userCredential.user);
      return userCredential.user;
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
    try {
      await clearCurrentSession();
      setPhoneVerificationId(null);
      console.log('Usuario cerro sesion correctamente');
    } catch (error) {
      console.error('Error al cerrar sesion:', error);
    }
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
    signOut: signOutUser,
  };
}
