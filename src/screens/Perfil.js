import React, { useContext, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AppIcon from '../components/AppIcon';
import { GlobalContext } from '../GlobalContext';
import { PROFILE_QUESTIONS } from '../domain/profile';
import { colors, radii, screenPadding, spacing, typography } from '../theme/tokens';

const QUESTION_GROUPS = [
  {
    id: 'present',
    title: 'Mi momento actual',
    description: 'Cómo te sientes y qué ocupa tu atención ahora.',
    questionIndexes: [0, 1],
  },
  {
    id: 'balance',
    title: 'Cómo atravieso lo que siento',
    description: 'Tus formas de afrontar, descansar y recuperar equilibrio.',
    questionIndexes: [2, 3],
  },
  {
    id: 'relationships',
    title: 'Relaciones e historia personal',
    description: 'Lo que compartes, tus vínculos y experiencias importantes.',
    questionIndexes: [4, 5, 6],
  },
];

function AutoResizingTextInput({ value, onChangeText, placeholder, style }) {
  const [isFocused, setIsFocused] = useState(false);
  const [contentHeight, setContentHeight] = useState(44);
  const inputHeight = isFocused ? contentHeight : Math.min(contentHeight, 104);

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.subtle}
      multiline
      onContentSizeChange={event =>
        setContentHeight(event.nativeEvent.contentSize.height)
      }
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={[style, { height: Math.max(44, inputHeight) }]}
      textAlignVertical="top"
    />
  );
}

function SettingsRow({ icon, title, text, onPress, tone = 'default' }) {
  const color = tone === 'danger' ? colors.danger : colors.ink;

  return (
    <TouchableOpacity style={styles.settingsRow} onPress={onPress}>
      <View style={styles.settingsIcon}>
        <AppIcon name={icon} size={19} color={color} />
      </View>
      <View style={styles.settingsCopy}>
        <Text style={[styles.settingsTitle, tone === 'danger' && styles.dangerText]}>
          {title}
        </Text>
        {text ? <Text style={styles.settingsText}>{text}</Text> : null}
      </View>
      <AppIcon name="arrowRight" size={17} color={colors.subtle} />
    </TouchableOpacity>
  );
}

