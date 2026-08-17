import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AppIcon from './AppIcon';
import { navigationRef } from '../utils/navigationRef';
import { trackProductEvent } from '../services/productAnalytics';
import { openSubscriptionManagement } from '../services/subscriptionManagement';
import { radii } from '../theme/tokens';
import { useAppTheme, useThemeStyles } from '../theme/ThemeContext';

const ACCOUNT_REASONS = new Set([
  'account-required',
  'guest-demo-used',
  'guest-follow-up',
  'monthly-analysis-account',
]);

const getPackageTitle = (purchasePackage) =>
  purchasePackage?.product?.title ||
  purchasePackage?.identifier ||
  'Lunentra Premium';

const getPackagePrice = (purchasePackage) =>
  purchasePackage?.product?.priceString || '';

const getPackagePeriod = (purchasePackage) => {
  const identifier = purchasePackage?.identifier || '';
  if (identifier.includes('annual')) return '/ año';
  if (identifier.includes('monthly')) return '/ mes';
  return '';
};

const getAccountCopy = (reason, remainingAfterAccount) => {
  if (reason === 'guest-follow-up') {
    return {
      title: 'Profundiza en este sueño',
      body: 'Crea una cuenta gratuita para hacer tu ampliación ahora y volver al mismo sueño al terminar.',
      action: 'Crear cuenta y continuar',
    };
  }

  if (reason === 'guest-demo-used') {
    return {
      title: 'Sigue explorando tus sueños',
      body: `Ya completaste la demo. Tu cuenta gratuita desbloquea ${remainingAfterAccount} lecturas de bienvenida más en este dispositivo.`,
      action: 'Crear cuenta gratuita',
    };
  }

  if (reason === 'monthly-analysis-account') {
    return {
      title: 'Activa tu espacio personal',
      body: 'Crea una cuenta gratuita para continuar. Después podrás revisar la opción Premium para generar tu lectura profunda.',
      action: 'Crear cuenta y continuar',
    };
  }

  return {
    title: 'Continúa con una cuenta gratuita',
    body: 'Desbloquea tus lecturas restantes y mantén esta sesión disponible en este dispositivo.',
    action: 'Crear cuenta',
  };
};

const getPremiumCopy = (reason, monthlyLimit) => {
  if (reason === 'monthly-analysis') {
    return {
      title: 'Descubre los patrones de tu historia',
      body: 'Premium conecta cambios, repeticiones y preguntas abiertas usando tus sueños recientes.',
    };
  }

  if (reason === 'free-interpretation-limit') {
    return {
      title: 'Sigue interpretando nuevos sueños',
      body: `Ya aprovechaste tus lecturas de bienvenida. Premium incluye hasta ${monthlyLimit} nuevas lecturas cada mes.`,
    };
  }

  return {
    title: 'Profundiza en tus patrones',
    body: `Premium incluye hasta ${monthlyLimit} lecturas al mes y una lectura profunda de tus patrones recientes.`,
  };
};

