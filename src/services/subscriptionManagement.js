import { Linking, Platform } from 'react-native';

const ANDROID_SUBSCRIPTIONS_URL =
  'https://play.google.com/store/account/subscriptions?package=com.nicarao.lunentra';
const IOS_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

export const openSubscriptionManagement = async () => {
  const url = Platform.OS === 'ios'
    ? IOS_SUBSCRIPTIONS_URL
    : ANDROID_SUBSCRIPTIONS_URL;
  const supported = await Linking.canOpenURL(url);

  if (!supported) {
    throw new Error('La tienda no está disponible en este dispositivo.');
  }

  await Linking.openURL(url);
};
