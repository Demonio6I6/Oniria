// src/components/RestoreAnswersButton.js
import React, { useContext } from 'react';
import { Alert, TouchableOpacity } from 'react-native';
import { GlobalContext } from '../GlobalContext';
import AppIcon from './AppIcon';

export default function RestoreAnswersButton() {
  const { clearRespuestas } = useContext(GlobalContext);

  const handlePress = () => {
    Alert.alert(
      'Borrar respuestas del contexto',
      '¿Quieres borrar todas las respuestas de tu contexto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Aceptar', onPress: () => clearRespuestas() }
      ]
    );
  };

  return (
    <TouchableOpacity
      accessibilityLabel="Borrar respuestas del contexto"
      accessibilityRole="button"
      onPress={handlePress}
      style={{ marginRight: 10, padding: 8 }}
    >
      <AppIcon name="eraser" size={22} color="black" />
    </TouchableOpacity>
  );
}
