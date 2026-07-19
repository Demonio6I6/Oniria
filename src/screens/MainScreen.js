import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  TouchableOpacity,
  Animated,
  Easing,
  DeviceEventEmitter,
  Alert,
} from 'react-native';
import {
  obtenerInterpretacionSueno,
  obtenerRespuestaChat,
  obtenerResumenInterpretacion,
  obtenerEmocionesDesdeContexto,
} from '../../openai';
import Markdown from 'react-native-markdown-display';
import AppIcon from '../components/AppIcon';
import { GlobalContext } from '../GlobalContext';
import {
  buildProfileContext,
  buildProfileSnapshot,
} from '../domain/profile';
import {
  buildDreamConversation,
  buildFullDreamInterpretation,
  createDreamId,
  createFallbackSummary,
  formatDateKey,
  normalizeDreamEmotions,
} from '../domain/dreams';
import {
  saveDreamRecord,
  updateDreamRecordById,
} from '../services/dreamRepository';
import { appendEmotionRecord } from '../services/emotionRepository';
import {
  acceptAiPrivacyNotice,
  hasAcceptedAiPrivacyNotice,
} from '../services/privacyRepository';
import { useSubscriptionAccess } from '../subscriptions/SubscriptionContext';
import { trackProductEvent } from '../services/productAnalytics';
import { colors, radii, spacing, typography } from '../theme/tokens';

function AssistantMessage({ text, markdownStyle }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <Markdown style={markdownStyle}>{text}</Markdown>
    </Animated.View>
  );
}

const TYPING_DOT_COUNT = 3;
const TYPING_DOT_SIZE = 7;
const TYPING_DOTS = Array.from({ length: TYPING_DOT_COUNT }, (_, index) => ({
  key: `typing-dot-${index}`,
}));

