import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AppIcon from '../components/AppIcon';
import { GlobalContext } from '../GlobalContext';
import { PROFILE_QUESTIONS } from '../domain/profile';
import {
  getDreamSummary,
  getDreamTimestamp,
} from '../domain/dreams';
import { loadSavedDreams } from '../services/dreamRepository';
import { useSubscriptionAccess } from '../subscriptions/SubscriptionContext';

const MONTHLY_PATTERN_GOAL = 10;

const isSameMonth = (timestamp, comparisonDate) => {
  const date = new Date(timestamp);
  return date.getFullYear() === comparisonDate.getFullYear() &&
    date.getMonth() === comparisonDate.getMonth();
};

const getTopEmotion = (dreams) => {
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

export default function Inicio({ navigation }) {
  const { respuestas } = useContext(GlobalContext);
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
  const completedProfileQuestions = PROFILE_QUESTIONS.filter(
    item => respuestas[item.key]?.trim()
  ).length;
  const latestDream = dreams[0] || null;
  const topEmotion = useMemo(() => getTopEmotion(dreams), [dreams]);
  const progressValue = Math.min(
    dreamsThisMonth.length / MONTHLY_PATTERN_GOAL,
    1
  );
  const interpretationUsage = subscription.accessStatus?.interpretations;
  const interpretationLimit = interpretationUsage?.limit ||
    (subscription.isGuest ? 1 : 3);
  const interpretationRemaining = interpretationUsage?.remaining ??
    interpretationLimit;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#4F46E5" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>TU ESPACIO PERSONAL</Text>
        <Text style={styles.heroTitle}>Conócete a través de lo que sueñas.</Text>
        <Text style={styles.heroText}>
          Registra, reflexiona y observa lo que se repite con el tiempo.
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('NuevoSueno')}
        >
          <AppIcon name="moon" size={20} color="#111827" />
          <Text style={styles.primaryButtonText}>Registrar un sueño</Text>
        </TouchableOpacity>
        <Text style={styles.heroNote}>
          Lunentra propone posibilidades. Tú decides qué tiene sentido para ti.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.planStrip}
        onPress={() => navigation.navigate('PlanPremium')}
      >
        <View style={styles.planStripIcon}>
          <AppIcon name="bookmark" size={19} color="#4338CA" />
        </View>
        <View style={styles.planStripCopy}>
          <Text style={styles.planStripTitle}>
            {subscription.isPremium
              ? 'Lunentra Premium'
              : subscription.isGuest
                ? 'Sesión invitada'
                : 'Cuenta gratuita'}
          </Text>
          <Text style={styles.planStripText}>
            {subscription.isPremium
              ? `${interpretationRemaining} de ${interpretationLimit} lecturas disponibles este mes`
              : `${interpretationRemaining} de ${interpretationLimit} lecturas de IA disponibles`}
          </Text>
        </View>
        <AppIcon name="arrowRight" size={18} color="#4338CA" />
      </TouchableOpacity>

      {subscription.isGuest && dreams.length > 0 ? (
        <TouchableOpacity
          style={styles.accountCard}
          onPress={() => subscription.showPaywall('guest-follow-up')}
        >
          <Text style={styles.accountCardTitle}>Continúa donde lo dejaste</Text>
          <Text style={styles.accountCardText}>
            Crea una cuenta gratuita para profundizar en tu primera lectura y
            desbloquear las lecturas restantes.
          </Text>
          <Text style={styles.accountCardAction}>Crear cuenta →</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Tu recorrido</Text>
        <Text style={styles.sectionSubtitle}>
          Cada registro añade contexto a tu historia.
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{dreams.length}</Text>
          <Text style={styles.statLabel}>Sueños</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{dreamsThisMonth.length}</Text>
          <Text style={styles.statLabel}>Este mes</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{completedProfileQuestions}/7</Text>
          <Text style={styles.statLabel}>Contexto</Text>
        </View>
      </View>

      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <View style={styles.progressIcon}>
            <AppIcon name="chart" size={20} color="#4338CA" />
          </View>
          <View style={styles.progressCopy}>
            <Text style={styles.cardTitle}>Lectura profunda del mes</Text>
            <Text style={styles.cardText}>
              {dreamsThisMonth.length}/{MONTHLY_PATTERN_GOAL} sueños registrados
            </Text>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${progressValue * 100}%` }]}
          />
        </View>
        {topEmotion ? (
          <Text style={styles.insightText}>
            Primer indicio: <Text style={styles.insightStrong}>{topEmotion[0]}</Text>{' '}
            aparece en {topEmotion[1]} de tus registros.
          </Text>
        ) : (
          <Text style={styles.insightText}>
            Los primeros indicios aparecerán cuando hayas guardado varios sueños.
          </Text>
        )}
      </View>

      <View style={styles.actionGrid}>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('SuenosGuardados')}
        >
          <View style={styles.actionIcon}>
            <AppIcon name="bookmark" size={21} color="#111827" />
          </View>
          <Text style={styles.actionTitle}>Mi diario</Text>
          <Text style={styles.actionText}>Vuelve a tus sueños y reflexiones.</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('DiagramaEmocional')}
        >
          <View style={styles.actionIcon}>
            <AppIcon name="chart" size={21} color="#111827" />
          </View>
          <Text style={styles.actionTitle}>Mis patrones</Text>
          <Text style={styles.actionText}>Observa emociones y cambios.</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('Perfil')}
        >
          <View style={styles.actionIcon}>
            <AppIcon name="profile" size={21} color="#111827" />
          </View>
          <Text style={styles.actionTitle}>Mi contexto</Text>
          <Text style={styles.actionText}>Personaliza las lecturas a tu ritmo.</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('Configuracion')}
        >
          <View style={styles.actionIcon}>
            <AppIcon name="shield" size={21} color="#111827" />
          </View>
          <Text style={styles.actionTitle}>Privacidad</Text>
          <Text style={styles.actionText}>Decide cómo se usan tus datos.</Text>
        </TouchableOpacity>
      </View>

      {latestDream ? (
        <TouchableOpacity
          style={styles.latestCard}
          onPress={() => navigation.navigate('SuenosGuardados')}
        >
          <Text style={styles.latestLabel}>ÚLTIMO REGISTRO</Text>
          <Text style={styles.latestTitle}>{getDreamSummary(latestDream)}</Text>
          <Text style={styles.latestDate}>
            {new Date(getDreamTimestamp(latestDream)).toLocaleDateString()}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Tu diario empieza con un recuerdo.</Text>
          <Text style={styles.emptyText}>
            No necesitas recordarlo todo. Una imagen o una emoción es suficiente.
          </Text>
        </View>
      )}

      <Text style={styles.disclaimer}>
        Lunentra es una herramienta de reflexión. No ofrece diagnósticos ni sustituye
        la atención de un profesional de salud mental.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#F8FAFC',
    flex: 1,
  },
  container: {
    paddingBottom: 34,
  },
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    flex: 1,
    justifyContent: 'center',
  },
  hero: {
    backgroundColor: '#07111F',
    paddingBottom: 28,
    paddingHorizontal: 22,
    paddingTop: 30,
  },
  eyebrow: {
    color: '#A5B4FC',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 37,
    marginTop: 10,
    maxWidth: 420,
  },
  heroText: {
    color: '#CBD5E1',
    fontSize: 15,
    lineHeight: 23,
    marginTop: 10,
  },
  primaryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 10,
    flexDirection: 'row',
    marginTop: 22,
    minHeight: 50,
    paddingHorizontal: 17,
  },
  primaryButtonText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
    marginLeft: 9,
  },
  heroNote: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 15,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 9,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  statCard: {
    backgroundColor: '#fff',
    borderColor: '#E2E8F0',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    padding: 13,
  },
  statValue: {
    color: '#111827',
    fontSize: 21,
    fontWeight: '800',
  },
  statLabel: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 3,
  },
  progressCard: {
    backgroundColor: '#fff',
    borderColor: '#E2E8F0',
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: 20,
    marginTop: 14,
    padding: 16,
  },
  progressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  progressIcon: {
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    height: 42,
    justifyContent: 'center',
    marginRight: 12,
    width: 42,
  },
  progressCopy: {
    flex: 1,
  },
  cardTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
  },
  cardText: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 3,
  },
  progressTrack: {
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    height: 7,
    marginTop: 15,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#4F46E5',
    borderRadius: 4,
    height: '100%',
  },
  insightText: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  insightStrong: {
    color: '#111827',
    fontWeight: '800',
  },
  planStrip: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#E2E8F0',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 14,
  },
  planStripIcon: {
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 9,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  planStripCopy: {
    flex: 1,
    marginHorizontal: 11,
  },
  planStripTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
  },
  planStripText: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  accountCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 16,
  },
  accountCardTitle: {
    color: '#312E81',
    fontSize: 16,
    fontWeight: '800',
  },
  accountCardText: {
    color: '#4F46E5',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  accountCardAction: {
    color: '#312E81',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 10,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  actionCard: {
    backgroundColor: '#fff',
    borderColor: '#E2E8F0',
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 142,
    padding: 15,
    width: '48%',
  },
  actionIcon: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 9,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  actionTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 12,
  },
  actionText: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  latestCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 17,
  },
  latestLabel: {
    color: '#6366F1',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  latestTitle: {
    color: '#1E1B4B',
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 23,
    marginTop: 7,
  },
  latestDate: {
    color: '#6366F1',
    fontSize: 12,
    marginTop: 7,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderColor: '#CBD5E1',
    borderRadius: 14,
    borderStyle: 'dashed',
    borderWidth: 1,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 18,
  },
  emptyTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  disclaimer: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 17,
    marginHorizontal: 22,
    marginTop: 22,
    textAlign: 'center',
  },
});
