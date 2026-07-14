import React, { useState } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import { View, TouchableOpacity, DeviceEventEmitter } from 'react-native';
import Perfil from '../screens/Perfil';
import SuenosGuardados from '../screens/SuenosGuardados';
import HomeScreen from '../components/HomeScreen';
import MainScreen from '../screens/MainScreen';
import DiagramaEmocional from '../screens/DiagramaEmocional';
import Configuracion from '../screens/Configuracion';
import PlanPremium from '../screens/PlanPremium';
import RestoreAnswersButton from '../components/RestoreAnswersButton';
import DropdownMenu from '../components/DropdownMenu';
import AppIcon from '../components/AppIcon';
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
  enableNotifications,
}) {
  const [menuVisible, setMenuVisible] = useState(false);

  const handleCloseMenu = () => setMenuVisible(false);

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer ref={navigationRef}>
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
            title: 'Lunentra',
            headerShown: Boolean(user),
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => setMenuVisible(v => !v)}
                accessibilityLabel="Abrir menu"
                accessibilityRole="button"
                hitSlop={8}
                style={{ marginLeft: 10, padding: 8 }}
              >
                <AppIcon name="menu" size={24} color="black" />
              </TouchableOpacity>
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
          name="NuevoSueno"
          component={MainScreen}
          options={{
            title: 'Explorar un sueño',
            headerRight: () => (
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity
                  onPress={confirmNewInterpretation}
                  accessibilityLabel="Reiniciar registro"
                  style={{ marginRight: 6, padding: 8 }}
                >
                  <AppIcon name="refresh" size={22} color="black" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={showInfoInterpretation}
                  accessibilityLabel="Información de la lectura"
                  style={{ marginRight: 10, padding: 8 }}
                >
                  <AppIcon name="info" size={22} color="black" />
                </TouchableOpacity>
              </View>
            ),
          }}
        />

        <Stack.Screen
          name="Perfil"
          component={Perfil}
          options={{
            title: 'Mi contexto',
            headerRight: () => (
              <View style={{ flexDirection: 'row' }}>
                <RestoreAnswersButton />
                <TouchableOpacity onPress={showInfo} style={{ marginRight: 10, padding: 8 }}>
                  <AppIcon name="info" size={24} color="black" />
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
                  <AppIcon name="calendar" size={24} color="black" />
                </TouchableOpacity>

                {/* Botón de borrar */}
                <TouchableOpacity
                  onPress={() => DeviceEventEmitter.emit('enableSelectionMode')}
                  style={{ marginRight: 10, padding: 8 }}
                >
                  <AppIcon name="trash" size={24} color="black" />
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
                  <AppIcon name="close" size={24} color="black" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => DeviceEventEmitter.emit('confirmDeletion')}
                  style={{ marginRight: 10, padding: 8 }}
                >
                  <AppIcon name="check" size={24} color="black" />
                </TouchableOpacity>
              </View>
            );

            return {
              title: 'Mi diario',
              headerRight: () =>
                selectionMode ? renderSelectionHeader() : renderNormalHeader(),
            };
          }}
        />

        <Stack.Screen
          name="DiagramaEmocional"
          component={DiagramaEmocional}
          options={{ title: 'Mis patrones' }}
        />
        <Stack.Screen
          name="Cuenta"
          options={{ title: 'Cuenta' }}
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
              forceAuthOptions
              allowGuest={false}
              panelTitle="Crea tu cuenta"
              panelSubtitle="Desbloquea tus lecturas gratuitas restantes y continúa donde estabas."
              heroTitle="Haz permanente tu espacio personal."
              heroText="Tus registros seguirán protegidos en este dispositivo y podrás profundizar en tus lecturas."
            />
          )}
        </Stack.Screen>
        <Stack.Screen
          name="PlanPremium"
          component={PlanPremium}
          options={{ title: 'Plan y Premium' }}
        />
        <Stack.Screen
          name="Configuracion"
          options={{ title: 'Privacidad y control' }}
        >
          {props => (
            <Configuracion
              {...props}
              enableNotifications={enableNotifications}
            />
          )}
        </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>

      <DropdownMenu
        isVisible={Boolean(user) && menuVisible}
        onClose={handleCloseMenu}
        signOut={signOut}
        user={user}
      />
    </View>
  );
}