function LoadingSpinner() {
  const dotAnims = useRef(
    TYPING_DOTS.map(() => new Animated.Value(0))
  ).current;

  useEffect(() => {
    const animations = dotAnims.map((anim, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 120),
          Animated.timing(anim, {
            toValue: 1,
            duration: 320,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 320,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay((TYPING_DOT_COUNT - index - 1) * 120),
        ])
      )
    );

    animations.forEach(animation => animation.start());

    return () => {
      animations.forEach(animation => animation.stop());
    };
  }, [dotAnims]);

  return (
    <View style={styles.typingIndicator}>
      {TYPING_DOTS.map((dot, index) => {
        const opacity = dotAnims[index].interpolate({
          inputRange: [0, 1],
          outputRange: [0.35, 1],
        });
        const translateY = dotAnims[index].interpolate({
          inputRange: [0, 1],
          outputRange: [0, -5],
        });

        return (
          <Animated.View
            key={dot.key}
            style={[
              styles.typingDot,
              {
                opacity,
                transform: [{ translateY }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const INTERACTION_STEPS = {
  INITIAL: 'initial',
  FOLLOW_UP: 'follow_up',
  CLOSED: 'closed',
};

const WAKING_EMOTIONS = [
  'calma',
  'alegría',
  'miedo',
  'tristeza',
  'ansiedad',
  'confusión',
];

const RESONANCE_OPTIONS = [
  { value: 'yes', label: 'Me resonó' },
  { value: 'partial', label: 'En parte' },
  { value: 'no', label: 'No me representa' },
];

const guardarRegistroSueno = async ({
  dreamId: providedDreamId,
  timestamp: providedTimestamp,
  descripcion,
  interpretacion,
  contextoPerfil,
  profileSnapshot,
  wakingEmotion,
  wakingContext,
  updateExisting = false,
}) => {
  try {
    const timestamp = providedTimestamp || Date.now();
    const dreamId = providedDreamId || createDreamId(timestamp);
    const dateKey = formatDateKey(timestamp);

    const [resumen, emocionesDetectadas] = await Promise.all([
      obtenerResumenInterpretacion(interpretacion, dreamId).catch(error => {
        console.error('Error al resumir el sueño:', error);
        return createFallbackSummary(descripcion);
      }),
      obtenerEmocionesDesdeContexto(
        descripcion,
        contextoPerfil,
        dreamId
      ).catch(error => {
        console.error('Error extrayendo emociones:', error);
        return [];
      }),
    ]);

    const emociones = normalizeDreamEmotions(emocionesDetectadas);

    const nuevoSueno = {
      id: dreamId,
      schemaVersion: 4,
      description: descripcion,
      initialInterpretation: interpretacion,
      fullInterpretation: interpretacion,
      conversation: buildDreamConversation({
        description: descripcion,
        initialInterpretation: interpretacion,
      }),
      summary: resumen,
      emotions: emociones,
      profileSnapshot,
      wakingEmotion: wakingEmotion || '',
      wakingContext: wakingContext || '',
      personalReflection: '',
      resonance: '',
      interactionStatus: 'follow_up_available',
      promptVersion: 'dream_consultant_v2',
      timestamp,
      createdAt: timestamp,
      dateKey,
    };

    if (updateExisting) {
      await updateDreamRecordById(dreamId, nuevoSueno);
    } else {
      await saveDreamRecord(nuevoSueno);
    }

    if (emociones.length > 0) {
      await appendEmotionRecord({
        dreamId,
        emociones,
        timestamp,
        dateKey,
        source: 'dream_record_v2',
      });
    }

    return nuevoSueno;
  } catch (error) {
    console.error('Error al guardar el sueño:', error);
    return null;
  }
};

const guardarRegistroManual = async ({
  descripcion,
  profileSnapshot,
  wakingEmotion,
  wakingContext,
}) => {
  const timestamp = Date.now();
  const dreamId = createDreamId(timestamp);
  const dateKey = formatDateKey(timestamp);
  const emociones = normalizeDreamEmotions(
    wakingEmotion ? [wakingEmotion] : []
  );
  const record = {
    id: dreamId,
    schemaVersion: 4,
    description: descripcion,
    initialInterpretation: '',
    fullInterpretation: '',
    conversation: buildDreamConversation({ description: descripcion }),
    summary: createFallbackSummary(descripcion),
    emotions: emociones,
    profileSnapshot,
    wakingEmotion: wakingEmotion || '',
    wakingContext: wakingContext || '',
    personalReflection: '',
    resonance: '',
    interactionStatus: 'manual_saved',
    promptVersion: 'manual_v1',
    timestamp,
    createdAt: timestamp,
    dateKey,
  };

  await saveDreamRecord(record);

  if (emociones.length > 0) {
    await appendEmotionRecord({
      dreamId,
      emociones,
      timestamp,
      dateKey,
      source: 'manual_record_v1',
    });
  }

  return record;
};

const actualizarRegistroSuenoConAmpliacion = async ({
  dreamId,
  descripcion,
  initialInterpretation,
  followUpQuestion,
  followUpAnswer,
}) => {
  if (!dreamId) return null;

  const updatedAt = Date.now();
  const fullInterpretation = buildFullDreamInterpretation({
    initialInterpretation,
    followUpQuestion,
    followUpAnswer,
  });

  try {
    return await updateDreamRecordById(dreamId, dream => ({
      schemaVersion: 4,
      initialInterpretation:
        dream.initialInterpretation || initialInterpretation,
      fullInterpretation,
      conversation: buildDreamConversation({
        description: descripcion || dream.description,
        initialInterpretation:
          dream.initialInterpretation || initialInterpretation,
        followUpQuestion,
        followUpAnswer,
      }),
      followUp: {
        question: followUpQuestion,
        answer: followUpAnswer,
        createdAt: updatedAt,
      },
      interactionStatus: 'closed',
      updatedAt,
    }));
  } catch (error) {
    console.error('Error al actualizar el sueño con la ampliación:', error);
    return null;
  }
};

const confirmarPrivacidadIA = async () => {
  if (await hasAcceptedAiPrivacyNotice()) return true;

  return new Promise(resolve => {
    Alert.alert(
      'Privacidad de la interpretacion',
      'Para interpretar tu sueno se enviara el texto del sueno y las respuestas de tu perfil a nuestro servidor y al proveedor de IA. No se usa como diagnostico clinico.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'Aceptar',
          onPress: async () => {
            try {
              await acceptAiPrivacyNotice();
              resolve(true);
            } catch (error) {
              console.error('Error guardando consentimiento de privacidad:', error);
              Alert.alert(
                'Error',
                'No se pudo guardar tu preferencia de privacidad.'
              );
              resolve(false);
            }
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: () => resolve(false),
      }
    );
  });
};

const getFunctionErrorCode = (error) =>
  String(error?.code || '').replace(/^functions\//, '');

const getFunctionErrorDetails = (error) =>
  error?.details || error?.customData?.details || {};

const formatRetryAt = (retryAt) => {
  if (!retryAt) return '';

  const date = new Date(retryAt);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString([], {
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const buildInterpretationErrorMessage = (error, isInitialInteraction) => {
  const code = getFunctionErrorCode(error);
  const details = getFunctionErrorDetails(error);

  if (code === 'failed-precondition' && details.reason === 'account-required') {
    return 'Crea una cuenta para conservar tus suenos y continuar con esta lectura.';
  }

  if (code === 'resource-exhausted' && isInitialInteraction) {
    if (details.reason === 'interpretation-in-progress') {
      return 'Ya hay una interpretacion en curso. Espera un momento antes de intentar otra vez.';
    }

    if (details.reason === 'guest-demo-used') {
      return 'Ya usaste tu interpretacion demo como invitado. Crea una cuenta para continuar.';
    }

    if (details.reason === 'free-interpretation-limit') {
      return 'Ya usaste tus interpretaciones gratuitas. Premium desbloquea nuevas lecturas.';
    }

    if (details.reason === 'premium-required') {
      return 'Esta lectura requiere Lunentra Premium.';
    }

    if (details.reason === 'premium-monthly-limit') {
      return 'Ya usaste las lecturas Premium incluidas este mes.';
    }

    if (details.reason === 'premium-daily-limit') {
      const retryAt = details.retryAt || details.retryAtMillis;
      const formattedRetryAt = formatRetryAt(retryAt);
      return formattedRetryAt
        ? `Alcanzaste el límite operativo de hoy. Disponible de nuevo ${formattedRetryAt}.`
        : 'Alcanzaste el límite operativo de lecturas Premium de hoy.';
    }

    const retryAt = details.retryAt || details.retryAtMillis;
    const formattedRetryAt = formatRetryAt(retryAt);

    return formattedRetryAt
      ? `Ya usaste tu interpretacion disponible. Podras pedir otra a partir de ${formattedRetryAt}.`
      : 'Ya usaste tu interpretacion disponible por hoy. Podras pedir otra mas adelante.';
  }

  if (code === 'resource-exhausted') {
    return 'Esta interpretacion ya alcanzo su limite de ampliacion.';
  }

  return 'Hubo un error al obtener la interpretacion.';
};

const getPaywallReasonFromError = (error) => {
  const details = getFunctionErrorDetails(error);

  if (details.reason === 'account-required') return 'account-required';
  if (details.reason === 'guest-demo-used') return 'guest-demo-used';
  if (details.reason === 'free-interpretation-limit') {
    return 'free-interpretation-limit';
  }
  if (details.reason === 'premium-required') return 'premium-required';

  return '';
};

export default function MainScreen({ navigation, route }) {
  const { respuestas } = useContext(GlobalContext);
  const subscription = useSubscriptionAccess();
  const [descripcion, setDescripcion] = useState('');
  const [messages, setMessages] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [interactionStep, setInteractionStep] = useState(
    INTERACTION_STEPS.INITIAL
  );
  const [activeDream, setActiveDream] = useState(null);
  const [followUpInputVisible, setFollowUpInputVisible] = useState(false);
  const [inputHeight, setInputHeight] = useState(50);
  const [wakingEmotion, setWakingEmotion] = useState('');
  const [wakingContext, setWakingContext] = useState('');
  const [reflectionDraft, setReflectionDraft] = useState('');
  const [resonance, setResonance] = useState('');
  const [reflectionStatus, setReflectionStatus] = useState('');
  const [savedWithoutAi, setSavedWithoutAi] = useState(false);
  const [sourceManualDreamId, setSourceManualDreamId] = useState('');
  const [sourceManualDreamTimestamp, setSourceManualDreamTimestamp] = useState(0);
  const [optionalContextVisible, setOptionalContextVisible] = useState(false);

  const scrollViewRef = useRef(null);

  const reiniciarInterpretacion = () => {
    setMessages([]);
    setInteractionStep(INTERACTION_STEPS.INITIAL);
    setActiveDream(null);
    setFollowUpInputVisible(false);
    setDescripcion('');
    setInputHeight(50);
    setWakingEmotion('');
    setWakingContext('');
    setReflectionDraft('');
    setResonance('');
    setReflectionStatus('');
    setSavedWithoutAi(false);
    setSourceManualDreamId('');
    setSourceManualDreamTimestamp(0);
    setOptionalContextVisible(false);
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  };

  useEffect(() => {
    const newInterpretationSubscription = DeviceEventEmitter.addListener('newInterpretation', () => {
      reiniciarInterpretacion();
    });
    const accountConversionSubscription = DeviceEventEmitter.addListener(
      'accountConversionCompleted',
      event => {
        subscription.refresh();
        if (event?.reason === 'guest-follow-up') {
          setFollowUpInputVisible(true);
          setInputHeight(54);
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 120);
        }
      }
    );

    return () => {
      newInterpretationSubscription.remove();
      accountConversionSubscription.remove();
    };
  }, [subscription.refresh]);

  useEffect(() => {
    const manualDream = route?.params?.manualDream;
    if (!manualDream?.id || !manualDream?.description) return;

    setMessages([]);
    setInteractionStep(INTERACTION_STEPS.INITIAL);
    setActiveDream(null);
    setFollowUpInputVisible(false);
    setDescripcion(manualDream.description);
    setWakingEmotion(manualDream.wakingEmotion || '');
    setWakingContext(manualDream.wakingContext || '');
    setOptionalContextVisible(Boolean(manualDream.wakingEmotion || manualDream.wakingContext));
    setSourceManualDreamId(manualDream.id);
    setSourceManualDreamTimestamp(
      manualDream.createdAt || manualDream.timestamp || 0
    );
    setSavedWithoutAi(false);
    navigation.setParams({ manualDream: undefined });
  }, [navigation, route?.params?.manualDream]);

  const manejarEnvio = async () => {
    if (cargando || interactionStep === INTERACTION_STEPS.CLOSED) return;

    Keyboard.dismiss();
    const currentDescription = descripcion.trim();
    if (!currentDescription) return;

    const esPrimeraInteraccion =
      interactionStep === INTERACTION_STEPS.INITIAL;

    if (esPrimeraInteraccion) {
      const access = subscription.accessStatus?.interpretations;
      const blockedReason = access?.blockedReason || '';

      if (blockedReason === 'guest-demo-used') {
        subscription.showPaywall('guest-demo-used');
        return;
      }

      if (blockedReason === 'free-interpretation-limit') {
        subscription.showPaywall('free-interpretation-limit');
        return;
      }

      if (blockedReason) {
        const retryLabel = formatRetryAt(access?.retryAtMillis);
        Alert.alert(
          'Lectura no disponible',
          retryLabel
            ? `Podrás volver a usar una lectura ${retryLabel}.`
            : 'Has alcanzado el límite de lecturas disponible para tu plan.'
        );
        return;
      }
    }

    if (!esPrimeraInteraccion && subscription.isGuest) {
      subscription.showPaywall('guest-follow-up');
      return;
    }

    const privacidadAceptada = await confirmarPrivacidadIA();
    if (!privacidadAceptada) return;

    const userMessage = { role: 'user', text: currentDescription };
    const mensajesPrevios = [...messages];

    setMessages(prevMessages => [...prevMessages, userMessage]);
    setDescripcion('');
    setInputHeight(50);
    if (!esPrimeraInteraccion) {
      setFollowUpInputVisible(false);
    }
    setCargando(true);

    try {
      let resultado;
      const initialTimestamp = esPrimeraInteraccion
        ? sourceManualDreamTimestamp || Date.now()
        : null;
      const dreamSessionId = esPrimeraInteraccion
        ? sourceManualDreamId || createDreamId(initialTimestamp)
        : activeDream?.id || '';
      const profileSnapshot = esPrimeraInteraccion
        ? buildProfileSnapshot(respuestas)
        : activeDream?.profileSnapshot || buildProfileSnapshot(respuestas);
      const contextoPerfilBase = buildProfileContext(profileSnapshot);
      const contextoPerfil = [
        contextoPerfilBase,
        esPrimeraInteraccion && wakingEmotion
          ? `Emocion indicada por el usuario al despertar: ${wakingEmotion}`
          : '',
        esPrimeraInteraccion && wakingContext.trim()
          ? `Asociacion personal del usuario con su vida actual: ${wakingContext.trim()}`
          : '',
      ].filter(Boolean).join('\n\n');
      const contextoConversacion = mensajesPrevios
        .map(msg => `${msg.role}: ${msg.text}`)
        .join('\n');

      if (esPrimeraInteraccion) {
        resultado = await obtenerInterpretacionSueno(
          currentDescription,
          contextoPerfil,
          dreamSessionId
        );
      } else {
        resultado = await obtenerRespuestaChat(
          currentDescription,
          contextoPerfil,
          contextoConversacion,
          dreamSessionId
        );
      }

      console.log('Respuesta de la API:', resultado);
      setMessages(prevMessages => [
        ...prevMessages,
        { role: 'assistant', text: resultado },
      ]);

      if (esPrimeraInteraccion) {
        const suenoGuardado = await guardarRegistroSueno({
          dreamId: dreamSessionId,
          timestamp: initialTimestamp,
          descripcion: currentDescription,
          interpretacion: resultado,
          contextoPerfil,
          profileSnapshot,
          wakingEmotion,
          wakingContext: wakingContext.trim(),
          updateExisting: Boolean(sourceManualDreamId),
        });

        setActiveDream({
          id: suenoGuardado?.id || dreamSessionId,
          description: currentDescription,
          initialInterpretation: resultado,
          profileSnapshot,
          wakingEmotion,
          wakingContext: wakingContext.trim(),
        });
        setFollowUpInputVisible(false);
        setInteractionStep(INTERACTION_STEPS.FOLLOW_UP);
        setSourceManualDreamId('');
        setSourceManualDreamTimestamp(0);
        subscription.refresh();
        trackProductEvent('dream_interpretation_completed', {
          accountType: subscription.isGuest ? 'guest' :
            subscription.isPremium ? 'premium' : 'free',
        });
        if (subscription.isGuest) {
          trackProductEvent('guest_demo_completed');
        }
      } else {
        const firstUserMessage =
          activeDream?.description ||
          mensajesPrevios.find(message => message.role === 'user')?.text ||
          '';
        const firstAssistantMessage =
          activeDream?.initialInterpretation ||
          mensajesPrevios.find(message => message.role === 'assistant')?.text ||
          '';

        await actualizarRegistroSuenoConAmpliacion({
          dreamId: activeDream?.id,
          descripcion: firstUserMessage,
          initialInterpretation: firstAssistantMessage,
          followUpQuestion: currentDescription,
          followUpAnswer: resultado,
        });
        setInteractionStep(INTERACTION_STEPS.CLOSED);
      }
    } catch (error) {
      console.error('Error al obtener la interpretación:', error);
      setMessages(prevMessages => [
        ...prevMessages,
        {
          role: 'assistant',
          text: buildInterpretationErrorMessage(error, esPrimeraInteraccion),
        },
      ]);

      const paywallReason = getPaywallReasonFromError(error);
      if (paywallReason) {
        setTimeout(() => subscription.showPaywall(paywallReason), 250);
      }
    } finally {
      setCargando(false);
    }
  };

  const guardarSinInterpretacion = async () => {
    const currentDescription = descripcion.trim();
    if (!currentDescription || cargando) return;

    Keyboard.dismiss();
    setCargando(true);

    try {
      const profileSnapshot = buildProfileSnapshot(respuestas);
      const record = await guardarRegistroManual({
        descripcion: currentDescription,
        profileSnapshot,
        wakingEmotion,
        wakingContext: wakingContext.trim(),
      });

      setActiveDream({
        id: record.id,
        description: currentDescription,
        initialInterpretation: '',
        profileSnapshot,
        wakingEmotion,
        wakingContext: wakingContext.trim(),
      });
      setMessages([
        { role: 'user', text: currentDescription },
        {
          role: 'assistant',
          text: 'Tu sueño quedó guardado sin usar una lectura de IA. Puedes interpretarlo más adelante desde Mi diario.',
        },
      ]);
      setDescripcion('');
      setSavedWithoutAi(true);
      setInteractionStep(INTERACTION_STEPS.CLOSED);
      trackProductEvent('manual_dream_saved', {
        accountType: subscription.isGuest ? 'guest' :
          subscription.isPremium ? 'premium' : 'free',
      });
    } catch (error) {
      console.error('Error guardando el sueño sin IA:', error);
      Alert.alert('No se pudo guardar', 'Inténtalo de nuevo en unos segundos.');
    } finally {
      setCargando(false);
    }
  };

  const handleContentSizeChange = (event) => {
    const { height } = event.nativeEvent.contentSize;
    const minHeight =
      interactionStep === INTERACTION_STEPS.INITIAL ? 170 : 54;
    const maxHeight =
      interactionStep === INTERACTION_STEPS.INITIAL ? 260 : 128;

    setInputHeight(Math.min(Math.max(height, minHeight), maxHeight));
  };

  const handleOpenFollowUp = () => {
    if (subscription.isGuest) {
      subscription.showPaywall('guest-follow-up');
      return;
    }

    setFollowUpInputVisible(true);
    setInputHeight(54);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 80);
  };

  const guardarReflexionPersonal = async () => {
    if (!activeDream?.id || (!reflectionDraft.trim() && !resonance)) return;

    setReflectionStatus('saving');

    try {
      const updatedDream = await updateDreamRecordById(
        activeDream.id,
        dream => ({
          schemaVersion: 4,
          personalReflection: reflectionDraft.trim(),
          resonance,
          reflectionUpdatedAt: Date.now(),
          updatedAt: Date.now(),
          initialInterpretation:
            dream.initialInterpretation || activeDream.initialInterpretation,
        })
      );

      if (!updatedDream) {
        setReflectionStatus('error');
        return;
      }

      setActiveDream(currentDream => ({
        ...currentDream,
        personalReflection: updatedDream.personalReflection,
        resonance: updatedDream.resonance,
      }));
      setReflectionStatus('saved');
      trackProductEvent('reflection_saved', { source: 'interpretation-flow' });
    } catch (error) {
      console.error('Error guardando la reflexión personal:', error);
      setReflectionStatus('error');
    }
  };

  const markdownStyle = {
    body: {
      fontSize: 16,
      fontFamily: 'System',
      color: colors.ink,
      lineHeight: 24,
    },
    strong: {
      fontWeight: 'bold',
    },
    text: {
      fontSize: 16,
      fontFamily: 'System',
      color: colors.ink,
    },
    paragraph: {
      fontSize: 16,
      fontFamily: 'System',
      color: colors.ink,
      lineHeight: 24,
      marginBottom: 12,
    },
  };

  const cicloCerrado = interactionStep === INTERACTION_STEPS.CLOSED;
  const esPasoInicial = interactionStep === INTERACTION_STEPS.INITIAL;
  const esPasoAmpliacion = interactionStep === INTERACTION_STEPS.FOLLOW_UP;
  const descripcionLista = descripcion.trim().length > 0;
  const mostrarIntroInicial = messages.length === 0 && esPasoInicial;
  const mostrarComposerInicial = esPasoInicial && !cargando;
  const mostrarBotonAmpliacion =
    esPasoAmpliacion && !followUpInputVisible && !cargando;
  const mostrarComposerAmpliacion =
    esPasoAmpliacion && followUpInputVisible && !cargando;
  const interpretationUsage = subscription.accessStatus?.interpretations;
  const interpretationLimit = interpretationUsage?.limit ||
    (subscription.isGuest ? 1 : 3);
  const interpretationRemaining = interpretationUsage?.remaining ??
    interpretationLimit;
  const initialBlockedReason = interpretationUsage?.blockedReason || '';
  const initialPaywallReason = initialBlockedReason === 'guest-demo-used'
    ? 'guest-demo-used'
    : initialBlockedReason === 'free-interpretation-limit'
      ? 'free-interpretation-limit'
      : '';
  const interpretationRetryLabel = formatRetryAt(
    interpretationUsage?.retryAtMillis
  );
  const interpretationAvailabilityLabel = interpretationRetryLabel &&
    !initialPaywallReason
    ? `${interpretationRemaining} lecturas restantes · disponible ${interpretationRetryLabel}`
    : subscription.isPremium
      ? `${interpretationRemaining} de ${interpretationLimit} lecturas Premium disponibles este mes`
      : `${interpretationRemaining} de ${interpretationLimit} lecturas de IA disponibles`;

  const getUserMessageLabel = (messageIndex) => {
    if (!activeDream) return 'Tu sueño';

    const previousUserMessages = messages
      .slice(0, messageIndex)
      .filter(message => message.role === 'user').length;

    return previousUserMessages === 0 ? 'Tu sueño' : 'Tu ampliación';
  };

  const renderDreamComposer = (variant) => {
    const isInitialComposer = variant === INTERACTION_STEPS.INITIAL;
    const minHeight = isInitialComposer ? 170 : 54;
    const maxHeight = isInitialComposer ? 260 : 128;
    const composerHeight = Math.min(
      Math.max(inputHeight, minHeight),
      maxHeight
    );
    const aiActionLabel = isInitialComposer && initialPaywallReason
      ? subscription.isGuest ? 'Crear cuenta para interpretar' : 'Ver Premium'
      : isInitialComposer ? 'Explorar este sueño' : 'Profundizar';
    const aiActionDisabled = initialPaywallReason
      ? false
      : !descripcionLista || cargando;
    const handleAiAction = initialPaywallReason
      ? () => subscription.showPaywall(initialPaywallReason)
      : manejarEnvio;

    return (
      <View
        style={[
          styles.composerContainer,
          isInitialComposer
            ? styles.initialComposerContainer
            : styles.followUpComposerContainer,
        ]}
      >
        <Text style={styles.composerLabel}>
          {isInitialComposer ? '1 · Lo que recuerdas' : 'Tu ampliación'}
        </Text>
        {isInitialComposer ? (
          <View style={styles.usageBanner}>
            <Text style={styles.usageBannerTitle}>
              {interpretationAvailabilityLabel}
            </Text>
          </View>
        ) : null}
        <TextInput
          style={[
            styles.composerInput,
            isInitialComposer ? styles.initialInput : styles.followUpInput,
            { height: composerHeight },
          ]}
          placeholder={
            isInitialComposer
              ? 'Anota lo que recuerdas: lugares, personas, emociones, símbolos o cualquier detalle extraño.'
              : 'Pregunta por un símbolo, una emoción o una escena concreta.'
          }
          placeholderTextColor="#8A8A8A"
          value={descripcion}
          onChangeText={setDescripcion}
          multiline
          editable={!cargando}
          onContentSizeChange={handleContentSizeChange}
          scrollEnabled={composerHeight >= maxHeight}
          selectionColor="black"
          textAlignVertical="top"
        />
        {isInitialComposer ? (
          <TouchableOpacity
            style={styles.optionalContextToggle}
            onPress={() => setOptionalContextVisible(current => !current)}
          >
            <View style={styles.optionalContextToggleCopy}>
              <Text style={styles.optionalContextToggleTitle}>
                2 · Añadir emoción y contexto
              </Text>
              <Text style={styles.optionalContextToggleHint}>
                Opcional · hace la lectura más personal
              </Text>
            </View>
            <AppIcon
              name={optionalContextVisible ? 'chevronUp' : 'chevronDown'}
              size={19}
              color={colors.muted}
            />
          </TouchableOpacity>
        ) : null}
        {isInitialComposer && optionalContextVisible ? (
          <View style={styles.optionalContextSection}>
            <Text style={styles.optionalContextTitle}>
              ¿Cómo te sentiste al despertar?
            </Text>
            <Text style={styles.optionalContextHint}>
              Opcional. Tu propia emoción tiene más peso que cualquier símbolo.
            </Text>
            <View style={styles.emotionChips}>
              {WAKING_EMOTIONS.map(emotion => {
                const isSelected = wakingEmotion === emotion;

                return (
                  <TouchableOpacity
                    key={emotion}
                    style={[
                      styles.emotionChip,
                      isSelected && styles.emotionChipSelected,
                    ]}
                    onPress={() =>
                      setWakingEmotion(isSelected ? '' : emotion)
                    }
                  >
                    <Text
                      style={[
                        styles.emotionChipText,
                        isSelected && styles.emotionChipTextSelected,
                      ]}
                    >
                      {emotion}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              style={styles.wakingContextInput}
              value={wakingContext}
              onChangeText={setWakingContext}
              placeholder="¿Hay algo de tu vida actual que relaciones con este sueño? (opcional)"
              placeholderTextColor="#8A8A8A"
              multiline
              textAlignVertical="top"
            />
          </View>
        ) : null}
        <TouchableOpacity
          style={[
            styles.primaryActionButton,
            aiActionDisabled && styles.primaryActionDisabled,
          ]}
          onPress={handleAiAction}
          disabled={aiActionDisabled}
        >
          <Text style={styles.primaryActionText}>{aiActionLabel}</Text>
          <AppIcon name="send" size={19} color="#fff" />
        </TouchableOpacity>
        {isInitialComposer ? (
          <TouchableOpacity
            style={[
              styles.manualSaveButton,
              (!descripcionLista || cargando) && styles.manualSaveButtonDisabled,
            ]}
            onPress={guardarSinInterpretacion}
            disabled={!descripcionLista || cargando}
          >
            <Text style={styles.manualSaveButtonText}>
              Guardar en el diario sin usar IA
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding" enabled>
      <View style={styles.innerContainer}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesScrollView}
          contentContainerStyle={[
            styles.messagesContent,
            { flexGrow: 1 },
            mostrarIntroInicial ? styles.initialMessagesContent : {},
          ]}
          keyboardShouldPersistTaps="always"
        >
          {mostrarIntroInicial && (
            <View style={styles.initialIntro}>
              <Text style={styles.title}>
                Cuéntame lo que recuerdas
              </Text>
              <Text style={styles.subtitle}>
                No hace falta reconstruirlo entero. Empieza por una escena, una
                persona, una sensación o el detalle que siga contigo.
              </Text>
            </View>
          )}

          {mostrarComposerInicial && messages.length === 0 &&
            renderDreamComposer(INTERACTION_STEPS.INITIAL)}

          {messages.map((message, index) => (
            <View
              key={index}
              style={[
                styles.message,
                message.role === 'user'
                  ? styles.userMessage
                  : styles.chatgptMessage,
              ]}
            >
              {message.role === 'assistant' ? (
                <AssistantMessage
                  text={message.text}
                  markdownStyle={markdownStyle}
                />
              ) : (
                <>
                  <Text style={styles.userMessageLabel}>
                    {getUserMessageLabel(index)}
                  </Text>
                  <Text style={styles.messageText}>{message.text}</Text>
                </>
              )}
            </View>
          ))}

          {cargando && (
            <View style={[styles.message, styles.loadingMessage]}>
              <LoadingSpinner />
            </View>
          )}

          {mostrarComposerInicial && messages.length > 0 &&
            renderDreamComposer(INTERACTION_STEPS.INITIAL)}

          {activeDream && !cargando && !esPasoInicial && !savedWithoutAi ? (
            <View style={styles.reflectionCard}>
              <Text style={styles.reflectionEyebrow}>TU VOZ IMPORTA</Text>
              <Text style={styles.reflectionTitle}>
                ¿Qué parte te hizo pensar?
              </Text>
              <Text style={styles.reflectionHint}>
                La lectura es solo una hipótesis. Guarda lo que te resulte útil y
                descarta lo que no te represente.
              </Text>

              <View style={styles.resonanceRow}>
                {RESONANCE_OPTIONS.map(option => {
                  const isSelected = resonance === option.value;

                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.resonanceButton,
                        isSelected && styles.resonanceButtonSelected,
                      ]}
                      onPress={() => {
                        setResonance(isSelected ? '' : option.value);
                        setReflectionStatus('');
                      }}
                    >
                      <Text
                        style={[
                          styles.resonanceButtonText,
                          isSelected && styles.resonanceButtonTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInput
                value={reflectionDraft}
                onChangeText={text => {
                  setReflectionDraft(text);
                  setReflectionStatus('');
                }}
                style={styles.reflectionInput}
                placeholder="Escribe una conclusión, una pregunta o algo que quieras recordar."
                placeholderTextColor="#8A8A8A"
                multiline
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[
                  styles.saveReflectionButton,
                  (!reflectionDraft.trim() && !resonance) &&
                    styles.saveReflectionButtonDisabled,
                ]}
                disabled={
                  reflectionStatus === 'saving' ||
                  (!reflectionDraft.trim() && !resonance)
                }
                onPress={guardarReflexionPersonal}
              >
                <Text style={styles.saveReflectionButtonText}>
                  {reflectionStatus === 'saving'
                    ? 'Guardando...'
                    : 'Guardar mi reflexión'}
                </Text>
              </TouchableOpacity>

              {reflectionStatus === 'saved' ? (
                <Text style={styles.reflectionSuccess}>
                  Tu reflexión quedó guardada en el diario.
                </Text>
              ) : null}
              {reflectionStatus === 'error' ? (
                <Text style={styles.reflectionError}>
                  No se pudo guardar. Inténtalo de nuevo.
                </Text>
              ) : null}
            </View>
          ) : null}

          {subscription.isGuest && activeDream && !esPasoInicial ? (
            <TouchableOpacity
              style={styles.accountUpgradeCard}
              onPress={() => subscription.showPaywall(
                activeDream.initialInterpretation
                  ? 'guest-follow-up'
                  : 'account-required'
              )}
            >
              <Text style={styles.accountUpgradeTitle}>
                {activeDream.initialInterpretation
                  ? 'Profundiza en esta lectura'
                  : 'Mantén tu recorrido en esta sesión'}
              </Text>
              <Text style={styles.accountUpgradeText}>
                Crea una cuenta gratuita para desbloquear tus lecturas restantes
                y continuar desde aquí.
              </Text>
              <Text style={styles.accountUpgradeAction}>Crear cuenta →</Text>
            </TouchableOpacity>
          ) : null}

          {cicloCerrado && (
            <View style={styles.closedNotice}>
              <Text style={styles.closedNoticeText}>
                {savedWithoutAi
                  ? 'Registro guardado sin usar una lectura de IA.'
                  : 'Registro guardado con la lectura y tu ampliación.'}
              </Text>
              <TouchableOpacity
                style={styles.newDreamButton}
                onPress={reiniciarInterpretacion}
              >
                <AppIcon name="plusCircle" size={18} color="#fff" />
                <Text style={styles.newDreamButtonText}>
                  Registrar otro sueño
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {mostrarBotonAmpliacion && (
            <View style={styles.followUpPrompt}>
              <Text style={styles.followUpPromptTitle}>
                ¿Quieres profundizar en una escena, símbolo o emoción?
              </Text>
              <TouchableOpacity
                style={styles.followUpButton}
                onPress={handleOpenFollowUp}
              >
                <Text style={styles.followUpButtonText}>
                  Profundizar
                </Text>
                <AppIcon name="arrowRight" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {mostrarComposerAmpliacion &&
            renderDreamComposer(INTERACTION_STEPS.FOLLOW_UP)}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  innerContainer: {
    flex: 1,
  },
  messagesScrollView: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  messagesContent: {
    paddingVertical: spacing.xl,
  },
  initialMessagesContent: {
    justifyContent: 'center',
  },
  initialIntro: {
    alignSelf: 'center',
    marginBottom: spacing.xxl,
    maxWidth: 520,
    width: '100%',
  },
  title: {
    ...typography.title,
    color: colors.ink,
    marginBottom: spacing.sm,
    textAlign: 'left',
  },
  subtitle: {
    ...typography.body,
    color: colors.muted,
  },
  composerContainer: {
    alignSelf: 'center',
    backgroundColor: 'transparent',
    maxWidth: 520,
    width: '100%',
  },
  initialComposerContainer: {
    marginBottom: 8,
  },
  followUpComposerContainer: {
    marginTop: 6,
    marginBottom: 16,
  },
  composerLabel: {
    ...typography.eyebrow,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  usageBanner: {
    marginBottom: spacing.sm,
  },
  usageBannerTitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  usageBannerText: {
    color: '#6366F1',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  composerInput: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    fontFamily: 'System',
    lineHeight: 22,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  initialInput: {
    minHeight: 170,
  },
  followUpInput: {
    minHeight: 54,
  },
  optionalContextSection: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.md,
    marginTop: spacing.sm,
    padding: spacing.lg,
  },
  optionalContextToggle: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 62,
    paddingVertical: spacing.sm,
  },
  optionalContextToggleCopy: {
    flex: 1,
  },
  optionalContextToggleTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  optionalContextToggleHint: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 3,
  },
  optionalContextTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  optionalContextHint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  emotionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 11,
  },
  emotionChip: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  emotionChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  emotionChipText: {
    color: colors.muted,
    fontSize: 12,
    textTransform: 'capitalize',
  },
  emotionChipTextSelected: {
    color: colors.white,
    fontWeight: '800',
  },
  wakingContextInput: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 11,
    minHeight: 84,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  primaryActionButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.midnight,
    borderRadius: radii.md,
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  primaryActionDisabled: {
    opacity: 0.35,
  },
  primaryActionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginRight: 8,
  },
  manualSaveButton: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 14,
  },
  manualSaveButtonDisabled: {
    opacity: 0.45,
  },
  manualSaveButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  message: {
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm,
  },
  userMessage: {
    alignSelf: 'center',
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.md,
    maxWidth: '100%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    width: '100%',
  },
  chatgptMessage: {
    backgroundColor: 'transparent',
    alignSelf: 'center',
    width: '100%',
    maxWidth: '100%',
    borderRadius: 0,
    marginBottom: 10,
  },
  messageText: {
    fontSize: 16,
    fontFamily: 'System',
    color: colors.ink,
    lineHeight: 22,
  },
  userMessageLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  loadingMessage: {
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  reflectionCard: {
    alignSelf: 'center',
    backgroundColor: colors.warmSoft,
    borderRadius: radii.lg,
    marginBottom: 18,
    marginTop: 8,
    maxWidth: 520,
    padding: 16,
    width: '100%',
  },
  reflectionEyebrow: {
    color: colors.warm,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  reflectionTitle: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: '800',
    marginTop: 6,
  },
  reflectionHint: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  resonanceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 13,
  },
  resonanceButton: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  resonanceButtonSelected: {
    backgroundColor: colors.warm,
    borderColor: colors.warm,
  },
  resonanceButtonText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  resonanceButtonTextSelected: {
    color: '#fff',
  },
  reflectionInput: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
    minHeight: 92,
    padding: 11,
  },
  saveReflectionButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.midnight,
    borderRadius: radii.md,
    justifyContent: 'center',
    marginTop: 11,
    minHeight: 42,
    paddingHorizontal: 14,
  },
  saveReflectionButtonDisabled: {
    opacity: 0.45,
  },
  saveReflectionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  reflectionSuccess: {
    color: '#047857',
    fontSize: 12,
    marginTop: 9,
  },
  reflectionError: {
    color: '#B91C1C',
    fontSize: 12,
    marginTop: 9,
  },
  accountUpgradeCard: {
    alignSelf: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.lg,
    marginBottom: 16,
    maxWidth: 520,
    padding: 16,
    width: '100%',
  },
  accountUpgradeTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  accountUpgradeText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  accountUpgradeAction: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 9,
  },
  typingIndicator: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderRadius: 18,
    flexDirection: 'row',
    minHeight: 34,
    paddingHorizontal: 13,
    paddingVertical: 9,
    justifyContent: 'center',
  },
  typingDot: {
    backgroundColor: '#333',
    borderRadius: TYPING_DOT_SIZE / 2,
    height: TYPING_DOT_SIZE,
    marginHorizontal: 3,
    width: TYPING_DOT_SIZE,
  },
  closedNotice: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  closedNoticeText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 10,
    textAlign: 'center',
  },
  newDreamButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.midnight,
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  newDreamButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  followUpPrompt: {
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 2,
    marginBottom: 16,
    maxWidth: 520,
    width: '100%',
  },
  followUpPromptTitle: {
    color: '#555',
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'center',
  },
  followUpButton: {
    alignItems: 'center',
    backgroundColor: colors.midnight,
    borderRadius: radii.md,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
  },
  followUpButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginRight: 8,
  },
});
