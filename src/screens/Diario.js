import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import {
  createPasswordRecord,
  verifyPasswordRecord,
} from '../utils/passwordSecurity';
import {
  loadDiaryData,
  saveDiaryContent,
  saveDiaryPasswordRecord,
} from '../services/diaryRepository';
import { getCurrentUser } from '../services/userStorage';

export default function Diario() {
  const currentUser = getCurrentUser();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [storedPassword, setStoredPassword] = useState(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [diaryText, setDiaryText] = useState('');

  useEffect(() => {
    const loadPasswordAndDiary = async () => {
      if (!currentUser) return;

      try {
        const { passwordRecord, diaryText: savedDiary } = await loadDiaryData();
        if (passwordRecord) {
          setStoredPassword(passwordRecord);
        }
        if (savedDiary) {
          setDiaryText(savedDiary);
        }
      } catch (error) {
        console.error('Error cargando datos del diario: ', error);
      }
    };

    loadPasswordAndDiary();
  }, [currentUser]);

  const handleSetPassword = async () => {
    if (newPassword !== newPasswordConfirm) {
      Alert.alert('Error', 'Las contraseñas no coinciden.');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    try {
      const passwordRecord = await createPasswordRecord(newPassword);
      await saveDiaryPasswordRecord(passwordRecord);
      setStoredPassword(passwordRecord);
      setIsAuthenticated(true);
      Alert.alert('Éxito', 'Contraseña establecida correctamente.');
    } catch (error) {
      console.error('Error al guardar la contraseña: ', error);
      Alert.alert('Error', 'No se pudo guardar la contraseña.');
    }
  };

  const handleLogin = async () => {
    try {
      const result = await verifyPasswordRecord(passwordInput, storedPassword);

      if (result.ok) {
        if (result.needsMigration) {
          const passwordRecord = await createPasswordRecord(passwordInput);
          await saveDiaryPasswordRecord(passwordRecord);
          setStoredPassword(passwordRecord);
        }

        setIsAuthenticated(true);
        return;
      }

      Alert.alert('Error', 'Contraseña incorrecta.');
    } catch (error) {
      console.error('Error al validar la contraseña: ', error);
      Alert.alert('Error', 'No se pudo validar la contraseña.');
    }
  };

  const handleSaveDiary = async () => {
    try {
      await saveDiaryContent(diaryText);
      Alert.alert('Éxito', 'Diario guardado.');
    } catch (error) {
      console.error('Error guardando el diario: ', error);
      Alert.alert('Error', 'No se pudo guardar el diario.');
    }
  };

  if (!currentUser) {
    return (
      <View style={styles.container}>
        <Text>Usuario no autenticado.</Text>
      </View>
    );
  }

  if (!storedPassword) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>
          Establece una contraseña para tu Diario Personal
        </Text>
        <TextInput
          secureTextEntry
          placeholder="Nueva contraseña"
          value={newPassword}
          onChangeText={setNewPassword}
          style={styles.input}
        />
        <TextInput
          secureTextEntry
          placeholder="Confirmar contraseña"
          value={newPasswordConfirm}
          onChangeText={setNewPasswordConfirm}
          style={styles.input}
        />
        <Button title="Establecer contraseña" onPress={handleSetPassword} />
      </ScrollView>
    );
  }

  if (!isAuthenticated) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>
          Ingresa tu contraseña para acceder al Diario Personal
        </Text>
        <TextInput
          secureTextEntry
          placeholder="Contraseña"
          value={passwordInput}
          onChangeText={setPasswordInput}
          style={styles.input}
        />
        <Button title="Ingresar" onPress={handleLogin} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Diario Personal</Text>
      <TextInput
        multiline
        placeholder="Escribe tus pensamientos aquí..."
        value={diaryText}
        onChangeText={setDiaryText}
        style={[styles.input, styles.diaryInput]}
      />
      <Button title="Guardar diario" onPress={handleSaveDiary} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    borderColor: 'gray',
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
  },
  diaryInput: {
    height: 200,
    textAlignVertical: 'top',
  },
});
