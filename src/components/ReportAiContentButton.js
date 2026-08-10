import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { reportAiContent } from '../services/aiContentReport';
import { colors, radii, spacing } from '../theme/tokens';
import AppIcon from './AppIcon';

const REPORT_REASONS = {
  HARMFUL: 'harmful-or-offensive',
  INAPPROPRIATE: 'misleading-or-inappropriate',
};

export default function ReportAiContentButton({ content, feature }) {
  const [status, setStatus] = useState('idle');

  const submitReport = async (reason) => {
    if (status === 'sending' || !String(content || '').trim()) return;

    setStatus('sending');
    try {
      await reportAiContent({ content, feature, reason });
      setStatus('reported');
      Alert.alert(
        'Reporte enviado',
        'Gracias. Revisaremos esta respuesta para mejorar la seguridad de Lunentra.'
      );
    } catch (error) {
      console.error('Error reportando contenido de IA:', error);
      setStatus('idle');
      Alert.alert(
        'No se pudo enviar',
        'Inténtalo de nuevo más tarde.'
      );
    }
  };

  const openReportOptions = () => {
    if (status !== 'idle') return;

    Alert.alert(
      'Denunciar respuesta de IA',
      'Se enviará esta respuesta a Lunentra para revisarla. Elige el motivo:',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Ofensiva o dañina',
          onPress: () => submitReport(REPORT_REASONS.HARMFUL),
        },
        {
          text: 'Engañosa o inapropiada',
          onPress: () => submitReport(REPORT_REASONS.INAPPROPRIATE),
        },
      ]
    );
  };

  return (
    <TouchableOpacity
      accessibilityLabel={
        status === 'reported'
          ? 'Respuesta de inteligencia artificial denunciada'
          : 'Denunciar respuesta de inteligencia artificial'
      }
      accessibilityRole="button"
      disabled={status !== 'idle'}
      onPress={openReportOptions}
      style={[styles.button, status !== 'idle' && styles.buttonDisabled]}
    >
      {status === 'sending' ? (
        <ActivityIndicator color={colors.muted} size="small" />
      ) : (
        <View style={styles.content}>
          <AppIcon
            color={status === 'reported' ? colors.success : colors.muted}
            name={status === 'reported' ? 'checkCircle' : 'alertCircle'}
            size={15}
          />
          <Text
            style={[
              styles.label,
              status === 'reported' && styles.labelReported,
            ]}
          >
            {status === 'reported' ? 'Respuesta denunciada' : 'Denunciar respuesta'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginTop: spacing.sm,
    minHeight: 34,
    minWidth: 150,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  buttonDisabled: { opacity: 0.78 },
  content: { alignItems: 'center', flexDirection: 'row' },
  label: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 6,
  },
  labelReported: { color: colors.success },
});
