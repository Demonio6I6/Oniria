import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { GlobalProvider } from './GlobalContext';
import { useAuth } from './auth/useAuth';
import StackNavigator from './navigation/StackNavigator';
import NotificationModal from './components/NotificationModal';
import PremiumPaywallModal from './components/PremiumPaywallModal';
import { SubscriptionContext } from './subscriptions/SubscriptionContext';
import { useSubscriptionState } from './subscriptions/useSubscriptionState';
import { ThemeProvider, useAppTheme } from './theme/ThemeContext';
import { darkColors } from './theme/tokens';

SystemUI.setBackgroundColorAsync(darkColors.background).catch(() => {});

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

function AppContent() {
  const {
    user,
    loading,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    resetPassword,
    signInAsGuest,
    signOut,
    modalVisible,
    setModalVisible,
    notificationMessage,
    enableNotifications,
    deleteAccount,
  } = useAuth();
  const subscription = useSubscriptionState(user);
  const { colors, isDark, isReady } = useAppTheme();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(error => {
      console.error('No se pudo actualizar el fondo del sistema:', error);
    });
  }, [colors.background]);

  const showInfo = () => {
    alert(
      'Estas respuestas son opcionales. Ayudan a que Lunentra tenga en cuenta tu momento personal en lugar de usar significados genéricos.'
    );
  };

  const showInfoInterpretation = () => {
    alert(
      'Cada lectura es orientativa y puede tener en cuenta tu contexto personal. Tú decides qué parte te resulta útil.'
    );
  };

  if (loading || !isReady) {
    return (
      <View
        style={{
          backgroundColor: isReady ? colors.background : darkColors.background,
          flex: 1,
        }}
      />
    );
  }

  return (
    <GestureHandlerRootView
      style={{ backgroundColor: colors.background, flex: 1 }}
    >
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <StatusBar
          backgroundColor={colors.background}
          style={isDark ? 'light' : 'dark'}
        />
        <SubscriptionContext.Provider value={subscription}>
          <GlobalProvider userId={user?.uid}>
            <StackNavigator
              user={user}
              signInWithGoogle={signInWithGoogle}
              signInWithEmail={signInWithEmail}
              registerWithEmail={registerWithEmail}
              resetPassword={resetPassword}
              signInAsGuest={signInAsGuest}
              signOut={signOut}
              showInfo={showInfo}
              showInfoInterpretation={showInfoInterpretation}
              enableNotifications={enableNotifications}
              deleteAccount={deleteAccount}
            />

            <PremiumPaywallModal subscription={subscription} />

            <NotificationModal
              visible={modalVisible}
              message={notificationMessage}
              onClose={() => setModalVisible(false)}
            />
          </GlobalProvider>
        </SubscriptionContext.Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
