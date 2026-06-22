// src/components/HomeScreen.js
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MainScreen from '../screens/MainScreen';
import { firebaseConfig } from '../firebase/config';

const ERROR_MESSAGES = {
  'auth/email-already-in-use': 'Ese correo ya tiene una cuenta.',
  'auth/invalid-email': 'El correo no es valido.',
  'auth/invalid-phone-number': 'El telefono debe estar en formato internacional, por ejemplo +34600111222.',
  'auth/invalid-verification-code': 'El codigo SMS no es valido.',
  'auth/missing-password': 'Escribe una contrasena.',
  'auth/operation-not-allowed': 'Activa este proveedor en Firebase Authentication.',
  'auth/user-not-found': 'No existe una cuenta con ese correo.',
  'auth/weak-password': 'La contrasena debe tener al menos 6 caracteres.',
  'auth/wrong-password': 'La contrasena no es correcta.',
};

function getAuthErrorMessage(error) {
  return ERROR_MESSAGES[error?.code] || error?.message || 'No se pudo completar la autenticacion.';
}

function PhoneRecaptchaVerifier({ verifierRef, config }) {
  const { FirebaseRecaptchaVerifierModal } = require('expo-firebase-recaptcha');

  return (
    <FirebaseRecaptchaVerifierModal
      ref={verifierRef}
      firebaseConfig={config}
      attemptInvisibleVerification
      cancelLabel="Cancelar"
      title="Verificacion"
    />
  );
}

