import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

import App from './src/App';
import { ensureAppCheckReady } from './src/firebase/appCheck';

if (Platform.OS === 'android' || Platform.OS === 'ios') {
  ensureAppCheckReady().catch(error => {
    console.error('No se pudo preparar Firebase App Check:', error);
  });
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
