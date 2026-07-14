import { createContext, useContext } from 'react';

export const SubscriptionContext = createContext({
  accessStatus: null,
  configured: false,
  isGuest: false,
  isPremium: false,
  loading: false,
  packages: [],
  paywallReason: '',
  paywallVisible: false,
  serverSynced: false,
  purchasePackage: async () => null,
  refresh: async () => null,
  restorePurchases: async () => null,
  showPaywall: () => null,
  hidePaywall: () => null,
});

export const useSubscriptionAccess = () => useContext(SubscriptionContext);
