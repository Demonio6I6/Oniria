import React, { useMemo, useState } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { View, TouchableOpacity, DeviceEventEmitter } from 'react-native';
import Perfil from '../screens/Perfil';
import SuenosGuardados from '../screens/SuenosGuardados';
import DreamDetail from '../screens/DreamDetail';
import HomeScreen from '../components/HomeScreen';
import MainScreen from '../screens/MainScreen';
import DiagramaEmocional from '../screens/DiagramaEmocional';
import Configuracion from '../screens/Configuracion';
import PlanPremium from '../screens/PlanPremium';
import RestoreAnswersButton from '../components/RestoreAnswersButton';
import AppIcon from '../components/AppIcon';
import BottomNavigation from '../components/BottomNavigation';
import { navigationRef } from '../utils/navigationRef';
import { useAppTheme } from '../theme/ThemeContext';

const Stack = createStackNavigator();
const ROOT_TAB_ROUTES = new Set([
  'Home',
  'SuenosGuardados',
  'DiagramaEmocional',
  'Perfil',
]);

export default function StackNavigator({
  user,
  signInWithGoogle,
  signInWithEmail,
  registerWithEmail,
  resetPassword,
  signInAsGuest,
  signOut,
  showInfo,
  showInfoInterpretation,
  enableNotifications,
  deleteAccount,
}) {
  const [currentRoute, setCurrentRoute] = useState('Home');
  const { colors, isDark } = useAppTheme();
  const navigationTheme = useMemo(() => {
    const baseTheme = isDark ? DarkTheme : DefaultTheme;

    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        background: colors.background,
        border: colors.line,
        card: colors.background,
        notification: colors.danger,
        primary: colors.primary,
        text: colors.ink,
      },
    };
  }, [colors, isDark]);

  const updateCurrentRoute = () => {
    const routeName = navigationRef.getCurrentRoute()?.name;
    if (routeName) setCurrentRoute(routeName);
  };

  const handleRootNavigation = routeName => {
    if (!navigationRef.isReady()) return;
    navigationRef.navigate(routeName);
  };

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer
        ref={navigationRef}
        theme={navigationTheme}
        onReady={updateCurrentRoute}
        onStateChange={updateCurrentRoute}
      >
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerStyle: {
              backgroundColor: colors.background,
              elevation: 0,
              shadowOpacity: 0,
              borderBottomWidth: 0,
            },
            headerTintColor: colors.ink,
            headerTitleStyle: {
              fontSize: 17,
              fontWeight: '800',
            },
            cardStyle: { backgroundColor: colors.background },
          }}
        >
        <Stack.Screen
          name="Home"
          options={{
            title: 'Lunentra',
            headerShown: false,
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
                  onPress={showInfoInterpretation}
                  accessibilityLabel="Información de la lectura"
                  style={{ marginRight: 10, padding: 8 }}
                >
                  <AppIcon name="info" size={22} color={colors.ink} />
                </TouchableOpacity>
              </View>
            ),
          }}
        />

        <Stack.Screen
          name="Perfil"
          options={{
            title: 'Tu espacio',
            headerRight: () => (
              <View style={{ flexDirection: 'row' }}>
                <RestoreAnswersButton />
                <TouchableOpacity onPress={showInfo} style={{ marginRight: 10, padding: 8 }}>
                  <AppIcon name="info" size={24} color={colors.ink} />
                </TouchableOpacity>
              </View>
            ),
          }}
        >
          {props => (
            <Perfil
              {...props}
              user={user}
              signOut={signOut}
            />
          )}
        </Stack.Screen>

        <Stack.Screen
          name="SuenosGuardados"
          component={SuenosGuardados}
          options={({ route }) => {
            const selectionMode = route.params?.selectionMode;
            const hasDreams = route.params?.hasDreams;

            const renderNormalHeader = () => hasDreams ? (
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity
                  onPress={() => DeviceEventEmitter.emit('enableSelectionMode')}
                  accessibilityLabel="Seleccionar sueños para borrar"
                  style={{ marginRight: 10, padding: 8 }}
                >
                  <AppIcon name="trash" size={22} color={colors.muted} />
                </TouchableOpacity>
              </View>
            ) : null;

            // Header para modo selección
            const renderSelectionHeader = () => (
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity
                  onPress={() => DeviceEventEmitter.emit('cancelSelectionMode')}
                  accessibilityLabel="Cancelar selección"
                  style={{ marginRight: 10, padding: 8 }}
                >
                  <AppIcon name="close" size={22} color={colors.muted} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => DeviceEventEmitter.emit('confirmDeletion')}
                  accessibilityLabel="Borrar sueños seleccionados"
                  style={{ marginRight: 10, padding: 8 }}
                >
                  <AppIcon name="check" size={22} color={colors.danger} />
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
          name="DetalleSueno"
          component={DreamDetail}
          options={{ title: 'Tu sueño' }}
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
          options={{ title: 'Configuración' }}
        >
          {props => (
            <Configuracion
              {...props}
              user={user}
              enableNotifications={enableNotifications}
              deleteAccount={deleteAccount}
            />
          )}
        </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>

      {Boolean(user) && ROOT_TAB_ROUTES.has(currentRoute) ? (
        <BottomNavigation
          activeRoute={currentRoute}
          onNavigate={handleRootNavigation}
        />
      ) : null}
    </View>
  );
}
