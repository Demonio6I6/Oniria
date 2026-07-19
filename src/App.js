import 'react-native-gesture-handler';
import React from 'react';
import { Alert, DeviceEventEmitter } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { GlobalProvider } from './GlobalContext';
import { useAuth } from './auth/useAuth';
import StackNavigator from './navigation/StackNavigator';
import NotificationModal from './components/NotificationModal';
import PremiumPaywallModal from './components/PremiumPaywallModal';
import { SubscriptionContext } from './subscriptions/SubscriptionContext';
import { useSubscriptionState } from './subscriptions/useSubscriptionState';

export default function App() {
  const {
    user,
    loading,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    resetPassword,
    sendPhoneVerificationCode,
    confirmPhoneVerificationCode,
    phoneVerificationId,
    signInAsGuest,
    signOut,
    modalVisible,
    setModalVisible,
    notificationMessage,
    enableNotifications,
    deleteAccount,
  } = useAuth();
  const subscription = useSubscriptionState(user);

  const showInfo = () => {
    alert(
      'Estas respuestas son opcionales. Ayudan a que Lunentra tenga en cuenta tu momento personal en lugar de usar significados genéricos.'
    );
  };

  const confirmNewInterpretation = () => {
    Alert.alert(
      'Registrar otro sueño',
      '¿Quieres empezar un nuevo registro? Se cerrará la exploración actual.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceptar',
          onPress: () => DeviceEventEmitter.emit('newInterpretation'),
        },
      ],
      { cancelable: true }
    );
  };

  const showInfoInterpretation = () => {
    alert(
      'Cada lectura es orientativa y puede tener en cuenta tu contexto personal. Tú decides qué parte te resulta útil.'
    );
  };

  if (loading) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SubscriptionContext.Provider value={subscription}>
        <GlobalProvider userId={user?.uid}>
          <StackNavigator
            user={user}
            signInWithGoogle={signInWithGoogle}
            signInWithEmail={signInWithEmail}
            registerWithEmail={registerWithEmail}
            resetPassword={resetPassword}
            sendPhoneVerificationCode={sendPhoneVerificationCode}
            confirmPhoneVerificationCode={confirmPhoneVerificationCode}
            phoneVerificationId={phoneVerificationId}
            signInAsGuest={signInAsGuest}
            signOut={signOut}
            showInfo={showInfo}
            showInfoInterpretation={showInfoInterpretation}
            confirmNewInterpretation={confirmNewInterpretation}
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
    </GestureHandlerRootView>
  );
}
