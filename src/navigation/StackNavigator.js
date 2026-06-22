import React, { useState } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import { View, TouchableOpacity, DeviceEventEmitter } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Perfil from '../screens/Perfil';
import SuenosGuardados from '../screens/SuenosGuardados';
import Diario from '../screens/Diario';
import HomeScreen from '../components/HomeScreen';
import DiagramaEmocional from '../screens/DiagramaEmocional';
import Configuracion from '../screens/Configuracion';
import RestoreAnswersButton from '../components/RestoreAnswersButton';
import DropdownMenu from '../components/DropdownMenu';
import { navigationRef } from '../utils/navigationRef';

const Stack = createStackNavigator();

export default function StackNavigator({
  user,
  signInWithGoogle,
  signInWithEmail,
  registerWithEmail,
  resetPassword,
  sendPhoneVerificationCode,
  confirmPhoneVerificationCode,
  phoneVerificationId,
  signInAsGuest,
  signOut,
  showInfo,
  showInfoInterpretation,
  confirmNewInterpretation,
}) {
  const [menuVisible, setMenuVisible] = useState(false);

  const handleCloseMenu = () => setMenuVisible(false);

  return (
    <NavigationContainer ref={navigationRef}>
      <DropdownMenu
        isVisible={menuVisible}
        onClose={handleCloseMenu}
        signOut={signOut}
      />

      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 0,
          },
        }}
      >
        <Stack.Screen
          name="Home"
          options={{
            title: 'Oniria',
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => setMenuVisible(v => !v)}
                style={{ marginLeft: 10 }}
              >
                <Ionicons name="menu" size={24} color="black" />
              </TouchableOpacity>
            ),
            headerRight: () =>
              user && (
                <View style={{ flexDirection: 'row' }}>
                  <TouchableOpacity
                    onPress={confirmNewInterpretation}
                    style={{ marginRight: 10, padding: 8 }}
                  >
                    <Ionicons name="refresh" size={24} color="black" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={showInfoInterpretation}
                    style={{ marginRight: 10, padding: 8 }}
                  >
                    <Ionicons name="information-circle-outline" size={24} color="black" />
                  </TouchableOpacity>
                </View>
              ),
          }}
        >
          {props => (
            <HomeScreen
              {...props}
              user={user}
              signInWithGoogle={signInWithGoogle}
              signInWithEmail={signInWithEmail}
              registerWithEmail={registerWithEmail}
              resetPassword={resetPassword}
              sendPhoneVerificationCode={sendPhoneVerificationCode}
              confirmPhoneVerificationCode={confirmPhoneVerificationCode}
              phoneVerificationId={phoneVerificationId}
              signInAsGuest={signInAsGuest}
            />
          )}
        </Stack.Screen>

        <Stack.Screen
          name="Perfil"
          component={Perfil}
          options={{
            title: 'Perfil',
            headerRight: () => (
              <View style={{ flexDirection: 'row' }}>
                <RestoreAnswersButton />
                <TouchableOpacity onPress={showInfo} style={{ marginRight: 10, padding: 8 }}>
                  <Ionicons name="information-circle-outline" size={24} color="black" />
                </TouchableOpacity>
              </View>
            ),
          }}
        />

        <Stack.Screen
          name="SuenosGuardados"
          component={SuenosGuardados}
          options={({ route }) => {
            const selectionMode = route.params?.selectionMode;

            // Header para modo normal (no selección)
            const renderNormalHeader = () => (
              <View style={{ flexDirection: 'row' }}>
                {/* Botón de calendario */}
                <TouchableOpacity
                  onPress={() => DeviceEventEmitter.emit('toggleCalendarView')}
                  style={{ marginRight: 10, padding: 8 }}
                >
                  <Ionicons name="calendar-outline" size={24} color="black" />
                </TouchableOpacity>

                {/* Botón de borrar */}
                <TouchableOpacity
                  onPress={() => DeviceEventEmitter.emit('enableSelectionMode')}
                  style={{ marginRight: 10, padding: 8 }}
                >
                  <Ionicons name="trash" size={24} color="black" />
                </TouchableOpacity>
              </View>
            );

            // Header para modo selección
            const renderSelectionHeader = () => (
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity
                  onPress={() => DeviceEventEmitter.emit('cancelSelectionMode')}
                  style={{ marginRight: 10, padding: 8 }}
                >
                  <Ionicons name="close" size={24} color="black" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => DeviceEventEmitter.emit('confirmDeletion')}
                  style={{ marginRight: 10, padding: 8 }}
                >
                  <Ionicons name="checkmark" size={24} color="black" />
                </TouchableOpacity>
              </View>
            );

            return {
              title: 'Sueños Guardados',
              headerRight: () =>
                selectionMode ? renderSelectionHeader() : renderNormalHeader(),
            };
          }}
        />

        <Stack.Screen name="Diario" component={Diario} />
        <Stack.Screen
          name="DiagramaEmocional"
          component={DiagramaEmocional}
          options={{ title: 'Diagrama Emocional' }}
        />
        <Stack.Screen
          name="Configuracion"
          component={Configuracion}
          options={{ title: 'Configuración' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
