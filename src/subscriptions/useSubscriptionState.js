import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import {
  configureRevenueCatForUser,
  hasPremiumEntitlement,
  loadAccessStatus,
  loadCurrentOffering,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
  syncRevenueCatSubscription,
} from '../services/subscriptionService';
import { trackProductEvent } from '../services/productAnalytics';

const initialState = {
  accessStatus: null,
  configured: false,
  customerInfo: null,
  error: null,
  isPremium: false,
  loading: false,
  offering: null,
  packages: [],
  serverSynced: false,
};

export const useSubscriptionState = (user) => {
  const [state, setState] = useState(initialState);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallReason, setPaywallReason] = useState('');

  const isGuest = Boolean(user?.isAnonymous);

  const refresh = useCallback(async ({ syncServer = false } = {}) => {
    if (!user?.uid) {
      setState(initialState);
      return initialState;
    }

    setState(currentState => ({
      ...currentState,
      error: null,
      loading: true,
    }));

    try {
      const revenueCatState = user.isAnonymous
        ? { configured: false, customerInfo: null, isPremium: false }
        : await configureRevenueCatForUser(user);
      const offering = revenueCatState.configured
        ? await loadCurrentOffering().catch(error => {
          console.warn('No se pudo cargar la oferta de RevenueCat:', error);
          return null;
        })
        : null;
      const shouldSync = Boolean(
        !user.isAnonymous &&
        revenueCatState.configured &&
        (syncServer || revenueCatState.isPremium)
      );
      let serverSynced = !shouldSync;
      let syncError = null;

      if (shouldSync) {
        try {
          await syncRevenueCatSubscription();
          serverSynced = true;
        } catch (error) {
          syncError = error;
          console.warn('No se pudo sincronizar Premium con el servidor:', error);
        }
      }

      const accessStatus = await loadAccessStatus();
      const nextState = {
        accessStatus,
        configured: revenueCatState.configured,
        customerInfo: revenueCatState.customerInfo,
        error: syncError,
        isPremium: Boolean(
          accessStatus?.isPremium || revenueCatState.isPremium
        ),
        loading: false,
        offering,
        packages: offering?.availablePackages || [],
        serverSynced,
      };

      setState(nextState);
      return nextState;
    } catch (error) {
      console.error('Error preparando suscripcion:', error);

      const nextState = {
        ...initialState,
        error,
        loading: false,
      };

      setState(nextState);
      return nextState;
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener(
      'change',
      nextState => {
        if (nextState === 'active') refresh();
      }
    );

    return () => appStateSubscription.remove();
  }, [refresh]);

  const showPaywall = useCallback((reason = 'premium-required') => {
    setPaywallReason(reason);
    setPaywallVisible(true);
    trackProductEvent('paywall_shown', { reason });
  }, []);

  const hidePaywall = useCallback((trackDismissal = true) => {
    if (trackDismissal && paywallReason) {
      trackProductEvent('paywall_dismissed', { reason: paywallReason });
    }
    setPaywallVisible(false);
    setPaywallReason('');
  }, [paywallReason]);

  const purchasePackage = useCallback(async (purchasePackageToBuy) => {
    if (!purchasePackageToBuy) return null;

    setState(currentState => ({
      ...currentState,
      error: null,
      loading: true,
    }));
    trackProductEvent('purchase_started', {
      packageId: purchasePackageToBuy.identifier || '',
      reason: paywallReason,
    });

    try {
      const customerInfo = await purchaseRevenueCatPackage(purchasePackageToBuy);
      const nextState = await refresh({ syncServer: true });
      const entitlementActive = hasPremiumEntitlement(customerInfo) ||
        nextState.isPremium;

      if (entitlementActive && nextState.serverSynced) {
        trackProductEvent('purchase_succeeded', {
          packageId: purchasePackageToBuy.identifier || '',
          reason: paywallReason,
        });
        hidePaywall(false);
      } else if (entitlementActive) {
        const activationError = new Error(
          'Compra recibida. No se pudo terminar de activar Premium en el servidor.'
        );
        setState(currentState => ({
          ...currentState,
          error: activationError,
          loading: false,
        }));
      }

      return customerInfo;
    } catch (error) {
      if (error?.userCancelled) {
        setState(currentState => ({
          ...currentState,
          error: null,
          loading: false,
        }));
        return null;
      }

      console.error('Error comprando Premium:', error);
      trackProductEvent('purchase_failed', {
        code: error?.code || 'unknown',
        reason: paywallReason,
      });

      setState(currentState => ({
        ...currentState,
        error,
        loading: false,
      }));
      return null;
    }
  }, [hidePaywall, paywallReason, refresh]);

  const restorePurchases = useCallback(async () => {
    setState(currentState => ({
      ...currentState,
      error: null,
      loading: true,
    }));
    trackProductEvent('restore_started', { reason: paywallReason });

    try {
      const customerInfo = await restoreRevenueCatPurchases();
      const nextState = await refresh({ syncServer: true });
      const entitlementActive = hasPremiumEntitlement(customerInfo) ||
        nextState.isPremium;

      if (entitlementActive && nextState.serverSynced) {
        trackProductEvent('restore_succeeded', { reason: paywallReason });
        hidePaywall(false);
      } else if (!entitlementActive) {
        setState(currentState => ({
          ...currentState,
          error: new Error('No encontramos una compra Premium activa.'),
          loading: false,
        }));
      }

      return customerInfo;
    } catch (error) {
      console.error('Error restaurando compras:', error);
      trackProductEvent('restore_failed', {
        code: error?.code || 'unknown',
        reason: paywallReason,
      });
      setState(currentState => ({
        ...currentState,
        error,
        loading: false,
      }));
      return null;
    }
  }, [hidePaywall, paywallReason, refresh]);

  return useMemo(() => ({
    ...state,
    isGuest,
    paywallReason,
    paywallVisible,
    purchasePackage,
    refresh,
    restorePurchases,
    showPaywall,
    hidePaywall,
  }), [
    hidePaywall,
    isGuest,
    paywallReason,
    paywallVisible,
    purchasePackage,
    refresh,
    restorePurchases,
    showPaywall,
    state,
  ]);
};
