import React, { useContext, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { GlobalContext } from '../GlobalContext';
import { PROFILE_QUESTIONS } from '../domain/profile';

function AutoResizingTextInput({
  value,
  onChangeText,
  placeholder,
  placeholderTextColor,
  style,
  onBlur,
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [contentHeight, setContentHeight] = useState(40);
  const MAX_HEIGHT = 100;

  const inputHeight = isFocused
    ? contentHeight
    : Math.min(contentHeight, MAX_HEIGHT);

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
      multiline
      onContentSizeChange={(event) =>
        setContentHeight(event.nativeEvent.contentSize.height)
      }
      onFocus={() => setIsFocused(true)}
      onBlur={() => {
        setIsFocused(false);
        if (onBlur) onBlur();
      }}
      style={[style, { height: Math.max(40, inputHeight) }]}
      textAlignVertical="top"
    />
  );
}

export default function Perfil() {
  const { respuestas, updateRespuestas } = useContext(GlobalContext);
  const completedQuestions = PROFILE_QUESTIONS.filter(
    item => respuestas[item.key]?.trim()
  ).length;

  const handleChange = (key, value) => {
    updateRespuestas({ ...respuestas, [key]: value });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introCard}>
          <Text style={styles.eyebrow}>CONTEXTO PERSONAL</Text>
          <Text style={styles.title}>Ayuda a Lunentra a comprender tu momento.</Text>
          <Text style={styles.introText}>
            Tus respuestas son opcionales. Sirven para evitar lecturas genéricas
            y dar prioridad a tu propia experiencia.
          </Text>
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${
                      (completedQuestions / PROFILE_QUESTIONS.length) * 100
                    }%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {completedQuestions}/{PROFILE_QUESTIONS.length}
            </Text>
          </View>
          <Text style={styles.privacyNote}>
            Se guarda cifrado en este dispositivo. Escribe solo lo que quieras
            compartir.
          </Text>
        </View>

        {PROFILE_QUESTIONS.map((item, index) => (
          <View key={item.key} style={styles.card}>
            <Text style={styles.questionNumber}>PREGUNTA {index + 1}</Text>
            <Text style={styles.question}>{item.pregunta}</Text>
            <AutoResizingTextInput
              placeholder="Tu respuesta (opcional)"
              placeholderTextColor="#aaa"
              value={respuestas[item.key]}
              onChangeText={(text) => handleChange(item.key, text)}
              style={styles.input}
            />
          </View>
        ))}

        <Text style={styles.footerNote}>
          Los cambios se guardan automáticamente y puedes modificarlos o borrarlos
          cuando quieras.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 34,
  },
  introCard: {
    backgroundColor: '#07111F',
    borderRadius: 16,
    marginBottom: 18,
    padding: 20,
  },
  eyebrow: {
    color: '#A5B4FC',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    marginTop: 8,
  },
  introText: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 9,
  },
  progressRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 17,
  },
  progressTrack: {
    backgroundColor: '#334155',
    borderRadius: 4,
    flex: 1,
    height: 7,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#A5B4FC',
    borderRadius: 4,
    height: '100%',
  },
  progressText: {
    color: '#E0E7FF',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 10,
  },
  privacyNote: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderColor: '#E2E8F0',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  questionNumber: {
    color: '#6366F1',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  question: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 12,
    marginTop: 5,
    color: '#111827',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    fontSize: 15,
    color: '#111827',
  },
  footerNote: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    textAlign: 'center',
  },
});
