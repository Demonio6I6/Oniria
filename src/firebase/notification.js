// src/firebase/notification.js
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './config';
import { Platform, Alert } from 'react-native';

export async function saveTokenInFirestore(pushToken, uid) {
  if (!pushToken) return;
  try {
    await setDoc(doc(db, 'users', uid), { fcmToken: pushToken }, { merge: true });
    console.log('Token guardado exitosamente en Firestore');
  } catch (error) {
    console.error('Error guardando el token en Firestore:', error);
  }
}

export async function registerForPushNotificationsAsync() {
  let token;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      Alert.alert('Permisos denegados', 'No se han concedido permisos para notificaciones push');
      return null;
    }

    try {
      const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
      token = tokenResponse.data;
    } catch (error) {
      console.error('Error obteniendo el token de notificaciones:', error);
    }
  } else {
    Alert.alert('Solo dispositivos físicos', 'Debes usar un dispositivo físico para notificaciones push');
    return null;
  }

  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    } catch (error) {
      console.error('Error al configurar el canal de notificaciones en Android:', error);
    }
  }

  return token;
}
