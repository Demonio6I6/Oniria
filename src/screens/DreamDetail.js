import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import AppIcon from '../components/AppIcon';
import {
  getDreamId,
  getDreamInterpretation,
  getDreamTimestamp,
} from '../domain/dreams';
import {
  loadSavedDreams,
  updateDreamRecordById,
} from '../services/dreamRepository';
import { trackProductEvent } from '../services/productAnalytics';
import { colors, radii, screenPadding, spacing, typography } from '../theme/tokens';

const RESONANCE_OPTIONS = [
  { value: 'resuena', label: 'Me representa' },
  { value: 'parcial', label: 'En parte' },
  { value: 'no_resuena', label: 'No me representa' },
];

export default function DreamDetail({ navigation, route }) {
  const dreamId = route.params?.dreamId;
  const [dream, setDream] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reflection, setReflection] = useState('');
  const [resonance, setResonance] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const loadDream = async () => {
      try {
        const dreams = await loadSavedDreams();
        const selectedDream = dreams.find(item => getDreamId(item) === dreamId);
        setDream(selectedDream || null);
        setReflection(selectedDream?.personalReflection || '');
        setResonance(selectedDream?.resonance || '');
      } finally {
        setLoading(false);
      }
    };

    loadDream();
    const unsubscribe = navigation.addListener('focus', loadDream);
    return unsubscribe;
  }, [dreamId, navigation]);

  const saveReflection = async () => {
    if (!dreamId || (!reflection.trim() && !resonance)) return;
    setStatus('saving');

    try {
      const updated = await updateDreamRecordById(dreamId, {
        personalReflection: reflection.trim(),
        resonance,
        reflectionUpdatedAt: Date.now(),
        updatedAt: Date.now(),
      });
      setDream(updated || dream);
      setStatus(updated ? 'saved' : 'error');
      if (updated) {
        trackProductEvent('reflection_saved', { source: 'dream-detail' });
      }
    } catch (error) {
      console.error('Error actualizando la reflexión:', error);
      setStatus('error');
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="small" />
      </View>
    );
  }

  if (!dream) {
    return (
      <View style={styles.loading}>
        <Text style={styles.emptyTitle}>Este registro ya no está disponible.</Text>
      </View>
    );
  }

  const interpretation = getDreamInterpretation(dream);
  const createdAt = new Date(getDreamTimestamp(dream));

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>
          {createdAt.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }).toUpperCase()}
        </Text>
        <Text style={styles.title}>Lo que soñaste</Text>
        <Text style={styles.dreamText}>{dream.description}</Text>

        {dream.wakingEmotion || dream.wakingContext ? (
          <View style={styles.contextBlock}>
            {dream.wakingEmotion ? (
              <View style={styles.contextRow}>
                <Text style={styles.contextLabel}>Al despertar</Text>
                <Text style={styles.contextValue}>{dream.wakingEmotion}</Text>
              </View>
            ) : null}
            {dream.wakingContext ? (
              <View style={styles.contextRowColumn}>
                <Text style={styles.contextLabel}>Tu asociación</Text>
                <Text style={styles.contextParagraph}>{dream.wakingContext}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.divider} />

        {interpretation ? (
          <View>
            <Text style={styles.eyebrow}>LECTURA ORIENTATIVA</Text>
            <Text style={styles.sectionTitle}>Una posibilidad para explorar</Text>
            <Markdown style={markdownStyles}>{interpretation}</Markdown>
          </View>
        ) : (
          <View style={styles.manualBlock}>
            <View style={styles.manualIcon}>
              <AppIcon name="moon" size={20} color={colors.primary} />
            </View>
            <View style={styles.manualCopy}>
              <Text style={styles.manualTitle}>Guardado sin lectura de IA</Text>
              <Text style={styles.manualText}>
                Este sueño ya forma parte de tu recorrido y puedes interpretarlo cuando quieras.
              </Text>
              <TouchableOpacity
                style={styles.inlineAction}
                onPress={() => navigation.navigate('NuevoSueno', { manualDream: dream })}
              >
                <Text style={styles.inlineActionText}>Explorar este sueño</Text>
                <AppIcon name="arrowRight" size={17} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.reflectionSection}>
          <Text style={styles.eyebrow}>TU VOZ IMPORTA</Text>
          <Text style={styles.sectionTitle}>¿Qué te deja este sueño?</Text>
          <Text style={styles.sectionHint}>
            La lectura es solo una hipótesis. Conserva aquello que tenga sentido para ti.
          </Text>

          <View style={styles.resonanceRow}>
            {RESONANCE_OPTIONS.map(option => {
              const selected = resonance === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.resonanceChip, selected && styles.resonanceChipSelected]}
                  onPress={() => {
                    setResonance(selected ? '' : option.value);
                    setStatus('');
                  }}
                >
                  <Text
                    style={[
                      styles.resonanceText,
                      selected && styles.resonanceTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            style={styles.reflectionInput}
            value={reflection}
            onChangeText={text => {
              setReflection(text);
              setStatus('');
            }}
            placeholder="Escribe algo que quieras recordar..."
            placeholderTextColor={colors.subtle}
            multiline
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[
              styles.saveButton,
              !reflection.trim() && !resonance && styles.saveButtonDisabled,
            ]}
            disabled={status === 'saving' || (!reflection.trim() && !resonance)}
            onPress={saveReflection}
          >
            <Text style={styles.saveButtonText}>
              {status === 'saving' ? 'Guardando...' : 'Guardar reflexión'}
            </Text>
          </TouchableOpacity>

          {status === 'saved' ? (
            <Text style={styles.successText}>Tu reflexión está guardada.</Text>
          ) : null}
          {status === 'error' ? (
            <Text style={styles.errorText}>No se pudo guardar. Inténtalo de nuevo.</Text>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const markdownStyles = {
  body: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 23,
  },
  paragraph: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 13,
  },
  heading1: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 8,
    marginTop: 18,
  },
  heading2: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 7,
    marginTop: 16,
  },
  strong: {
    fontWeight: '800',
  },
};

const styles = StyleSheet.create({
  keyboardView: { flex: 1 },
  screen: { backgroundColor: colors.background, flex: 1 },
  container: {
    paddingBottom: 48,
    paddingHorizontal: screenPadding,
    paddingTop: spacing.lg,
  },
  loading: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: screenPadding,
  },
  emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  eyebrow: { ...typography.eyebrow, color: colors.primary },
  title: { ...typography.title, color: colors.ink, marginTop: spacing.sm },
  dreamText: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 27,
    marginTop: spacing.lg,
  },
  contextBlock: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.md,
    marginTop: spacing.xxl,
    padding: spacing.lg,
  },
  contextRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  contextRowColumn: { marginTop: spacing.md },
  contextLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  contextValue: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  contextParagraph: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 5,
  },
  divider: {
    backgroundColor: colors.line,
    height: 1,
    marginVertical: spacing.xxxl,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.ink,
    marginTop: 5,
  },
  sectionHint: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  manualBlock: {
    alignItems: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.lg,
    flexDirection: 'row',
    padding: spacing.lg,
  },
  manualIcon: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 11,
    height: 40,
    justifyContent: 'center',
    marginRight: spacing.md,
    width: 40,
  },
  manualCopy: { flex: 1 },
  manualTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  manualText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  inlineAction: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  inlineActionText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    marginRight: 5,
  },
  reflectionSection: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    marginTop: spacing.xxxl,
    paddingTop: spacing.xxxl,
  },
  resonanceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  resonanceChip: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
  resonanceChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  resonanceText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  resonanceTextSelected: { color: colors.white },
  reflectionInput: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.lg,
    minHeight: 118,
    padding: spacing.lg,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.midnight,
    borderRadius: radii.md,
    justifyContent: 'center',
    marginTop: spacing.md,
    minHeight: 50,
  },
  saveButtonDisabled: { opacity: 0.35 },
  saveButtonText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  successText: {
    color: colors.success,
    fontSize: 12,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
