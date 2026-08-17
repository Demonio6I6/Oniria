import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AppIcon from '../components/AppIcon';
import { useSubscriptionAccess } from '../subscriptions/SubscriptionContext';
import { openSubscriptionManagement } from '../services/subscriptionManagement';
import { radii, screenPadding, spacing, typography } from '../theme/tokens';
import { useAppTheme, useThemeStyles } from '../theme/ThemeContext';

const formatAvailability = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
  });
};

function Benefit({ children }) {
  const { colors } = useAppTheme();
  const styles = useThemeStyles(createStyles);

  return (
    <View style={styles.benefitRow}>
      <View style={styles.benefitIcon}>
        <AppIcon name="check" size={15} color={colors.primary} />
      </View>
      <Text style={styles.benefitText}>{children}</Text>
    </View>
  );
}

export default function PlanPremium({ navigation }) {
  const subscription = useSubscriptionAccess();
  const { colors } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const status = subscription.accessStatus;
  const usage = status?.interpretations;
  const limits = status?.limits;
  const monthlyLimit = limits?.premiumMonthlyInterpretations || 15;
  const freeLimit = limits?.freeInterpretations || 3;

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      subscription.refresh();
    });
    return unsubscribe;
  }, [navigation, subscription]);

  const planLabel = subscription.isGuest
    ? 'Sesión invitada'
    : subscription.isPremium
      ? 'Lunentra Premium'
      : 'Cuenta gratuita';
  const remaining = usage?.remaining ?? (subscription.isGuest ? 1 : freeLimit);
  const resetLabel = formatAvailability(usage?.resetsAtMillis);

  const handlePrimaryAction = () => {
    if (subscription.isGuest) {
      subscription.showPaywall('account-required');
      return;
    }
    subscription.showPaywall('plan-center');
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>TU PLAN</Text>
      <Text style={styles.title}>Lecturas claras, límites transparentes</Text>
      <Text style={styles.subtitle}>
        Guardar sueños manualmente no consume IA. Aquí puedes ver qué incluye
        tu plan y cuántas lecturas tienes disponibles.
      </Text>

      <View style={styles.planCard}>
        <View style={styles.planHeader}>
          <View>
            <Text style={styles.planLabel}>PLAN ACTUAL</Text>
            <Text style={styles.planName}>{planLabel}</Text>
          </View>
          {subscription.loading ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>
                {subscription.isPremium ? 'ACTIVO' : 'GRATIS'}
              </Text>
            </View>
          )}
        </View>

        {subscription.isPremium ? (
          <>
            <Text style={styles.usageValue}>
              {remaining} de {monthlyLimit}
            </Text>
            <Text style={styles.usageLabel}>lecturas disponibles este mes</Text>
            <Text style={styles.usageHint}>
              {resetLabel
                ? `Tus ${monthlyLimit} lecturas se renuevan el ${resetLabel}`
                : 'Tus lecturas se renuevan al comenzar el próximo mes'}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.usageValue}>{remaining}</Text>
            <Text style={styles.usageLabel}>
              {subscription.isGuest
                ? 'lectura demo disponible'
                : `de ${freeLimit} lecturas de bienvenida disponibles`}
            </Text>
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Lo que incluye Premium</Text>
        <Benefit>Hasta {monthlyLimit} lecturas de IA cada mes</Benefit>
        <Benefit>Una ampliación para profundizar en cada lectura</Benefit>
        <Benefit>Lectura profunda de patrones desde 6 sueños</Benefit>
        <Benefit>Diario manual ilimitado sin consumir lecturas</Benefit>
      </View>

      {!subscription.isPremium && (
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handlePrimaryAction}
        >
          <Text style={styles.primaryButtonText}>
            {subscription.isGuest ? 'Crear cuenta gratuita' : 'Ver Premium'}
          </Text>
          <AppIcon name="arrowRight" size={18} color={colors.white} />
        </TouchableOpacity>
      )}

      {!subscription.isGuest && (
        <TouchableOpacity
          style={styles.secondaryButton}
          disabled={subscription.loading || !subscription.configured}
          onPress={subscription.restorePurchases}
        >
          <Text style={styles.secondaryButtonText}>Restaurar compra</Text>
        </TouchableOpacity>
      )}

      {!subscription.isGuest && (
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => openSubscriptionManagement().catch(() => null)}
        >
          <Text style={styles.secondaryButtonText}>
            Gestionar o cancelar suscripción
          </Text>
        </TouchableOpacity>
      )}

      {!subscription.configured && !subscription.isGuest && (
        <Text style={styles.warningText}>
          Las compras todavía no están disponibles en esta instalación.
        </Text>
      )}
      {!!subscription.error && (
        <Text style={styles.errorText}>
          {subscription.error?.message || 'No se pudo actualizar tu plan.'}
        </Text>
      )}

      <View style={styles.privacyNote}>
        <AppIcon name="shield" size={18} color={colors.muted} />
        <Text style={styles.privacyText}>
          Tu diario sigue cifrado en este dispositivo. Crear una cuenta no crea
          automáticamente una copia en la nube.
        </Text>
      </View>
    </ScrollView>
  );
}

const createStyles = colors => StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: 42,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.primary,
  },
  title: {
    ...typography.title,
    color: colors.ink,
    marginTop: 8,
  },
  subtitle: {
    ...typography.body,
    color: colors.muted,
    marginTop: 10,
  },
  planCard: {
    backgroundColor: colors.midnight,
    borderRadius: radii.lg,
    marginTop: 24,
    padding: 20,
  },
  planHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  planLabel: {
    color: '#AEB7C5',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  planName: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  statusPill: {
    backgroundColor: '#303A4A',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillText: {
    color: colors.lavender,
    fontSize: 11,
    fontWeight: '800',
  },
  usageValue: {
    color: colors.white,
    fontSize: 34,
    fontWeight: '800',
    marginTop: 22,
  },
  usageLabel: {
    color: '#C7CEDB',
    fontSize: 14,
    marginTop: 1,
  },
  usageHint: {
    color: '#AEB7C5',
    fontSize: 12,
    marginTop: 8,
  },
  retryText: {
    color: '#B45309',
    fontSize: 12,
    marginTop: 10,
  },
  section: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    gap: 12,
    marginTop: 16,
    padding: 20,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 2,
  },
  benefitRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  benefitIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  benefitText: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 10,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.midnight,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 50,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
    marginRight: 8,
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 44,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  warningText: {
    color: colors.warning,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    textAlign: 'center',
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    textAlign: 'center',
  },
  privacyNote: {
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceSoft,
    borderRadius: 10,
    flexDirection: 'row',
    marginTop: 18,
    padding: 14,
  },
  privacyText: {
    color: colors.muted,
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    marginLeft: 10,
  },
});