export default function PremiumPaywallModal({ subscription }) {
  const { colors } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const [selectedPackageId, setSelectedPackageId] = useState('');

  const packages = subscription.packages || [];
  const selectedPackage = useMemo(() => {
    if (!packages.length) return null;

    return packages.find(item => item.identifier === selectedPackageId) ||
      packages[0];
  }, [packages, selectedPackageId]);

  const needsAccount =
    subscription.isGuest || ACCOUNT_REASONS.has(subscription.paywallReason);
  const isBusy = subscription.loading;
  const totalUsed = subscription.accessStatus?.interpretations?.totalUsed || 0;
  const freeLimit = subscription.accessStatus?.limits?.freeInterpretations || 3;
  const monthlyLimit =
    subscription.accessStatus?.limits?.premiumMonthlyInterpretations || 15;
  const accountCopy = getAccountCopy(
    subscription.paywallReason,
    Math.max(freeLimit - totalUsed, 0)
  );
  const premiumCopy = getPremiumCopy(
    subscription.paywallReason,
    monthlyLimit
  );

  const closeAndOpenAccount = () => {
    trackProductEvent('account_cta_clicked', {
      reason: subscription.paywallReason,
    });
    const returnReason = subscription.paywallReason;
    subscription.hidePaywall();
    navigationRef.navigate('Cuenta', { returnReason });
  };

  const handlePurchase = () => {
    if (!selectedPackage || isBusy) return;
    subscription.purchasePackage(selectedPackage);
  };

  return (
    <Modal
      animationType="fade"
      transparent
      visible={subscription.paywallVisible}
      onRequestClose={subscription.hidePaywall}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <View style={styles.headerIcon}>
              <AppIcon
                name={needsAccount ? 'profile' : 'sparkles'}
                size={22}
                color={colors.ink}
              />
            </View>
            <Pressable
              accessibilityLabel="Cerrar"
              accessibilityRole="button"
              hitSlop={8}
              onPress={subscription.hidePaywall}
              style={styles.closeButton}
            >
              <AppIcon name="close" size={20} color={colors.ink} />
            </Pressable>
          </View>

          {needsAccount ? (
            <>
              <Text style={styles.title}>{accountCopy.title}</Text>
              <Text style={styles.body}>{accountCopy.body}</Text>
              <Pressable
                style={styles.primaryButton}
                onPress={closeAndOpenAccount}
              >
                <Text style={styles.primaryButtonText}>{accountCopy.action}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.title}>{premiumCopy.title}</Text>
              <Text style={styles.body}>{premiumCopy.body}</Text>

              <View style={styles.benefitList}>
                <Text style={styles.benefitText}>• Diario manual ilimitado</Text>
                <Text style={styles.benefitText}>• Hasta {monthlyLimit} lecturas de IA al mes</Text>
                <Text style={styles.benefitText}>• Una ampliación por cada lectura</Text>
                <Text style={styles.benefitText}>• Lectura profunda desde 6 sueños</Text>
              </View>

              {packages.length ? (
                <View style={styles.packageList}>
                  {packages.map(item => {
                    const isSelected =
                      selectedPackage?.identifier === item.identifier;

                    return (
                      <Pressable
                        key={item.identifier}
                        style={[
                          styles.packageButton,
                          isSelected && styles.packageButtonSelected,
                        ]}
                        onPress={() => setSelectedPackageId(item.identifier)}
                      >
                        <View style={styles.packageCopy}>
                          <Text style={styles.packageTitle}>
                            {getPackageTitle(item)}
                          </Text>
                          {!!item.product?.description && (
                            <Text style={styles.packageDescription}>
                              {item.product.description}
                            </Text>
                          )}
                        </View>
                        <Text style={styles.packagePrice}>
                          {getPackagePrice(item)} {getPackagePeriod(item)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>
                    La oferta Premium todavía no está disponible en este dispositivo.
                  </Text>
                </View>
              )}

              <Pressable
                style={[
                  styles.primaryButton,
                  (!selectedPackage || isBusy) && styles.disabledButton,
                ]}
                disabled={!selectedPackage || isBusy}
                onPress={handlePurchase}
              >
                {isBusy ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Suscribirme</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.secondaryButton}
                disabled={isBusy}
                onPress={subscription.restorePurchases}
              >
                <Text style={styles.secondaryButtonText}>Restaurar compra</Text>
              </Pressable>

              {!!subscription.error && (
                <Text style={styles.errorText}>
                  {subscription.error?.message ||
                    'No se pudo completar la operación. Inténtalo de nuevo.'}
                </Text>
              )}
              <Text style={styles.billingNote}>
                La suscripción se renueva automáticamente con el periodo indicado
                hasta que la canceles. El cobro se gestiona desde tu tienda.
              </Text>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => openSubscriptionManagement().catch(() => null)}
              >
                <Text style={styles.secondaryButtonText}>
                  Gestionar o cancelar suscripción
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = colors => StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(2, 6, 12, 0.68)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 26,
    width: '100%',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  closeButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '800',
  },
  body: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  packageList: {
    gap: 10,
    marginTop: 18,
  },
  benefitList: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    gap: 6,
    marginTop: 16,
    padding: 14,
  },
  benefitText: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  packageButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  packageButtonSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  packageCopy: {
    flex: 1,
    paddingRight: 12,
  },
  packageTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  packageDescription: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  packagePrice: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  emptyBox: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 18,
    padding: 14,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.midnight,
    borderRadius: radii.md,
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: 6,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
    textAlign: 'center',
  },
  billingNote: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.48,
  },
});
