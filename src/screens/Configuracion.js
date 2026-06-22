// src/screens/Configuracion.js
import React, { useContext } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { GlobalContext } from '../GlobalContext';
import { clearCurrentUserLocalData } from '../services/userStorage';

export default function Configuracion() {
  const { clearRespuestas } = useContext(GlobalContext);

  const handleClearLocalData = () => {
    Alert.alert(
      'Borrar datos locales',
      'Se eliminaran de este dispositivo tus suenos, perfil, emociones y preferencias de privacidad.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearCurrentUserLocalData();
              clearRespuestas();
              Alert.alert('Listo', 'Tus datos locales fueron borrados.');
            } catch (error) {
              console.error('Error borrando datos locales:', error);
              Alert.alert('Error', 'No se pudieron borrar los datos locales.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Privacidad</Text>

      <TouchableOpacity
        style={styles.dangerButton}
        onPress={handleClearLocalData}
      >
        <Text style={styles.dangerButtonText}>Borrar datos locales</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  dangerButton: {
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  dangerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
