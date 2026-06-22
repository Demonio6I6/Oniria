// src/components/RestoreAnswersButton.js
import React, { useContext } from 'react';
import { Alert, TouchableOpacity } from 'react-native';
import { GlobalContext } from '../GlobalContext';
import AppIcon from './AppIcon';

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
      <AppIcon name="refresh" size={24} color="black" />
    </TouchableOpacity>
  );
}
