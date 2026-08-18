import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppIcon from '../components/AppIcon';
import { getDreamId, getDreamSummary, getDreamTimestamp } from '../domain/dreams';
import { buildEmotionOverview, sortEmotionData } from '../domain/emotions';
import {
  loadSavedDreams,
  subscribeToDreamRecords,
} from '../services/dreamRepository';
import { loadEmotionRecords } from '../services/emotionRepository';
import { trackProductEvent } from '../services/productAnalytics';
import { useSubscriptionAccess } from '../subscriptions/SubscriptionContext';
import { radii, screenPadding, spacing, typography } from '../theme/tokens';
import { useAppTheme, useThemeStyles } from '../theme/ThemeContext';

const DEEP_PATTERN_GOAL = 6;

const isSameMonth = (timestamp, comparisonDate) => {
  const date = new Date(timestamp);
  return date.getFullYear() === comparisonDate.getFullYear() &&
    date.getMonth() === comparisonDate.getMonth();
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
};

const capitalize = value => value
  ? value.charAt(0).toUpperCase() + value.slice(1)
  : '';

export default function Inicio({ navigation }) {
  const subscription = useSubscriptionAccess();
  const { colors } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const [dreams, setDreams] = useState([]);
  const [emotionRecords, setEmotionRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [savedDreams, savedEmotionRecords] = await Promise.all([
          loadSavedDreams(),
          loadEmotionRecords(),
          subscription.refresh().catch(() => null),
        ]);
        setDreams(savedDreams);
        setEmotionRecords(savedEmotionRecords);
      } catch (error) {
        console.error('Error cargando el inicio de Lunentra:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
    const unsubscribe = navigation.addListener('focus', loadDashboard);
    const dreamSubscription = subscribeToDreamRecords(async () => {
      try {
        const [savedDreams, savedEmotionRecords] = await Promise.all([
          loadSavedDreams(),
          loadEmotionRecords(),
        ]);
        setDreams(savedDreams);
        setEmotionRecords(savedEmotionRecords);
      } catch (error) {
        console.error('Error actualizando el inicio de Lunentra:', error);
      }
    });

    return () => {
      unsubscribe();
      dreamSubscription.remove();
    };
  }, [navigation, subscription.refresh]);

  const now = new Date();
  const dreamsThisMonth = dreams.filter(dream =>
    isSameMonth(getDreamTimestamp(dream), now)
  );
  const latestDream = dreams[0] || null;
  const emotionSummary = useMemo(() => {
    const overview = buildEmotionOverview(emotionRecords, dreams);
    const dominantEmotion = [...overview.chartData]
      .filter(item => item.count > 0)
      .sort(sortEmotionData)[0] || null;

    return { dominantEmotion, totalDreams: overview.totalDreams };
  }, [dreams, emotionRecords]);
  const topEmotion = emotionSummary.dominantEmotion;
  const progressValue = Math.min(dreams.length / DEEP_PATTERN_GOAL, 1);
  const hasDeepPatternGoal = dreams.length >= DEEP_PATTERN_GOAL;

  const startInterpretation = () => {
    trackProductEvent('home_primary_cta_clicked', {
      totalDreams: dreams.length,
      monthlyDreams: dreamsThisMonth.length,
    });
    navigation.navigate('NuevoSueno');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
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

        <View style={styles.hero}>
          <View style={[styles.star, styles.starOne]} />
          <View style={[styles.star, styles.starTwo]} />
          <View style={[styles.star, styles.starThree]} />

          <View style={styles.heroEyebrowRow}>
            <AppIcon name="sparkles" size={16} color={colors.lavender} />
            <Text style={styles.heroEyebrow}>{getGreeting()}</Text>
          </View>
          <Text style={styles.heroTitle}>
            {dreams.length
              ? '¿Qué soñaste esta vez?'
              : 'Interpreta tu primer sueño.'}
          </Text>
          <Text style={styles.heroText}>
            Cuéntanos lo que recuerdes y recibe una lectura orientativa en unos
            instantes.
          </Text>

          <TouchableOpacity
            style={styles.heroAction}
            onPress={startInterpretation}
            accessibilityRole="button"
            accessibilityLabel="Interpretar un sueño"
          >
            <Text style={styles.heroActionText}>Interpretar un sueño</Text>
            <AppIcon name="arrowRight" size={19} color="#172033" />
          </TouchableOpacity>
        </View>

        {!dreams.length ? (
          <View style={styles.firstInterpretationCard}>
            <View style={styles.firstInterpretationIcon}>
              <AppIcon name="chart" size={20} color={colors.primary} />
            </View>
            <Text style={styles.firstInterpretationText}>
              Cada lectura se añade automáticamente a tu historial para ayudarte
              a reconocer emociones y patrones con el tiempo.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderCopy}>
                <Text style={styles.eyebrow}>TU PANORAMA</Text>
                <Text style={styles.sectionTitle}>Un vistazo a tus interpretaciones</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('DiagramaEmocional')}>
                <Text style={styles.sectionLink}>Ver patrones</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <View style={styles.statIcon}>
                  <AppIcon name="calendar" size={19} color={colors.primary} />
                </View>
                <Text style={styles.statValue}>{dreamsThisMonth.length}</Text>
                <Text style={styles.statLabel}>
                  {dreamsThisMonth.length === 1
                    ? 'interpretación este mes'
                    : 'interpretaciones este mes'}
                </Text>
              </View>

              <View style={styles.statCard}>
                <View style={styles.statIcon}>
                  <AppIcon name="chart" size={19} color={colors.primary} />
                </View>
                <Text style={styles.statValueText} numberOfLines={1}>
                  {topEmotion ? capitalize(topEmotion.label) : 'En formación'}
                </Text>
                <Text style={styles.statLabel}>
                  {topEmotion ? 'emoción más frecuente' : 'aparecerá con más datos'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.patternCard}
              onPress={() => navigation.navigate('DiagramaEmocional')}
              accessibilityRole="button"
              accessibilityLabel="Abrir patrones"
            >
              <View style={styles.patternHeader}>
                <View style={styles.patternIcon}>
                  <AppIcon name="moon" size={19} color={colors.primary} />
                </View>
                <View style={styles.patternCopy}>
                  <Text style={styles.patternTitle}>Lectura profunda</Text>
                  <Text style={styles.patternMeta}>
                    {hasDeepPatternGoal
                      ? 'Ya tienes suficiente historial para explorarla'
                      : `${Math.min(dreams.length, DEEP_PATTERN_GOAL)} de ${DEEP_PATTERN_GOAL} interpretaciones`}
                  </Text>
                </View>
                <AppIcon name="arrowRight" size={18} color={colors.muted} />
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[styles.progressFill, { width: `${progressValue * 100}%` }]}
                />
              </View>
            </TouchableOpacity>

            {latestDream ? (
              <View style={styles.latestSection}>
                <Text style={styles.sectionTitle}>Última interpretación</Text>
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
                        : 'Abrir interpretación'}
                    </Text>
                  </View>
                  <AppIcon name="arrowRight" size={18} color={colors.muted} />
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        )}

        {subscription.isGuest && dreams.length > 0 ? (
          <TouchableOpacity
            style={styles.accountPrompt}
            onPress={() => subscription.showPaywall('guest-follow-up')}
          >
            <AppIcon name="profile" size={20} color={colors.primary} />
            <View style={styles.accountPromptCopy}>
              <Text style={styles.accountPromptTitle}>Conserva tu panorama</Text>
              <Text style={styles.accountPromptText}>
                Crea una cuenta gratuita para seguir interpretando.
              </Text>
            </View>
            <AppIcon name="arrowRight" size={18} color={colors.primary} />
          </TouchableOpacity>
        ) : null}

        <Text style={styles.disclaimer}>
          Las lecturas son orientativas. Lunentra no diagnostica ni sustituye la
          atención de un profesional de salud mental.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = colors => StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
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
    marginBottom: spacing.xl,
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
  brand: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  hero: {
    backgroundColor: colors.midnight,
    borderRadius: radii.lg,
    overflow: 'hidden',
    padding: spacing.xl,
  },
  star: {
    backgroundColor: colors.lavender,
    borderRadius: radii.pill,
    opacity: 0.55,
    position: 'absolute',
  },
  starOne: { height: 4, right: 30, top: 24, width: 4 },
  starTwo: { height: 3, right: 76, top: 58, width: 3 },
  starThree: { height: 5, right: 20, top: 104, width: 5 },
  heroEyebrowRow: { alignItems: 'center', flexDirection: 'row' },
  heroEyebrow: {
    color: colors.lavender,
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 7,
  },
  heroTitle: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    marginTop: spacing.md,
    maxWidth: 300,
  },
  heroText: {
    color: '#D0D5DD',
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm,
    maxWidth: 315,
  },
  heroAction: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
  },
  heroActionText: { color: '#172033', fontSize: 16, fontWeight: '800' },
  firstInterpretationCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    flexDirection: 'row',
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  firstInterpretationIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    height: 38,
    justifyContent: 'center',
    marginRight: spacing.md,
    width: 38,
  },
  firstInterpretationText: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
  },
  sectionHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xxxl,
  },
  sectionHeaderCopy: { flex: 1, marginRight: spacing.md },
  eyebrow: { ...typography.eyebrow, color: colors.primary },
  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.ink,
    marginTop: 5,
  },
  sectionLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    paddingVertical: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  statCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    minHeight: 124,
    padding: spacing.lg,
  },
  statIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 9,
    height: 34,
    justifyContent: 'center',
    marginBottom: spacing.md,
    width: 34,
  },
  statValue: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: '800',
    lineHeight: 29,
  },
  statValueText: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 29,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  patternCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  patternHeader: { alignItems: 'center', flexDirection: 'row' },
  patternIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    height: 38,
    justifyContent: 'center',
    marginRight: spacing.md,
    width: 38,
  },
  patternCopy: { flex: 1, marginRight: spacing.sm },
  patternTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  patternMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  progressTrack: {
    backgroundColor: colors.line,
    borderRadius: radii.pill,
    height: 6,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    height: '100%',
  },
  latestSection: { marginTop: spacing.xxxl },
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
  latestDay: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  latestMonth: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  latestCopy: { flex: 1, marginRight: spacing.sm },
  latestTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  latestMeta: { color: colors.muted, fontSize: 12, marginTop: 4 },
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
  accountPromptCopy: { flex: 1, marginHorizontal: spacing.md },
  accountPromptTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  accountPromptText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  disclaimer: {
    color: colors.subtle,
    fontSize: 11,
    lineHeight: 17,
    marginTop: spacing.xxxl,
    textAlign: 'center',
  },
});
