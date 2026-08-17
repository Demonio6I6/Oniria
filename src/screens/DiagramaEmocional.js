import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { RadarChart } from 'react-native-gifted-charts';
import Markdown from 'react-native-markdown-display';
import { obtenerPatronEmocional } from '../../openai';
import {
  buildEmotionOverview,
  sortEmotionData,
} from '../domain/emotions';
import {
  buildDreamAnalysisText,
  getDreamTimestamp,
} from '../domain/dreams';
import {
  loadSavedDreams,
  subscribeToDreamRecords,
} from '../services/dreamRepository';
import { loadEmotionRecords } from '../services/emotionRepository';
import {
  loadMonthlyAnalysis,
  saveMonthlyAnalysis,
} from '../services/monthlyAnalysisRepository';
import {
  acceptMonthlyAnalysisPrivacyNotice,
  hasAcceptedMonthlyAnalysisPrivacyNotice,
} from '../services/privacyRepository';
import { useSubscriptionAccess } from '../subscriptions/SubscriptionContext';
import AppIcon from '../components/AppIcon';
import ReportAiContentButton from '../components/ReportAiContentButton';
import { radii, screenPadding, spacing, typography } from '../theme/tokens';
import { useAppTheme, useThemeStyles } from '../theme/ThemeContext';
import { trackProductEvent } from '../services/productAnalytics';

const MAX_DREAMS_PER_ANALYSIS = 20;
const MIN_DREAMS_PER_DEEP_ANALYSIS = 6;
const DEEP_ANALYSIS_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const RADAR_MAX_VALUE = 100;
const RADAR_MAX_SIZE = 320;
const RADAR_MIN_SIZE = 240;
const EMOTION_LIST_LIMIT = 5;

const formatPercent = (value) => `${Math.round(Number(value) || 0)}%`;

const formatEmotionLabel = (label) =>
  String(label || '').charAt(0).toUpperCase() + String(label || '').slice(1);

