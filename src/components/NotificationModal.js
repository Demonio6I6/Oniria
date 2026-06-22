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

export default function NotificationModal({ visible, message, onClose }) {
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
            <Button title="Compartir" onPress={handleShare} />
            <Button title="Cerrar" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    maxHeight: '80%',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  scroll: {
    marginBottom: 20,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
});
