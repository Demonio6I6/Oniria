// src/components/RestoreAnswersButton.js
import React, { useContext } from 'react';
import { Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlobalContext } from '../GlobalContext';

export default function RestoreAnswersButton() {
  const { clearRespuestas } = useContext(GlobalContext);

  const handlePress = () => {
    Alert.alert(
      'Restaurar respuestas',
      '¿Desea restaurar todas las respuestas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Aceptar', onPress: () => clearRespuestas() }
      ]
    );
  };

  return (
    <TouchableOpacity onPress={handlePress} style={{ marginRight: 10, padding: 8 }}>
      <Ionicons name="refresh" size={24} color="black" />
    </TouchableOpacity>
  );
}
