// src/firebase/config.js
import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';

// Configuración de Firebase
const firebaseConfig = {
  apiKey: 'AIzaSyDw8UnEfTp8emNxUFKy_D21DwzUeJaJ5hU',
  authDomain: 'post-it-72f0b.firebaseapp.com',
  projectId: 'post-it-72f0b',
  storageBucket: 'post-it-72f0b.appspot.com',
  messagingSenderId: '713716281775',
  appId: '1:713716281775:web:33bc99cf83a3387e2fbf5a',
  measurementId: 'G-PDPRV3B50R',
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Auth con persistencia en AsyncStorage
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// Inicializar Firestore
const db = getFirestore();

export { app, auth, db, firebaseConfig };