export default function HomeScreen({
  user,
  signInWithGoogle,
  signInWithEmail,
  registerWithEmail,
  resetPassword,
  sendPhoneVerificationCode,
  confirmPhoneVerificationCode,
  phoneVerificationId,
  signInAsGuest,
}) {
  const recaptchaVerifier = useRef(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [busyAction, setBusyAction] = useState(null);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [shouldRenderRecaptcha, setShouldRenderRecaptcha] = useState(false);

  if (user) {
    return (
      <View style={{ flex: 1 }}>
        <MainScreen />
      </View>
    );
  }

  const runAuthAction = async (actionName, action, successMessage = '') => {
    try {
      setBusyAction(actionName);
      setErrorMessage('');
      setMessage('');
      await action();
      if (successMessage) {
        setMessage(successMessage);
      }
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setBusyAction(null);
    }
  };

  const hasEmailCredentials = email.trim() && password;
  const hasPhoneNumber = phoneNumber.trim();
  const hasSmsCode = smsCode.trim();
  const isBusy = Boolean(busyAction);

  const getRecaptchaVerifier = async () => {
    setShouldRenderRecaptcha(true);
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
    return recaptchaVerifier.current;
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {shouldRenderRecaptcha ? (
        <PhoneRecaptchaVerifier verifierRef={recaptchaVerifier} config={firebaseConfig} />
      ) : null}

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>Inicia sesion</Text>

        <Pressable
          style={[styles.primaryButton, isBusy && styles.disabledButton]}
          disabled={isBusy}
          onPress={() => runAuthAction('google', signInWithGoogle)}
        >
          <Text style={styles.primaryButtonText}>Continuar con Google</Text>
        </Pressable>

        <Pressable
          style={[styles.secondaryButton, isBusy && styles.disabledButton]}
          disabled={isBusy}
          onPress={() => runAuthAction('guest', signInAsGuest)}
        >
          <Text style={styles.secondaryButtonText}>Entrar como invitado</Text>
        </Pressable>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Correo</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="correo@ejemplo.com"
            style={styles.input}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Contrasena"
            style={styles.input}
          />
          <View style={styles.row}>
            <Pressable
              style={[
                styles.smallButton,
                (!hasEmailCredentials || isBusy) && styles.disabledButton,
              ]}
              disabled={!hasEmailCredentials || isBusy}
              onPress={() => runAuthAction('emailSignIn', () => signInWithEmail(email, password))}
            >
              <Text style={styles.smallButtonText}>Entrar</Text>
            </Pressable>
            <Pressable
              style={[
                styles.smallButton,
                (!hasEmailCredentials || isBusy) && styles.disabledButton,
              ]}
              disabled={!hasEmailCredentials || isBusy}
              onPress={() => runAuthAction('emailRegister', () => registerWithEmail(email, password))}
            >
              <Text style={styles.smallButtonText}>Crear cuenta</Text>
            </Pressable>
          </View>
          <Pressable
            disabled={!email.trim() || isBusy}
            onPress={() =>
              runAuthAction(
                'resetPassword',
                () => resetPassword(email),
                'Te enviamos un correo para restablecer la contrasena.'
              )
            }
          >
            <Text style={[styles.linkText, (!email.trim() || isBusy) && styles.disabledText]}>
              Recuperar contrasena
            </Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Telefono</Text>
          <TextInput
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            onFocus={() => setShouldRenderRecaptcha(true)}
            autoCapitalize="none"
            keyboardType="phone-pad"
            placeholder="+34600111222"
            style={styles.input}
          />
          {phoneVerificationId ? (
            <>
              <TextInput
                value={smsCode}
                onChangeText={setSmsCode}
                keyboardType="number-pad"
                placeholder="Codigo SMS"
                style={styles.input}
              />
              <View style={styles.row}>
                <Pressable
                  style={[
                    styles.smallButton,
                    (!hasSmsCode || isBusy) && styles.disabledButton,
                  ]}
                  disabled={!hasSmsCode || isBusy}
                  onPress={() =>
                    runAuthAction('phoneConfirm', () => confirmPhoneVerificationCode(smsCode))
                  }
                >
                  <Text style={styles.smallButtonText}>Confirmar</Text>
                </Pressable>
                <Pressable
                  style={[styles.smallOutlineButton, isBusy && styles.disabledButton]}
                  disabled={isBusy}
                  onPress={() =>
                    runAuthAction(
                      'phoneSend',
                      async () =>
                        sendPhoneVerificationCode(phoneNumber, await getRecaptchaVerifier()),
                      'Codigo SMS enviado.'
                    )
                  }
                >
                  <Text style={styles.smallOutlineButtonText}>Reenviar</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Pressable
              style={[
                styles.smallButton,
                (!hasPhoneNumber || isBusy) && styles.disabledButton,
              ]}
              disabled={!hasPhoneNumber || isBusy}
              onPress={() =>
                runAuthAction(
                  'phoneSend',
                  async () =>
                    sendPhoneVerificationCode(phoneNumber, await getRecaptchaVerifier()),
                  'Codigo SMS enviado.'
                )
              }
            >
              <Text style={styles.smallButtonText}>Enviar codigo SMS</Text>
            </Pressable>
          )}
        </View>

        {busyAction ? <ActivityIndicator style={styles.loader} /> : null}
        {message ? <Text style={styles.messageText}>{message}</Text> : null}
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  section: {
    borderColor: '#E5E7EB',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    padding: 14,
    width: '100%',
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  input: {
    borderColor: '#D1D5DB',
    borderRadius: 8,
    borderWidth: 1,
    color: '#111827',
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingVertical: 13,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#111827',
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 13,
  },
  secondaryButtonText: {
    color: '#111827',
    fontWeight: '700',
  },
  smallButton: {
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 8,
    flex: 1,
    paddingVertical: 11,
  },
  smallButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  smallOutlineButton: {
    alignItems: 'center',
    borderColor: '#2563EB',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 11,
  },
  smallOutlineButtonText: {
    color: '#2563EB',
    fontWeight: '700',
  },
  linkText: {
    color: '#2563EB',
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.45,
  },
  disabledText: {
    opacity: 0.45,
  },
  loader: {
    marginTop: 8,
  },
  messageText: {
    color: '#047857',
    textAlign: 'center',
  },
  errorText: {
    color: '#B91C1C',
    textAlign: 'center',
  },
});
