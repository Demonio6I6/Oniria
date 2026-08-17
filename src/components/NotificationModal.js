// src/components/NotificationModal.js
import React from 'react';
import {
  Modal,
  View,
  Text,
  Button,
  StyleSheet,
  ScrollView,
  Share,
} from 'react-native';
import { radii, spacing } from '../theme/tokens';
import { useAppTheme, useThemeStyles } from '../theme/ThemeContext';

export default function NotificationModal({ visible, message, onClose }) {
  const { colors } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const handleShare = async () => {
    try {
      await Share.share({ message });
    } catch (error) {
      console.error('Error al compartir:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Reflexión del Día</Text>
          <ScrollView style={styles.scroll}>
            <Text style={styles.message}>{message}</Text>
          </ScrollView>
          <View style={styles.buttons}>
            <Button color={colors.primary} title="Compartir" onPress={handleShare} />
            <Button color={colors.primary} title="Cerrar" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = colors => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 12, 0.68)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  content: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.xl,
    maxHeight: '80%',
  },
  title: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  scroll: {
    marginBottom: 20,
  },
  message: {
    color: colors.muted,
    fontSize: 16,
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
});
