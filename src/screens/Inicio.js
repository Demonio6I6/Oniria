import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AppIcon from '../components/AppIcon';
import { getDreamId, getDreamSummary, getDreamTimestamp } from '../domain/dreams';
import { loadSavedDreams } from '../services/dreamRepository';
import { trackProductEvent } from '../services/productAnalytics';
import { useSubscriptionAccess } from '../subscriptions/SubscriptionContext';
import { colors, radii, screenPadding, spacing, typography } from '../theme/tokens';

const MONTHLY_PATTERN_GOAL = 10;

const isSameMonth = (timestamp, comparisonDate) => {
  const date = new Date(timestamp);
  return date.getFullYear() === comparisonDate.getFullYear() &&
    date.getMonth() === comparisonDate.getMonth();
};

const getTopEmotion = dreams => {
  const counts = {};

  dreams.forEach(dream => {
    const emotions = new Set(Array.isArray(dream?.emotions) ? dream.emotions : []);
    emotions.forEach(emotion => {
      counts[emotion] = (counts[emotion] || 0) + 1;
    });
  });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))[0] || null;
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
};

export default function Inicio({ navigation }) {
  const subscription = useSubscriptionAccess();
  const [dreams, setDreams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [savedDreams] = await Promise.all([
          loadSavedDreams(),
          subscription.refresh().catch(() => null),
        ]);
        setDreams(savedDreams);
      } catch (error) {
        console.error('Error cargando el inicio de Lunentra:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
    const unsubscribe = navigation.addListener('focus', loadDashboard);
    return unsubscribe;
  }, [navigation, subscription.refresh]);

  const now = new Date();
  const dreamsThisMonth = dreams.filter(dream =>
    isSameMonth(getDreamTimestamp(dream), now)
  );
  const latestDream = dreams[0] || null;
  const topEmotion = useMemo(
    () => getTopEmotion(dreamsThisMonth),
    [dreamsThisMonth]
  );
  const progressValue = Math.min(
    dreamsThisMonth.length / MONTHLY_PATTERN_GOAL,
    1
  );
  const remainingDreams = Math.max(MONTHLY_PATTERN_GOAL - dreamsThisMonth.length, 0);
  const monthLabel = now.toLocaleDateString('es-ES', { month: 'long' });
  const hasMonthlyGoal = dreamsThisMonth.length >= MONTHLY_PATTERN_GOAL;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.header}>
        <View style={styles.brandMark}>
          <AppIcon name="moon" size={18} color={colors.white} />
        </View>
        <Text style={styles.brand}>Lunentra</Text>
      </View>

      <Text style={styles.greeting}>{getGreeting()}</Text>
      <Text style={styles.pageTitle}>
        {dreams.length
          ? '¿Qué recuerdas de anoche?'
          : 'Tu diario empieza con una imagen.'}
      </Text>
      <Text style={styles.intro}>
        {dreams.length
          ? 'Una escena, una emoción o un detalle extraño es suficiente.'
          : 'No necesitas recordarlo todo para comenzar a conocerte mejor.'}
      </Text>

      <TouchableOpacity
        style={styles.captureButton}
        onPress={() => {
          trackProductEvent('home_primary_cta_clicked', {
            totalDreams: dreams.length,
            monthlyDreams: dreamsThisMonth.length,
          });
          navigation.navigate('NuevoSueno');
        }}
        accessibilityRole="button"
        accessibilityLabel="Registrar un sueño"
      >
        <View style={styles.captureIcon}>
          <AppIcon name="plus" size={22} color={colors.midnight} />
        </View>
        <View style={styles.captureCopy}>
          <Text style={styles.captureTitle}>Registrar un sueño</Text>
          <Text style={styles.captureText}>Guárdalo ahora y explóralo a tu ritmo</Text>
        </View>
        <AppIcon name="arrowRight" size={19} color={colors.lavender} />
      </TouchableOpacity>

      <View style={styles.journeySection}>
        <View style={styles.sectionHeadingRow}>
          <View>
            <Text style={styles.eyebrow}>TU RECORRIDO EN {monthLabel.toUpperCase()}</Text>
            <Text style={styles.sectionTitle}>Lectura profunda del mes</Text>
          </View>
          <Text style={styles.progressCount}>
            {dreamsThisMonth.length}/{MONTHLY_PATTERN_GOAL}
          </Text>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${progressValue * 100}%` }]}
          />
        </View>

        <Text style={styles.journeyText}>
          {hasMonthlyGoal
            ? 'Ya tienes suficiente contexto para explorar los patrones del mes.'
            : remainingDreams === MONTHLY_PATTERN_GOAL
              ? 'Cada nuevo registro añadirá una pieza a tu historia.'
              : `Te faltan ${remainingDreams} ${remainingDreams === 1 ? 'registro' : 'registros'} para activar tu lectura mensual.`}
        </Text>

        {hasMonthlyGoal ? (
          <TouchableOpacity
            style={styles.inlineAction}
            onPress={() => navigation.navigate('DiagramaEmocional')}
          >
            <Text style={styles.inlineActionText}>Explorar mis patrones</Text>
            <AppIcon name="arrowRight" size={17} color={colors.primary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {topEmotion ? (
        <View style={styles.insightSection}>
          <View style={styles.insightIcon}>
            <AppIcon name="chart" size={20} color={colors.primary} />
          </View>
          <View style={styles.insightCopy}>
            <Text style={styles.eyebrow}>UN INDICIO RECIENTE</Text>
            <Text style={styles.insightText}>
              <Text style={styles.insightStrong}>{topEmotion[0]}</Text> aparece en{' '}
              {topEmotion[1]} {topEmotion[1] === 1 ? 'sueño' : 'sueños'} este mes.
            </Text>
            <Text style={styles.insightNote}>
              Es una señal orientativa, no una conclusión sobre ti.
            </Text>
          </View>
        </View>
      ) : null}

      {latestDream ? (
        <View style={styles.latestSection}>
          <Text style={styles.sectionTitle}>Último registro</Text>
          <TouchableOpacity
            style={styles.latestRow}
            onPress={() => navigation.navigate('DetalleSueno', {
              dreamId: getDreamId(latestDream),
            })}
          >
            <View style={styles.latestDateBlock}>
              <Text style={styles.latestDay}>
                {new Date(getDreamTimestamp(latestDream)).getDate()}
              </Text>
              <Text style={styles.latestMonth}>
                {new Date(getDreamTimestamp(latestDream))
                  .toLocaleDateString('es-ES', { month: 'short' })
                  .replace('.', '')}
              </Text>
            </View>
            <View style={styles.latestCopy}>
              <Text style={styles.latestTitle} numberOfLines={2}>
                {getDreamSummary(latestDream)}
              </Text>
              <Text style={styles.latestMeta}>
                {latestDream.wakingEmotion
                  ? `Al despertar: ${latestDream.wakingEmotion}`
                  : 'Abrir registro'}
              </Text>
            </View>
            <AppIcon name="arrowRight" size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>
      ) : null}

      {subscription.isGuest && dreams.length > 0 ? (
        <TouchableOpacity
          style={styles.accountPrompt}
          onPress={() => subscription.showPaywall('guest-follow-up')}
        >
          <AppIcon name="profile" size={20} color={colors.primary} />
          <View style={styles.accountPromptCopy}>
            <Text style={styles.accountPromptTitle}>Conserva tu recorrido</Text>
            <Text style={styles.accountPromptText}>
              Crea una cuenta gratuita para continuar desde aquí.
            </Text>
          </View>
          <AppIcon name="arrowRight" size={18} color={colors.primary} />
        </TouchableOpacity>
      ) : null}

      <Text style={styles.disclaimer}>
        Lunentra acompaña tu reflexión. No diagnostica ni sustituye la atención
        de un profesional de salud mental.
      </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    paddingBottom: spacing.xxxl,
    paddingHorizontal: screenPadding,
    paddingTop: spacing.xl,
  },
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: spacing.xxxl,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: colors.midnight,
    borderRadius: 10,
    height: 34,
    justifyContent: 'center',
    marginRight: spacing.sm,
    width: 34,
  },
  brand: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  greeting: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  pageTitle: {
    ...typography.title,
    color: colors.ink,
    marginTop: spacing.sm,
    maxWidth: 350,
  },
  intro: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.sm,
    maxWidth: 360,
  },
  captureButton: {
    alignItems: 'center',
    backgroundColor: colors.midnight,
    borderRadius: radii.lg,
    flexDirection: 'row',
    marginTop: spacing.xxl,
    minHeight: 82,
    padding: spacing.lg,
  },
  captureIcon: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 13,
    height: 46,
    justifyContent: 'center',
    marginRight: spacing.md,
    width: 46,
  },
  captureCopy: {
    flex: 1,
  },
  captureTitle: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '800',
  },
  captureText: {
    color: '#C7CEDB',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  journeySection: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    marginTop: spacing.xxxl,
    paddingBottom: spacing.xxl,
  },
  sectionHeadingRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.primary,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.ink,
    marginTop: 5,
  },
  progressCount: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  progressTrack: {
    backgroundColor: colors.line,
    borderRadius: radii.pill,
    height: 8,
    marginTop: spacing.lg,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    height: '100%',
  },
  journeyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing.md,
  },
  inlineAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  inlineActionText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
    marginRight: 6,
  },
  insightSection: {
    alignItems: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.lg,
    flexDirection: 'row',
    marginTop: spacing.xxl,
    padding: spacing.lg,
  },
  insightIcon: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 11,
    height: 40,
    justifyContent: 'center',
    marginRight: spacing.md,
    width: 40,
  },
  insightCopy: {
    flex: 1,
  },
  insightText: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 5,
  },
  insightStrong: {
    fontWeight: '800',
  },
  insightNote: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  latestSection: {
    marginTop: spacing.xxxl,
  },
  latestRow: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingVertical: spacing.lg,
  },
  latestDateBlock: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.md,
    height: 52,
    justifyContent: 'center',
    marginRight: spacing.md,
    width: 52,
  },
  latestDay: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  latestMonth: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  latestCopy: {
    flex: 1,
    marginRight: spacing.sm,
  },
  latestTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  latestMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  accountPrompt: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: spacing.xxl,
    padding: spacing.lg,
  },
  accountPromptCopy: {
    flex: 1,
    marginHorizontal: spacing.md,
  },
  accountPromptTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  accountPromptText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  disclaimer: {
    color: colors.subtle,
    fontSize: 10,
    lineHeight: 16,
    marginTop: spacing.xxxl,
    textAlign: 'center',
  },
});
