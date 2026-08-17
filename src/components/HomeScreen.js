// src/components/HomeScreen.js
import React, { useEffect, useState } from 'react';
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
import AppIcon from './AppIcon';
import OnboardingScreen from './OnboardingScreen';
import { trackProductEvent } from '../services/productAnalytics';
import { radii, spacing } from '../theme/tokens';
import { useAppTheme, useThemeStyles } from '../theme/ThemeContext';

const AUTH_METHODS = {
  EMAIL: 'email',
};

const ACTION_FEEDBACK_METHOD = {
  emailSignIn: AUTH_METHODS.EMAIL,
  emailRegister: AUTH_METHODS.EMAIL,
  resetPassword: AUTH_METHODS.EMAIL,
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
  'auth/missing-password': 'Escribe una contrasena.',
  'auth/operation-not-allowed': 'Activa este proveedor en Firebase Authentication.',
  'auth/user-not-found': 'No existe una cuenta con ese correo.',
  'auth/weak-password': 'La contrasena debe tener al menos 6 caracteres.',
  'auth/wrong-password': 'La contrasena no es correcta.',
};

function getAuthErrorMessage(error) {
  return ERROR_MESSAGES[error?.code] || error?.message || 'No se pudo completar la autenticacion.';
}

function AuthMethodIcon({ type, active }) {
  const { colors } = useAppTheme();
  const iconColor = active ? colors.white : colors.primary;

  const iconNameByType = {
    google: 'google',
    email: 'email',
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
  const { colors } = useAppTheme();
  const styles = useThemeStyles(createStyles);

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
        <ActivityIndicator
          color={active ? colors.white : colors.primary}
          size="small"
        />
      ) : expandable ? (
        <AppIcon
          name={active ? 'chevronUp' : 'chevronDown'}
          size={19}
          color={active ? colors.white : colors.muted}
        />
      ) : (
        <AppIcon
          name="arrowRight"
          size={19}
          color={active ? colors.white : colors.muted}
        />
      )}
    </Pressable>
  );
}

function AuthFeedback({ message, errorMessage }) {
  const { colors } = useAppTheme();
  const styles = useThemeStyles(createStyles);

  if (!message && !errorMessage) return null;

  const isError = Boolean(errorMessage);

  return (
    <View style={[styles.feedbackBox, isError && styles.feedbackBoxError]}>
      <AppIcon
        name={isError ? 'alertCircle' : 'checkCircle'}
        size={18}
        color={isError ? colors.danger : colors.success}
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
  signInAsGuest,
  forceAuthOptions = false,
  allowGuest = true,
  panelTitle = 'Empieza tu diario',
  panelSubtitle = 'Elige cómo quieres guardar tu recorrido.',
  heroTitle = 'Conócete a través de lo que sueñas.',
  heroText = 'Registra tus sueños, explora posibles significados y reconoce patrones con el tiempo.',
}) {
  const { colors } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busyAction, setBusyAction] = useState(null);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [activeMethod, setActiveMethod] = useState(null);
  const [feedbackMethod, setFeedbackMethod] = useState(null);
  const [onboardingLoading, setOnboardingLoading] = useState(!forceAuthOptions);
  const [onboardingCompleted, setOnboardingCompleted] = useState(
    forceAuthOptions
  );

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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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
              <AppIcon name="info" size={18} color={colors.primary} />
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
                      placeholderTextColor={colors.subtle}
                      style={styles.input}
                    />
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      placeholder="Contrasena"
                      placeholderTextColor={colors.subtle}
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
                          <ActivityIndicator color={colors.white} size="small" />
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
                          <ActivityIndicator color={colors.primary} size="small" />
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
                        <ActivityIndicator color={colors.primary} size="small" />
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

const createStyles = colors => StyleSheet.create({
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
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  methodButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
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
    color: colors.white,
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
    backgroundColor: colors.surface,
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
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  outlineActionButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
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
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  feedbackBoxError: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  feedbackText: {
    flex: 1,
    color: colors.success,
    fontSize: 13,
    lineHeight: 18,
  },
  feedbackTextError: {
    color: colors.danger,
  },
});
