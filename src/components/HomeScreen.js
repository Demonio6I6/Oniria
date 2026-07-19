// src/components/HomeScreen.js
import React, { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Inicio from '../screens/Inicio';
import { firebaseConfig } from '../firebase/config';
import AppIcon from './AppIcon';
import OnboardingScreen from './OnboardingScreen';
import { trackProductEvent } from '../services/productAnalytics';
import { colors, radii, spacing } from '../theme/tokens';

const AUTH_METHODS = {
  EMAIL: 'email',
  PHONE: 'phone',
};

const ACTION_FEEDBACK_METHOD = {
  emailSignIn: AUTH_METHODS.EMAIL,
  emailRegister: AUTH_METHODS.EMAIL,
  resetPassword: AUTH_METHODS.EMAIL,
  phoneSend: AUTH_METHODS.PHONE,
  phoneConfirm: AUTH_METHODS.PHONE,
};

const AUTH_HERO_IMAGE = require('../../assets/auth-hero-moon.jpg');
const AUTH_MARK_IMAGE = require('../../assets/icon.png');
const ONBOARDING_STORAGE_KEY = 'lunentra_onboarding_completed_v1';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

function AuthMethodIcon({ type, active }) {
  const iconColor = active ? '#fff' : '#4F46E5';

  const iconNameByType = {
    google: 'google',
    email: 'email',
    phone: 'phone',
    guest: 'guest',
  };

  return (
    <AppIcon
      name={iconNameByType[type] || 'info'}
      size={19}
      color={iconColor}
      strokeWidth={2.1}
    />
  );
}

function AuthMethodButton({
  type,
  title,
  description,
  active,
  disabled,
  loading,
  expandable,
  onPress,
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.methodButton,
        active && styles.methodButtonActive,
        pressed && !disabled && styles.methodButtonPressed,
        disabled && styles.disabledButton,
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      <View style={[styles.methodIcon, active && styles.methodIconActive]}>
        <AuthMethodIcon type={type} active={active} />
      </View>
      <View style={styles.methodCopy}>
        <Text style={[styles.methodTitle, active && styles.methodTitleActive]}>
          {title}
        </Text>
        <Text
          style={[
            styles.methodDescription,
            active && styles.methodDescriptionActive,
          ]}
        >
          {description}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator color={active ? '#fff' : '#4F46E5'} size="small" />
      ) : expandable ? (
        <AppIcon
          name={active ? 'chevronUp' : 'chevronDown'}
          size={19}
          color={active ? '#fff' : '#64748B'}
        />
      ) : (
        <AppIcon
          name="arrowRight"
          size={19}
          color={active ? '#fff' : '#64748B'}
        />
      )}
    </Pressable>
  );
}

function AuthFeedback({ message, errorMessage }) {
  if (!message && !errorMessage) return null;

  const isError = Boolean(errorMessage);

  return (
    <View style={[styles.feedbackBox, isError && styles.feedbackBoxError]}>
      <AppIcon
        name={isError ? 'alertCircle' : 'checkCircle'}
        size={18}
        color={isError ? '#B91C1C' : '#047857'}
      />
      <Text style={[styles.feedbackText, isError && styles.feedbackTextError]}>
        {errorMessage || message}
      </Text>
    </View>
  );
}