const getFunctionErrorCode = (error) =>
  String(error?.code || '').replace(/^functions\//, '');

const getFunctionErrorDetails = (error) =>
  error?.details || error?.customData?.details || {};

const formatRetryAt = (retryAt) => {
  if (!retryAt) return '';

  const date = new Date(retryAt);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString([], {
    day: 'numeric',
    month: 'long',
  });
};

const formatAnalysisDate = (timestamp) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const buildDeepAnalysisErrorMessage = (error, dreamCount) => {
  const code = getFunctionErrorCode(error);
  const details = getFunctionErrorDetails(error);

  if (code === 'failed-precondition' && details.reason === 'account-required') {
    return 'Crea una cuenta para conservar tus suenos y activar esta lectura.';
  }

  if (
    code === 'failed-precondition' &&
    details.reason === 'monthly-analysis-min-dreams'
  ) {
    const requiredDreams =
      details.requiredDreams || MIN_DREAMS_PER_DEEP_ANALYSIS;
    const currentDreams = details.currentDreams || dreamCount;
    const missingDreams = Math.max(requiredDreams - currentDreams, 0);

    return `Necesitas ${requiredDreams} sueños guardados. Te faltan ${missingDreams}.`;
  }

  if (code === 'resource-exhausted') {
    if (details.reason === 'premium-required') {
      return 'La lectura profunda requiere Lunentra Premium.';
    }

    if (details.reason === 'monthly-analysis-in-progress') {
      return 'Ya hay una lectura profunda en curso. Espera un momento antes de intentarlo otra vez.';
    }

    const retryAt = details.retryAt || details.retryAtMillis;
    const formattedRetryAt = formatRetryAt(retryAt);

    return formattedRetryAt
      ? `Ya generaste tu lectura profunda. Podrás actualizarla a partir del ${formattedRetryAt}.`
      : 'Ya generaste tu lectura profunda. Podrás actualizarla más adelante.';
  }

  return 'No se pudo generar la lectura profunda en este momento.';
};

const confirmarPrivacidadIA = async () => {
  if (await hasAcceptedMonthlyAnalysisPrivacyNotice()) return true;

  return new Promise(resolve => {
    Alert.alert(
      'Privacidad de la lectura profunda',
      'Para generar esta lectura se enviarán los datos relevantes de hasta 20 sueños recientes a nuestro servidor y al proveedor de IA. No se enviarán las interpretaciones anteriores y no se usa como diagnóstico clínico.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'Aceptar',
          onPress: async () => {
            try {
              await acceptMonthlyAnalysisPrivacyNotice();
              resolve(true);
            } catch (error) {
              console.error('Error guardando consentimiento de privacidad:', error);
              Alert.alert(
                'Error',
                'No se pudo guardar tu preferencia de privacidad.'
              );
              resolve(false);
            }
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: () => resolve(false),
      }
    );
  });
};

export default function DiagramaEmocional() {
  const subscription = useSubscriptionAccess();
  const { colors } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const markdownStyles = useThemeStyles(createMarkdownStyles);
  const { width } = useWindowDimensions();
  const [data, setData] = useState([]);
  const [selectedEmocion, setSelectedEmocion] = useState(null);
  const [cantidadSuenos, setCantidadSuenos] = useState(0);
  const [suenos, setSuenos] = useState([]);
  const [analisisMensual, setAnalisisMensual] = useState('');
  const [monthlyAnalysisRecord, setMonthlyAnalysisRecord] = useState(null);
  const [analizandoMensual, setAnalizandoMensual] = useState(false);
  const [dreamRecordsRevision, setDreamRecordsRevision] = useState(0);
  const chartSize = Math.max(
    RADAR_MIN_SIZE,
    Math.min(RADAR_MAX_SIZE, width - 56)
  );
  const orderedData = [...data].sort(sortEmotionData);
  const relevantData = orderedData.filter(item => item.count > 0);
  const visibleEmotionData = (
    relevantData.length ? relevantData : orderedData
  ).slice(0, EMOTION_LIST_LIMIT);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const [
          legacyRecords,
          suenosGuardados,
          cachedMonthlyAnalysis,
        ] = await Promise.all([
          loadEmotionRecords(),
          loadSavedDreams(),
          loadMonthlyAnalysis(),
        ]);
        const chart = buildEmotionOverview(legacyRecords, suenosGuardados);
        const cachedAnalysisIsAvailable =
          typeof cachedMonthlyAnalysis?.text === 'string';

        setData(chart.chartData);
        setCantidadSuenos(chart.totalDreams);
        setSuenos(suenosGuardados);
        setMonthlyAnalysisRecord(cachedMonthlyAnalysis || null);
        setAnalisisMensual(
          cachedAnalysisIsAvailable ? cachedMonthlyAnalysis.text : ''
        );
      } catch (error) {
        console.error('Error al cargar datos emocionales:', error);
      }
    };

    cargarDatos();
  }, [dreamRecordsRevision]);

  useEffect(() => {
    const dreamSubscription = subscribeToDreamRecords(() => {
      setDreamRecordsRevision(current => current + 1);
    });

    return () => dreamSubscription.remove();
  }, []);

  useEffect(() => {
    const accountConversionSubscription = DeviceEventEmitter.addListener(
      'accountConversionCompleted',
      event => {
        if (event?.reason !== 'monthly-analysis-account') return;
        subscription.refresh();
        setTimeout(() => subscription.showPaywall('monthly-analysis'), 350);
      }
    );

    return () => accountConversionSubscription.remove();
  }, [subscription.refresh, subscription.showPaywall]);

  const renderRadarChart = () => {
    if (!data.length) return null;

    return (
      <View style={styles.chartSection}>
        <RadarChart
          data={data.map(item => item.value)}
          labels={data.map(item => formatEmotionLabel(item.label))}
          maxValue={RADAR_MAX_VALUE}
          chartSize={chartSize}
          noOfSections={5}
          circular
          labelsPositionOffset={8}
          labelConfig={{
            fontSize: 11,
            stroke: colors.ink,
            fontWeight: '600',
          }}
          gridConfig={{
            stroke: colors.line,
            strokeWidth: 1,
            fill: colors.surface,
            opacity: 0.12,
          }}
          asterLinesConfig={{
            stroke: colors.line,
            strokeWidth: 1,
          }}
          polygonConfig={{
            stroke: colors.primary,
            strokeWidth: 2,
            fill: colors.primary,
            opacity: 0.18,
            showGradient: false,
            isAnimated: true,
          }}
        />
        <Text style={styles.chartNote}>
          Cada eje muestra el porcentaje de sueños donde aparece esa emoción.
          Un sueño puede incluir varias emociones.
        </Text>
      </View>
    );
  };

  const renderEmotionBreakdown = () => {
    if (!visibleEmotionData.length) return null;

    return (
      <View style={styles.breakdownSection}>
        <Text style={styles.sectionTitle}>Emociones principales</Text>
        {visibleEmotionData.map(item => {
          const isSelected = selectedEmocion === item.label;

          return (
            <TouchableOpacity
              key={item.label}
              style={[
                styles.emotionRow,
                isSelected && styles.emotionRowSelected,
              ]}
              onPress={() => setSelectedEmocion(isSelected ? null : item.label)}
              activeOpacity={0.8}
            >
              <View style={styles.emotionRowHeader}>
                <Text style={styles.emotionName}>
                  {formatEmotionLabel(item.label)}
                </Text>
                <Text style={styles.emotionPercent}>
                  {formatPercent(item.value)}
                </Text>
              </View>
              <View style={styles.emotionTrack}>
                <View
                  style={[
                    styles.emotionFill,
                    { width: `${Math.min(item.value, RADAR_MAX_VALUE)}%` },
                  ]}
                />
              </View>
              <Text style={styles.emotionEvidence}>
                Aparece en {item.count} de {cantidadSuenos} sueños analizados.
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const getLecturaGeneral = () => {
    if (!cantidadSuenos) {
      return (
        <Text style={styles.detailText}>
          Aún no hay suficientes sueños registrados para leer un patrón.
        </Text>
      );
    }

    const principal = relevantData[0];
    const secundarias = relevantData.slice(1, 3);
    const secundariasText = secundarias
      .map(emocion => `${emocion.label} (${formatPercent(emocion.value)})`)
      .join(' y ');

    return (
      <View style={styles.detailBox}>
        <Text style={styles.detailLabel}>
          {cantidadSuenos < 5 ? 'PRIMER INDICIO' : 'LECTURA GENERAL'}
        </Text>
        <Text style={styles.detailText}>
          En tus últimos {cantidadSuenos} sueños con emociones reconocidas destaca{' '}
          <Text style={styles.bold}>{principal.label}</Text> con{' '}
          {formatPercent(principal.value)}.{' '}
          {secundariasText
            ? `También aparecen ${secundariasText}.`
            : 'Por ahora no hay otra emoción con presencia clara.'}
          {cantidadSuenos < 5
            ? ' Todavía hay pocos registros, así que conviene leerlo como una señal inicial.'
            : ''}
        </Text>
      </View>
    );
  };

  const getLecturaEmocion = () => {
    if (!cantidadSuenos) return getLecturaGeneral();

    const emocion = data.find(item => item.label === selectedEmocion);
    if (!emocion) return null;

    if (!emocion.count) {
      return (
        <Text style={styles.detailText}>
          {formatEmotionLabel(emocion.label)} no aparece todavía en los sueños
          con emociones reconocidas.
        </Text>
      );
    }

    let mensaje =
      `En esta lectura orientativa, ${emocion.label} aparece en el ` +
      `${formatPercent(emocion.value)} de tus sueños con emociones reconocidas. `;

    if (emocion.value >= 75) {
      mensaje +=
        'Es una señal recurrente dentro de tus registros y puede merecer una reflexión más pausada.';
    } else if (emocion.value >= 40) {
      mensaje +=
        'Aparece con cierta frecuencia y puede estar conectada con temas activos en tu vida diaria.';
    } else if (emocion.value >= 15) {
      mensaje +=
        'Aparece ocasionalmente, quizá asociada a situaciones puntuales.';
    } else {
      mensaje +=
        'Aparece poco en los registros disponibles, así que conviene leerla con cautela.';
    }

    return <Text style={styles.detailText}>{mensaje}</Text>;
  };

  const getDeepAnalysisDreams = () =>
    suenos.slice(0, MAX_DREAMS_PER_ANALYSIS);

  const generarAnalisisProfundo = async () => {
    if (analizandoMensual) return;

    if (subscription.isGuest) {
      subscription.showPaywall('monthly-analysis-account');
      return;
    }

    if (!subscription.isPremium) {
      subscription.showPaywall('monthly-analysis');
      return;
    }

    const suenosDisponibles = getDeepAnalysisDreams();

    if (suenosDisponibles.length < MIN_DREAMS_PER_DEEP_ANALYSIS) {
      const suenosFaltantes =
        MIN_DREAMS_PER_DEEP_ANALYSIS - suenosDisponibles.length;

      Alert.alert(
        'Aún no hay suficientes sueños',
        `Necesitas ${MIN_DREAMS_PER_DEEP_ANALYSIS} sueños guardados. ` +
          `Te faltan ${suenosFaltantes}.`
      );
      return;
    }

    const nextAvailableAt = monthlyAnalysisRecord?.nextAvailableAt || 0;
    if (nextAvailableAt > Date.now()) {
      Alert.alert(
        'Lectura profunda ya generada',
        `Podrás actualizarla a partir del ${formatRetryAt(nextAvailableAt)}.`
      );
      return;
    }

    const privacidadAceptada = await confirmarPrivacidadIA();
    if (!privacidadAceptada) return;

    setAnalizandoMensual(true);

    try {
      const suenosParaAnalisis = suenosDisponibles
        .sort((a, b) => getDreamTimestamp(a) - getDreamTimestamp(b))
        .map(buildDreamAnalysisText);

      const respuesta = await obtenerPatronEmocional(
        suenosParaAnalisis,
        `Historial reciente: ${suenosParaAnalisis.length} sueños guardados`
      );

      const createdAt = Date.now();
      const analysisRecord = {
        text: respuesta.text,
        periodKey: 'recent-history',
        periodLabel: 'Historial reciente',
        dreamCount: suenos.length,
        analyzedDreamCount: suenosParaAnalisis.length,
        createdAt,
        nextAvailableAt:
          respuesta.nextAvailableAtMillis ||
          createdAt + DEEP_ANALYSIS_COOLDOWN_MS,
      };

      setMonthlyAnalysisRecord(analysisRecord);
      setAnalisisMensual(respuesta.text);
      trackProductEvent('monthly_analysis_generated', {
        dreamCount: suenos.length,
        analyzedDreamCount: suenosParaAnalisis.length,
      });
      saveMonthlyAnalysis(analysisRecord).catch(storageError => {
        console.error('Error guardando la lectura profunda:', storageError);
      });
    } catch (error) {
      console.error('Error generando la lectura profunda:', error);
      const details = getFunctionErrorDetails(error);

      if (details.reason === 'account-required') {
        subscription.showPaywall('monthly-analysis-account');
      } else if (details.reason === 'premium-required') {
        subscription.showPaywall('monthly-analysis');
      }

      Alert.alert(
        'Lectura no disponible',
        buildDeepAnalysisErrorMessage(error, suenosDisponibles.length)
      );
    } finally {
      setAnalizandoMensual(false);
    }
  };

  const suenosDisponiblesAnalisis = getDeepAnalysisDreams();
  const suenosFaltantesAnalisis = Math.max(
    MIN_DREAMS_PER_DEEP_ANALYSIS - suenosDisponiblesAnalisis.length,
    0
  );
  const hasMinimumMonthlyDreams =
    suenosDisponiblesAnalisis.length >= MIN_DREAMS_PER_DEEP_ANALYSIS;
  const monthlyAnalysisNextAvailableAt =
    subscription.accessStatus?.monthlyAnalysis?.nextAvailableAtMillis ||
    monthlyAnalysisRecord?.nextAvailableAt ||
    0;
  const monthlyAnalysisOnCooldown =
    monthlyAnalysisNextAvailableAt > Date.now();
  const monthlyAnalysisButtonDisabled =
    analizandoMensual || !hasMinimumMonthlyDreams || monthlyAnalysisOnCooldown;
  const monthlyAnalysisGeneratedAt =
    formatAnalysisDate(monthlyAnalysisRecord?.createdAt);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>PATRONES PERSONALES</Text>
      <Text style={styles.title}>Lo que se repite en tus sueños</Text>
      <Text style={styles.subtitle}>
        Señales orientativas basadas en {cantidadSuenos} sueños. Puedes revisar la
        evidencia y decidir qué tiene sentido para ti.
      </Text>

      <View style={styles.analysisSection}>
        <View style={styles.analysisHeading}>
          <View style={styles.analysisIcon}>
            <AppIcon name="moon" size={21} color={colors.primary} />
          </View>
          <View style={styles.analysisHeadingCopy}>
            <Text style={[styles.sectionTitle, styles.analysisTitle]}>
              Lectura profunda de patrones
            </Text>
            <Text style={styles.analysisMeta}>
              {`${Math.min(suenos.length, MIN_DREAMS_PER_DEEP_ANALYSIS)}/${MIN_DREAMS_PER_DEEP_ANALYSIS} sueños guardados`}
            </Text>
          </View>
        </View>

        <View style={styles.monthProgressTrack}>
          <View
            style={[
              styles.monthProgressFill,
              {
                width: `${Math.min(
                  suenos.length / MIN_DREAMS_PER_DEEP_ANALYSIS,
                  1
                ) * 100}%`,
              },
            ]}
          />
        </View>

        {!hasMinimumMonthlyDreams && (
          <Text style={styles.analysisHint}>
            Guarda {suenosFaltantesAnalisis} sueños más para activar esta
            lectura. No tienen que ser del mismo mes.
          </Text>
        )}
        {hasMinimumMonthlyDreams && !subscription.isPremium && (
          <Text style={styles.analysisHint}>
            Premium desbloquea una lectura profunda de los cambios, repeticiones
            y preguntas abiertas de tu historial reciente.
          </Text>
        )}
        {monthlyAnalysisOnCooldown && (
          <Text style={styles.analysisHint}>
            Podrás actualizar esta lectura el{' '}
            {formatRetryAt(monthlyAnalysisNextAvailableAt)}.
          </Text>
        )}
        <TouchableOpacity
          style={[
            styles.analysisButton,
            monthlyAnalysisButtonDisabled && styles.analysisButtonDisabled,
          ]}
          onPress={generarAnalisisProfundo}
          disabled={monthlyAnalysisButtonDisabled}
        >
          <Text style={styles.analysisButtonText}>
            {analizandoMensual ? 'Analizando...' : 'Generar lectura profunda'}
          </Text>
          {!analizandoMensual ? (
            <AppIcon name="arrowRight" size={18} color={colors.white} />
          ) : null}
        </TouchableOpacity>

        {analizandoMensual && (
          <ActivityIndicator
            size="small"
            color={colors.lavender}
            style={styles.analysisLoader}
          />
        )}

        {!!analisisMensual && (
          <View style={styles.analysisResult}>
            {!!monthlyAnalysisGeneratedAt && (
              <Text style={styles.analysisResultMeta}>
                Generado el {monthlyAnalysisGeneratedAt} con{' '}
                {monthlyAnalysisRecord?.analyzedDreamCount ||
                  suenosDisponiblesAnalisis.length}{' '}
                sueños.
              </Text>
            )}
            <Markdown style={markdownStyles}>{analisisMensual}</Markdown>
            <ReportAiContentButton
              content={analisisMensual}
              feature="monthly-analysis"
            />
          </View>
        )}
      </View>

      <View style={styles.patternSection}>
        <View style={styles.patternHeading}>
          <View style={styles.patternHeadingCopy}>
            <Text style={styles.eyebrow}>SEÑALES EMOCIONALES</Text>
            <Text style={styles.sectionTitle}>Lo que aparece con más frecuencia</Text>
          </View>
          <View style={styles.confidencePill}>
            <Text style={styles.confidenceText}>
              {cantidadSuenos < 5
                ? 'INDICIO'
                : cantidadSuenos < 10
                  ? 'EN FORMACIÓN'
                  : 'CONSISTENTE'}
            </Text>
          </View>
        </View>

        {selectedEmocion ? getLecturaEmocion() : getLecturaGeneral()}
        {renderEmotionBreakdown()}
      </View>

      {cantidadSuenos ? (
        <View style={styles.advancedSection}>
          <View style={styles.advancedToggle}>
            <View style={styles.advancedCopy}>
              <Text style={styles.advancedTitle}>Vista avanzada</Text>
              <Text style={styles.advancedText}>
                Comparar todas las emociones en el radar
              </Text>
            </View>
          </View>
          {renderRadarChart()}
        </View>
      ) : null}
    </ScrollView>
  );
}

const createMarkdownStyles = colors => ({
  body: { color: colors.ink, fontSize: 15, lineHeight: 23 },
  paragraph: { color: colors.ink, fontSize: 15, lineHeight: 23 },
  heading1: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  heading2: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  bullet_list: { color: colors.ink },
  ordered_list: { color: colors.ink },
  strong: { color: colors.ink, fontWeight: '800' },
});

const createStyles = colors => StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flexGrow: 1,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: screenPadding,
    paddingTop: spacing.lg,
  },
  eyebrow: { ...typography.eyebrow, color: colors.primary },
  title: { ...typography.title, color: colors.ink, marginTop: spacing.sm },
  subtitle: { ...typography.body, color: colors.muted, marginTop: spacing.sm },
  chartSection: { alignItems: 'center', marginTop: spacing.xl },
  chartNote: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.sm,
    maxWidth: 320,
    textAlign: 'center',
  },
  breakdownSection: { marginTop: spacing.xl },
  emotionRow: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    paddingVertical: spacing.md,
  },
  emotionRowSelected: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  emotionRowHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  emotionName: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  emotionPercent: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  emotionTrack: {
    backgroundColor: colors.line,
    borderRadius: 3,
    height: 6,
    overflow: 'hidden',
  },
  emotionFill: {
    backgroundColor: colors.primary,
    borderRadius: 3,
    height: '100%',
  },
  emotionEvidence: { color: colors.muted, fontSize: 11, marginTop: 7 },
  detailBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  detailLabel: { ...typography.eyebrow, color: colors.primary },
  detailText: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  bold: { color: colors.ink, fontWeight: '800' },
  analysisSection: {
    backgroundColor: colors.midnight,
    borderRadius: radii.lg,
    marginTop: spacing.xxl,
    padding: spacing.lg,
  },
  analysisHeading: { alignItems: 'center', flexDirection: 'row' },
  analysisIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    height: 44,
    justifyContent: 'center',
    marginRight: spacing.md,
    width: 44,
  },
  analysisHeadingCopy: { flex: 1 },
  sectionTitle: { ...typography.sectionTitle, color: colors.ink, marginTop: 5 },
  analysisTitle: { color: colors.white, marginTop: 0 },
  analysisMeta: { color: '#BCC4D2', fontSize: 12, marginTop: 3 },
  monthProgressTrack: {
    backgroundColor: '#303A4A',
    borderRadius: radii.pill,
    height: 7,
    marginTop: spacing.lg,
    overflow: 'hidden',
  },
  monthProgressFill: {
    backgroundColor: colors.lavender,
    borderRadius: radii.pill,
    height: '100%',
  },
  analysisHint: {
    color: '#D0D5DD',
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.md,
  },
  analysisButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 48,
  },
  analysisButtonDisabled: { opacity: 0.42 },
  analysisButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
    marginRight: spacing.sm,
  },
  analysisLoader: { alignSelf: 'center', marginTop: spacing.lg },
  analysisResult: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  analysisResultMeta: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: spacing.md,
  },
  patternSection: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    marginTop: spacing.xxxl,
    paddingTop: spacing.xxxl,
  },
  patternHeading: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  patternHeadingCopy: { flex: 1 },
  confidencePill: {
    backgroundColor: colors.successSoft,
    borderRadius: radii.pill,
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  confidenceText: { color: colors.success, fontSize: 9, fontWeight: '800' },
  advancedSection: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    marginTop: spacing.xxxl,
    paddingTop: spacing.lg,
  },
  advancedToggle: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 54,
  },
  advancedCopy: { flex: 1, marginRight: spacing.sm },
  advancedTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  advancedText: { color: colors.muted, fontSize: 11, marginTop: 3 },
});
