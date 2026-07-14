import { Platform } from 'react-native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { app } from '../firebase/config';
import { getInstallationId } from './installationId';

export const PREMIUM_ENTITLEMENT_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || 'premium';

const REGION = 'europe-west1';
const functions = getFunctions(app, REGION);
const syncSubscriptionCallable = httpsCallable(
  functions,
  'syncRevenueCatSubscription',
  { timeout: 60000 }
);
const getAccessStatusCallable = httpsCallable(
  functions,
  'getAccessStatus',
  { timeout: 30000 }
);

let configuredAppUserId = null;

const getPlatformApiKey = () => {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || '';
  }

  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || '';
  }

  return '';
};

export const hasRevenueCatConfiguration = () => Boolean(getPlatformApiKey());

export const hasPremiumEntitlement = (customerInfo) =>
  Boolean(customerInfo?.entitlements?.active?.[PREMIUM_ENTITLEMENT_ID]);

export const configureRevenueCatForUser = async (user) => {
  const apiKey = getPlatformApiKey();

  if (!apiKey || !user?.uid || user.isAnonymous) {
    return {
      configured: false,
      customerInfo: null,
      isPremium: false,
    };
  }

  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.WARN : LOG_LEVEL.ERROR);

  if (!configuredAppUserId) {
    Purchases.configure({
      apiKey,
      appUserID: user.uid,
    });
    configuredAppUserId = user.uid;
  } else if (configuredAppUserId !== user.uid) {
    await Purchases.logIn(user.uid);
    configuredAppUserId = user.uid;
  }

  await Purchases.setAttributes({
    firebase_uid: user.uid,
    account_type: user.isAnonymous ? 'guest' : 'registered',
  }).catch(error => {
    console.warn('No se pudieron actualizar atributos de RevenueCat:', error);
  });

  const customerInfo = await Purchases.getCustomerInfo();

  return {
    configured: true,
    customerInfo,
    isPremium: hasPremiumEntitlement(customerInfo),
  };
};

export const loadCurrentOffering = async () => {
  if (!hasRevenueCatConfiguration()) return null;

  const offerings = await Purchases.getOfferings();
  return offerings.current || null;
};

export const purchaseRevenueCatPackage = async (purchasePackage) => {
  const result = await Purchases.purchasePackage(purchasePackage);
  return result.customerInfo;
};

export const restoreRevenueCatPurchases = async () =>
  Purchases.restorePurchases();

export const syncRevenueCatSubscription = async () => {
  const result = await syncSubscriptionCallable({});
  return result.data;
};

export const loadAccessStatus = async () => {
  const installationId = await getInstallationId();
  const result = await getAccessStatusCallable({ installationId });
  return result.data;
};