export default function HomeScreen({
  navigation,
  route,
  user,
  signInWithGoogle,
  signInWithEmail,
  registerWithEmail,
  resetPassword,
  sendPhoneVerificationCode,
  confirmPhoneVerificationCode,
  phoneVerificationId,
  signInAsGuest,
  forceAuthOptions = false,
  allowGuest = true,
  panelTitle = 'Empieza tu diario',
  panelSubtitle = 'Elige cómo quieres guardar tu recorrido.',
  heroTitle = 'Conócete a través de lo que sueñas.',
  heroText = 'Registra tus sueños, explora posibles significados y reconoce patrones con el tiempo.',
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
  const [activeMethod, setActiveMethod] = useState(null);
  const [feedbackMethod, setFeedbackMethod] = useState(null);
  const [onboardingLoading, setOnboardingLoading] = useState(!forceAuthOptions);
  const [onboardingCompleted, setOnboardingCompleted] = useState(
    forceAuthOptions
  );

  useEffect(() => {
    if (phoneVerificationId) {
      setActiveMethod(AUTH_METHODS.PHONE);
    }
  }, [phoneVerificationId]);

  useEffect(() => {
    let isActive = true;

    if (forceAuthOptions || user) {
      setOnboardingCompleted(true);
      setOnboardingLoading(false);
      return undefined;
    }

    AsyncStorage.getItem(ONBOARDING_STORAGE_KEY)
      .then(value => {
        if (isActive) setOnboardingCompleted(value === 'true');
      })
      .catch(error => {
        console.warn('No se pudo leer el onboarding:', error);
        if (isActive) setOnboardingCompleted(false);
      })
      .finally(() => {
        if (isActive) setOnboardingLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [forceAuthOptions, user]);

  const finishOnboarding = async () => {
    setOnboardingCompleted(true);
    await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true').catch(error => {
      console.warn('No se pudo guardar el onboarding:', error);
    });
  };

  if (user && !forceAuthOptions) {
    return (
      <View style={{ flex: 1 }}>
        <Inicio navigation={navigation} />
      </View>
    );
  }

  if (onboardingLoading) {
    return (
      <View style={styles.onboardingLoader}>
        <ActivityIndicator color="#A5B4FC" size="small" />
      </View>
    );
  }

  if (!onboardingCompleted && !forceAuthOptions) {
    return <OnboardingScreen onFinish={finishOnboarding} />;
  }

  const runAuthAction = async (actionName, action, successMessage = '') => {
    try {
      setBusyAction(actionName);
      setErrorMessage('');
      setMessage('');
      setFeedbackMethod(ACTION_FEEDBACK_METHOD[actionName] || null);
      const authenticatedUser = await action();
      if (successMessage) {
        setMessage(successMessage);
      }
      if (
        forceAuthOptions &&
        authenticatedUser &&
        !authenticatedUser.isAnonymous
      ) {
        const returnReason = route?.params?.returnReason || 'account-center';
        trackProductEvent('account_conversion_completed', {
          method: actionName,
          reason: returnReason,
        });
        DeviceEventEmitter.emit('accountConversionCompleted', {
          reason: returnReason,
        });

        if (navigation?.canGoBack?.()) {
          navigation.goBack();
        } else {
          navigation?.navigate('Home');
        }
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

  const toggleAuthMethod = (method) => {
    if (isBusy) return;

    if (LayoutAnimation.configureNext && LayoutAnimation.Presets?.easeInEaseOut) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }

    setActiveMethod((currentMethod) =>
      currentMethod === method ? null : method
    );
  };

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
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <ImageBackground
          source={AUTH_HERO_IMAGE}
          style={styles.hero}
          imageStyle={styles.heroImage}
          resizeMode="cover"
        >
          <LinearGradient
            colors={[
              'rgba(5, 10, 22, 0.16)',
              'rgba(5, 10, 22, 0.44)',
              'rgba(5, 10, 22, 0.82)',
            ]}
            locations={[0, 0.52, 1]}
            style={styles.heroScrim}
          />
          <View style={styles.heroContent}>
            <View style={styles.brandRow}>
              <Image source={AUTH_MARK_IMAGE} style={styles.brandMark} />
              <Text style={styles.brandName}>Lunentra</Text>
            </View>
            <Text style={styles.heroTitle}>{heroTitle}</Text>
            <Text style={styles.heroText}>{heroText}</Text>
          </View>
        </ImageBackground>

        <View style={styles.authPanel}>
          <View style={styles.panelInner}>
            <View style={styles.panelHeader}>
              <Text style={styles.title}>{panelTitle}</Text>
              <Text style={styles.subtitle}>{panelSubtitle}</Text>
            </View>

            <View style={styles.valueNote}>
              <AppIcon name="info" size={18} color="#4338CA" />
              <Text style={styles.valueNoteText}>
                Lunentra no adivina ni diagnostica. Te ayuda a observar y
                reflexionar sobre tu propia experiencia.
              </Text>
            </View>

            <View style={styles.methodList}>
              <AuthMethodButton
                type="google"
                title="Continuar con Google"
                description="Acceso rapido con tu cuenta"
                disabled={isBusy}
                loading={busyAction === 'google'}
                onPress={() => runAuthAction('google', signInWithGoogle)}
              />

              <View style={styles.methodGroup}>
                <AuthMethodButton
                  type="email"
                  title="Correo"
                  description="Entrar, crear cuenta o recuperar"
                  active={activeMethod === AUTH_METHODS.EMAIL}
                  disabled={isBusy}
                  expandable
                  onPress={() => toggleAuthMethod(AUTH_METHODS.EMAIL)}
                />
                {activeMethod === AUTH_METHODS.EMAIL ? (
                  <View style={styles.expandedContent}>
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      placeholder="correo@ejemplo.com"
                      placeholderTextColor="#94A3B8"
                      style={styles.input}
                    />
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      placeholder="Contrasena"
                      placeholderTextColor="#94A3B8"
                      style={styles.input}
                    />
                    <View style={styles.row}>
                      <Pressable
                        style={[
                          styles.actionButton,
                          (!hasEmailCredentials || isBusy) &&
                            styles.disabledButton,
                        ]}
                        disabled={!hasEmailCredentials || isBusy}
                        onPress={() =>
                          runAuthAction('emailSignIn', () =>
                            signInWithEmail(email, password)
                          )
                        }
                      >
                        {busyAction === 'emailSignIn' ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.actionButtonText}>Entrar</Text>
                        )}
                      </Pressable>
                      <Pressable
                        style={[
                          styles.outlineActionButton,
                          (!hasEmailCredentials || isBusy) &&
                            styles.disabledButton,
                        ]}
                        disabled={!hasEmailCredentials || isBusy}
                        onPress={() =>
                          runAuthAction('emailRegister', () =>
                            registerWithEmail(email, password)
                          )
                        }
                      >
                        {busyAction === 'emailRegister' ? (
                          <ActivityIndicator color="#4F46E5" size="small" />
                        ) : (
                          <Text style={styles.outlineActionButtonText}>
                            Crear cuenta
                          </Text>
                        )}
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
                      style={styles.linkButton}
                    >
                      {busyAction === 'resetPassword' ? (
                        <ActivityIndicator color="#4F46E5" size="small" />
                      ) : (
                        <Text
                          style={[
                            styles.linkText,
                            (!email.trim() || isBusy) && styles.disabledText,
                          ]}
                        >
                          Recuperar contrasena
                        </Text>
                      )}
                    </Pressable>
                    {feedbackMethod === AUTH_METHODS.EMAIL ? (
                      <AuthFeedback
                        message={message}
                        errorMessage={errorMessage}
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>

              <View style={styles.methodGroup}>
                <AuthMethodButton
                  type="phone"
                  title="Telefono"
                  description="Codigo SMS con verificacion"
                  active={activeMethod === AUTH_METHODS.PHONE}
                  disabled={isBusy}
                  expandable
                  onPress={() => toggleAuthMethod(AUTH_METHODS.PHONE)}
                />
                {activeMethod === AUTH_METHODS.PHONE ? (
                  <View style={styles.expandedContent}>
                    <TextInput
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      onFocus={() => setShouldRenderRecaptcha(true)}
                      autoCapitalize="none"
                      keyboardType="phone-pad"
                      placeholder="+34600111222"
                      placeholderTextColor="#94A3B8"
                      style={styles.input}
                    />
                    {phoneVerificationId ? (
                      <>
                        <TextInput
                          value={smsCode}
                          onChangeText={setSmsCode}
                          keyboardType="number-pad"
                          placeholder="Codigo SMS"
                          placeholderTextColor="#94A3B8"
                          style={styles.input}
                        />
                        <View style={styles.row}>
                          <Pressable
                            style={[
                              styles.actionButton,
                              (!hasSmsCode || isBusy) && styles.disabledButton,
                            ]}
                            disabled={!hasSmsCode || isBusy}
                            onPress={() =>
                              runAuthAction('phoneConfirm', () =>
                                confirmPhoneVerificationCode(smsCode)
                              )
                            }
                          >
                            {busyAction === 'phoneConfirm' ? (
                              <ActivityIndicator color="#fff" size="small" />
                            ) : (
                              <Text style={styles.actionButtonText}>
                                Confirmar
                              </Text>
                            )}
                          </Pressable>
                          <Pressable
                            style={[
                              styles.outlineActionButton,
                              isBusy && styles.disabledButton,
                            ]}
                            disabled={isBusy}
                            onPress={() =>
                              runAuthAction(
                                'phoneSend',
                                async () =>
                                  sendPhoneVerificationCode(
                                    phoneNumber,
                                    await getRecaptchaVerifier()
                                  ),
                                'Codigo SMS enviado.'
                              )
                            }
                          >
                            {busyAction === 'phoneSend' ? (
                              <ActivityIndicator color="#4F46E5" size="small" />
                            ) : (
                              <Text style={styles.outlineActionButtonText}>
                                Reenviar
                              </Text>
                            )}
                          </Pressable>
                        </View>
                      </>
                    ) : (
                      <Pressable
                        style={[
                          styles.actionButton,
                          (!hasPhoneNumber || isBusy) && styles.disabledButton,
                        ]}
                        disabled={!hasPhoneNumber || isBusy}
                        onPress={() =>
                          runAuthAction(
                            'phoneSend',
                            async () =>
                              sendPhoneVerificationCode(
                                phoneNumber,
                                await getRecaptchaVerifier()
                              ),
                            'Codigo SMS enviado.'
                          )
                        }
                      >
                        {busyAction === 'phoneSend' ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.actionButtonText}>
                            Enviar codigo SMS
                          </Text>
                        )}
                      </Pressable>
                    )}
                    {feedbackMethod === AUTH_METHODS.PHONE ? (
                      <AuthFeedback
                        message={message}
                        errorMessage={errorMessage}
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>

              {allowGuest ? (
                <AuthMethodButton
                  type="guest"
                  title="Entrar como invitado"
                  description="Explorar Lunentra sin compromiso"
                  disabled={isBusy}
                  loading={busyAction === 'guest'}
                  onPress={() => runAuthAction('guest', signInAsGuest)}
                />
              ) : null}
            </View>

            {!feedbackMethod ? (
              <AuthFeedback message={message} errorMessage={errorMessage} />
            ) : null}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  onboardingLoader: {
    alignItems: 'center',
    backgroundColor: '#07111F',
    flex: 1,
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#07111F',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  hero: {
    minHeight: 245,
    justifyContent: 'flex-end',
  },
  heroImage: {
    opacity: 0.98,
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  heroContent: {
    alignSelf: 'center',
    maxWidth: 520,
    paddingHorizontal: 24,
    paddingBottom: 34,
    paddingTop: 44,
    width: '100%',
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  brandMark: {
    backgroundColor: '#fff',
    borderRadius: 8,
    height: 42,
    marginRight: 10,
    width: 42,
  },
  brandName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 27,
    fontWeight: '800',
    lineHeight: 36,
    maxWidth: 320,
  },
  heroText: {
    color: '#DDE7F6',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    maxWidth: 330,
  },
  authPanel: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    flexGrow: 1,
    marginTop: -14,
    minHeight: 430,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 28,
  },
  panelInner: {
    alignSelf: 'center',
    maxWidth: 520,
    width: '100%',
  },
  panelHeader: {
    marginBottom: 14,
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  valueNote: {
    alignItems: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: 9,
    marginBottom: 16,
    padding: 12,
  },
  valueNoteText: {
    color: colors.primaryDark,
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  methodList: {
    gap: 10,
  },
  methodGroup: {
    backgroundColor: '#fff',
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  methodButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 66,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  methodButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  methodButtonPressed: {
    transform: [{ scale: 0.992 }],
  },
  methodIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    marginRight: 12,
    width: 38,
  },
  methodIconActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  methodCopy: {
    flex: 1,
    paddingRight: 8,
  },
  methodTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  methodTitleActive: {
    color: '#fff',
  },
  methodDescription: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  methodDescriptionActive: {
    color: '#DDE7FF',
  },
  expandedContent: {
    backgroundColor: '#fff',
    borderBottomColor: colors.line,
    borderBottomLeftRadius: radii.md,
    borderBottomRightRadius: radii.md,
    borderBottomWidth: 1,
    borderLeftColor: colors.line,
    borderLeftWidth: 1,
    borderRightColor: colors.line,
    borderRightWidth: 1,
    padding: 14,
  },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    minHeight: 48,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: colors.midnight,
    borderRadius: radii.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  outlineActionButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: colors.primary,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  outlineActionButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  linkButton: {
    alignItems: 'center',
    minHeight: 42,
    justifyContent: 'center',
  },
  linkText: {
    color: colors.primary,
    fontWeight: '700',
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.45,
  },
  disabledText: {
    opacity: 0.45,
  },
  feedbackBox: {
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  feedbackBoxError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  feedbackText: {
    flex: 1,
    color: '#047857',
    fontSize: 13,
    lineHeight: 18,
  },
  feedbackTextError: {
    color: '#B91C1C',
  },
});