export default function Perfil({ navigation, user, signOut }) {
  const { respuestas, updateRespuestas } = useContext(GlobalContext);
  const [expandedGroup, setExpandedGroup] = useState('present');
  const completedQuestions = PROFILE_QUESTIONS.filter(
    item => respuestas[item.key]?.trim()
  ).length;

  const groups = useMemo(
    () => QUESTION_GROUPS.map(group => ({
      ...group,
      questions: group.questionIndexes.map(index => PROFILE_QUESTIONS[index]),
    })),
    []
  );

  const handleChange = (key, value) => {
    updateRespuestas({ ...respuestas, [key]: value });
  };

  const completeSignOut = async () => {
    try {
      await signOut?.();
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (error) {
      Alert.alert('No se pudo cerrar la sesión', 'Inténtalo de nuevo.');
    }
  };

  const handleSignOut = () => {
    if (!user?.isAnonymous) {
      completeSignOut();
      return;
    }

    Alert.alert(
      'Salir como invitado',
      'Esta sesión no se puede recuperar después. Puedes crear una cuenta para conservar tu recorrido.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Crear cuenta', onPress: () => navigation.navigate('Cuenta') },
        { text: 'Borrar y salir', style: 'destructive', onPress: completeSignOut },
      ]
    );
  };

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
        <Text style={styles.eyebrow}>TU ESPACIO</Text>
        <Text style={styles.title}>Contexto que solo tú decides compartir.</Text>
        <Text style={styles.introText}>
          Estas respuestas opcionales ayudan a evitar lecturas genéricas y dan
          prioridad a tu propia experiencia.
        </Text>

        <View style={styles.progressBlock}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Contexto completado</Text>
            <Text style={styles.progressCount}>
              {completedQuestions}/{PROFILE_QUESTIONS.length}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${(completedQuestions / PROFILE_QUESTIONS.length) * 100}%` },
              ]}
            />
          </View>
          <View style={styles.privacyRow}>
            <AppIcon name="shield" size={16} color={colors.success} />
            <Text style={styles.privacyText}>
              Se guarda cifrado en este dispositivo.
            </Text>
          </View>
        </View>

        <View style={styles.groupsSection}>
          <Text style={styles.sectionTitle}>Mi contexto personal</Text>
          {groups.map(group => {
            const expanded = expandedGroup === group.id;
            const completedInGroup = group.questions.filter(
              item => respuestas[item.key]?.trim()
            ).length;

            return (
              <View key={group.id} style={styles.group}>
                <TouchableOpacity
                  style={styles.groupHeader}
                  onPress={() => setExpandedGroup(expanded ? '' : group.id)}
                >
                  <View style={styles.groupCopy}>
                    <View style={styles.groupTitleRow}>
                      <Text style={styles.groupTitle}>{group.title}</Text>
                      <Text style={styles.groupCount}>
                        {completedInGroup}/{group.questions.length}
                      </Text>
                    </View>
                    <Text style={styles.groupDescription}>{group.description}</Text>
                  </View>
                  <AppIcon
                    name={expanded ? 'chevronUp' : 'chevronDown'}
                    size={19}
                    color={colors.muted}
                  />
                </TouchableOpacity>

                {expanded ? (
                  <View style={styles.groupContent}>
                    {group.questions.map(item => (
                      <View key={item.key} style={styles.questionBlock}>
                        <Text style={styles.question}>{item.pregunta}</Text>
                        <AutoResizingTextInput
                          placeholder="Tu respuesta (opcional)"
                          value={respuestas[item.key]}
                          onChangeText={text => handleChange(item.key, text)}
                          style={styles.input}
                        />
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        <View style={styles.accountSection}>
          <Text style={styles.sectionTitle}>Cuenta y control</Text>
          {user?.isAnonymous ? (
            <SettingsRow
              icon="profile"
              title="Crear una cuenta"
              text="Conserva el recorrido de esta sesión"
              onPress={() => navigation.navigate('Cuenta')}
            />
          ) : null}
          <SettingsRow
            icon="sparkles"
            title="Plan y Premium"
            text="Consulta tus lecturas disponibles"
            onPress={() => navigation.navigate('PlanPremium')}
          />
          <SettingsRow
            icon="shield"
            title="Privacidad y control"
            text="Consentimientos, recordatorios y datos"
            onPress={() => navigation.navigate('Configuracion')}
          />
          <SettingsRow
            icon="logout"
            title="Cerrar sesión"
            tone="danger"
            onPress={handleSignOut}
          />
        </View>

        <Text style={styles.footerNote}>
          Los cambios se guardan automáticamente y puedes modificarlos cuando quieras.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: { flex: 1 },
  screen: { backgroundColor: colors.background, flex: 1 },
  container: {
    paddingBottom: 44,
    paddingHorizontal: screenPadding,
    paddingTop: spacing.lg,
  },
  eyebrow: { ...typography.eyebrow, color: colors.primary },
  title: { ...typography.title, color: colors.ink, marginTop: spacing.sm },
  introText: { ...typography.body, color: colors.muted, marginTop: spacing.sm },
  progressBlock: {
    backgroundColor: colors.midnight,
    borderRadius: radii.lg,
    marginTop: spacing.xxl,
    padding: spacing.lg,
  },
  progressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressTitle: { color: colors.white, fontSize: 14, fontWeight: '800' },
  progressCount: { color: colors.lavender, fontSize: 13, fontWeight: '800' },
  progressTrack: {
    backgroundColor: '#303A4A',
    borderRadius: radii.pill,
    height: 7,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: colors.lavender,
    borderRadius: radii.pill,
    height: '100%',
  },
  privacyRow: { alignItems: 'center', flexDirection: 'row', marginTop: spacing.md },
  privacyText: { color: '#BCC4D2', fontSize: 11, marginLeft: 6 },
  groupsSection: { marginTop: spacing.xxxl },
  sectionTitle: { ...typography.sectionTitle, color: colors.ink },
  group: { borderBottomColor: colors.line, borderBottomWidth: 1 },
  groupHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 82,
    paddingVertical: spacing.md,
  },
  groupCopy: { flex: 1, marginRight: spacing.sm },
  groupTitleRow: { alignItems: 'center', flexDirection: 'row' },
  groupTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  groupCount: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.pill,
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    marginLeft: spacing.sm,
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  groupDescription: { color: colors.muted, fontSize: 12, marginTop: 4 },
  groupContent: { paddingBottom: spacing.md },
  questionBlock: { marginBottom: spacing.lg },
  question: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 21,
    padding: spacing.md,
  },
  accountSection: { marginTop: spacing.xxxl },
  settingsRow: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 70,
  },
  settingsIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderRadius: 10,
    height: 38,
    justifyContent: 'center',
    marginRight: spacing.md,
    width: 38,
  },
  settingsCopy: { flex: 1, marginRight: spacing.sm },
  settingsTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  settingsText: { color: colors.muted, fontSize: 11, marginTop: 3 },
  dangerText: { color: colors.danger },
  footerNote: {
    color: colors.subtle,
    fontSize: 11,
    lineHeight: 17,
    marginTop: spacing.xxl,
    textAlign: 'center',
  },
});
