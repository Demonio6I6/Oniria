import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  TouchableOpacity,
  Animated,
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
import { Ionicons } from '@expo/vector-icons';
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

const INTERACTION_STEPS = {
  INITIAL: 'initial',
  FOLLOW_UP: 'follow_up',
  CLOSED: 'closed',
};

const guardarRegistroSueno = async ({
  dreamId: providedDreamId,
  timestamp: providedTimestamp,
  descripcion,
  interpretacion,
  contextoPerfil,
  profileSnapshot,
}) => {
  try {
    const timestamp = providedTimestamp || Date.now();
    const dreamId = providedDreamId || createDreamId(timestamp);
    const dateKey = formatDateKey(timestamp);

    const [resumen, emocionesDetectadas] = await Promise.all([
      obtenerResumenInterpretacion(interpretacion).catch(error => {
        console.error('Error al resumir el sueño:', error);
        return createFallbackSummary(descripcion);
      }),
      obtenerEmocionesDesdeContexto(descripcion, contextoPerfil).catch(error => {
        console.error('Error extrayendo emociones:', error);
        return [];
      }),
    ]);

    const emociones = normalizeDreamEmotions(emocionesDetectadas);

    const nuevoSueno = {
      id: dreamId,
      schemaVersion: 3,
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
      interactionStatus: 'follow_up_available',
      promptVersion: 'dream_consultant_v2',
      timestamp,
      createdAt: timestamp,
      dateKey,
    };

    await saveDreamRecord(nuevoSueno);

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
      schemaVersion: 3,
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

export default function MainScreen() {
  const { respuestas } = useContext(GlobalContext);
  const [descripcion, setDescripcion] = useState('');
  const [messages, setMessages] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [interactionStep, setInteractionStep] = useState(
    INTERACTION_STEPS.INITIAL
  );
  const [activeDream, setActiveDream] = useState(null);
  const [inputHeight, setInputHeight] = useState(50);

  const scrollViewRef = useRef(null);

  const reiniciarInterpretacion = () => {
    setMessages([]);
    setInteractionStep(INTERACTION_STEPS.INITIAL);
    setActiveDream(null);
    setDescripcion('');
    setInputHeight(50);
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  };

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('newInterpretation', () => {
      reiniciarInterpretacion();
    });

    return () => subscription.remove();
  }, []);

  const manejarEnvio = async () => {
    if (cargando || interactionStep === INTERACTION_STEPS.CLOSED) return;

    Keyboard.dismiss();
    const currentDescription = descripcion.trim();
    if (!currentDescription) return;

    const privacidadAceptada = await confirmarPrivacidadIA();
    if (!privacidadAceptada) return;

    const userMessage = { role: 'user', text: currentDescription };
    const mensajesPrevios = [...messages];

    setMessages(prevMessages => [...prevMessages, userMessage]);
    setDescripcion('');
    setInputHeight(50);
    setCargando(true);

    try {
      let resultado;
      const esPrimeraInteraccion =
        interactionStep === INTERACTION_STEPS.INITIAL;
      const initialTimestamp = esPrimeraInteraccion ? Date.now() : null;
      const dreamSessionId = esPrimeraInteraccion
        ? createDreamId(initialTimestamp)
        : activeDream?.id || '';
      const profileSnapshot = esPrimeraInteraccion
        ? buildProfileSnapshot(respuestas)
        : activeDream?.profileSnapshot || buildProfileSnapshot(respuestas);
      const contextoPerfil = buildProfileContext(profileSnapshot);
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
        });

        setActiveDream({
          id: suenoGuardado?.id || dreamSessionId,
          description: currentDescription,
          initialInterpretation: resultado,
          profileSnapshot,
        });
        setInteractionStep(INTERACTION_STEPS.FOLLOW_UP);
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
        { role: 'assistant', text: 'Hubo un error al obtener la interpretación.' },
      ]);
    } finally {
      setCargando(false);
    }
  };

  const handleContentSizeChange = (event) => {
    const { contentSize } = event.nativeEvent;
    if (contentSize.height <= 100) {
      setInputHeight(50);
    } else {
      setInputHeight(contentSize.height);
    }
  };

  const markdownStyle = {
    body: {
      fontSize: 16,
      fontFamily: 'System',
      color: '#333',
    },
    strong: {
      fontWeight: 'bold',
    },
    text: {
      fontSize: 16,
      fontFamily: 'System',
      color: '#333',
    },
    paragraph: {
      fontSize: 16,
      fontFamily: 'System',
      color: '#333',
      marginBottom: 10,
    },
  };

  const cicloCerrado = interactionStep === INTERACTION_STEPS.CLOSED;

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding" enabled>
      <View style={styles.innerContainer}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesScrollView}
          contentContainerStyle={[
            styles.messagesContent,
            { flexGrow: 1 },
            messages.length === 0
              ? { justifyContent: 'center', alignItems: 'center' }
              : {},
          ]}
          keyboardShouldPersistTaps="always"
        >
          {messages.length === 0 && (
            <Text style={styles.title}>Interpreta tu sueño</Text>
          )}

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
                <Text style={styles.messageText}>{message.text}</Text>
              )}
            </View>
          ))}

          {cargando && (
            <View style={styles.message}>
              <Text style={styles.messageText}>Cargando...</Text>
            </View>
          )}

          {cicloCerrado && (
            <View style={styles.closedNotice}>
              <Text style={styles.closedNoticeText}>
                Interpretación guardada con la ampliación.
              </Text>
              <TouchableOpacity
                style={styles.newDreamButton}
                onPress={reiniciarInterpretacion}
              >
                <Ionicons name="refresh" size={18} color="#fff" />
                <Text style={styles.newDreamButtonText}>
                  Nueva interpretación
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.fixedInputContainer}>
            <TextInput
              style={[styles.input, { flex: 1, height: inputHeight }]}
              placeholder={
                cicloCerrado
                  ? 'Interpretación guardada'
                  : interactionStep === INTERACTION_STEPS.INITIAL
                  ? 'Describe tu sueño...'
                  : '¿Quieres profundizar más?'
              }
              value={descripcion}
              onChangeText={setDescripcion}
              multiline
              editable={!cicloCerrado && !cargando}
              onContentSizeChange={handleContentSizeChange}
              selectionColor="black"
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (cicloCerrado || cargando) && styles.sendButtonDisabled,
              ]}
              onPress={manejarEnvio}
              disabled={cicloCerrado || cargando}
            >
              <Ionicons name="arrow-forward" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  innerContainer: {
    flex: 1,
  },
  messagesScrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  messagesContent: {
    paddingVertical: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  fixedInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    elevation: 0,
    borderRadius: 0,
  },
  input: {
    borderColor: '#fff',
    borderWidth: 0,
    padding: 10,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    elevation: 0,
    fontSize: 16,
    fontFamily: 'System',
    color: '#333',
  },
  sendButton: {
    width: 47,
    height: 47,
    borderRadius: 25,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: '#999',
    elevation: 0,
  },
  message: {
    marginBottom: 10,
    padding: 10,
    borderRadius: 10,
  },
  userMessage: {
    backgroundColor: '#f0f0f0',
    alignSelf: 'flex-end',
    maxWidth: '80%',
    elevation: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  chatgptMessage: {
    backgroundColor: '#fff',
    alignSelf: 'center',
    width: '100%',
    maxWidth: '100%',
    borderRadius: 0,
    marginBottom: 10,
  },
  messageText: {
    fontSize: 16,
    fontFamily: 'System',
    color: '#333',
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
    backgroundColor: '#000',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  newDreamButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
});
