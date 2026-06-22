import 'react-native-gesture-handler';
import React from 'react';
import { Alert, DeviceEventEmitter } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import {
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
} from '@expo/vector-icons';
import { GlobalProvider } from './GlobalContext';
import { useAuth } from './auth/useAuth';
import StackNavigator from './navigation/StackNavigator';
import NotificationModal from './components/NotificationModal';

export default function App() {
  const [iconsLoaded, iconsLoadError] = useFonts({
    ...Ionicons.font,
    ...FontAwesome5.font,
    ...MaterialCommunityIcons.font,
  });

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
  } = useAuth();

  const showInfo = () => {
    alert(
      'Entre más detallado se responda a estas preguntas, más precisas serán las interpretaciones de sueños'
    );
  };

  const confirmNewInterpretation = () => {
    Alert.alert(
      'Iniciar nueva interpretación',
      '¿Desea iniciar una nueva interpretación? Se borrará la conversación actual.',
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
    alert('Cada interpretación toma en cuenta las respuestas de tu perfil');
  };

  if (loading || (!iconsLoaded && !iconsLoadError)) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
        />

        <NotificationModal
          visible={modalVisible}
          message={notificationMessage}
          onClose={() => setModalVisible(false)}
        />
      </GlobalProvider>
    </GestureHandlerRootView>
  );
}
