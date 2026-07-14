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
  buildEmotionChartData,
  buildEmotionRecordsFromDreams,
  mergeEmotionRecords,
} from '../domain/emotions';
import {
  buildDreamAnalysisText,
  getDreamTimestamp,
} from '../domain/dreams';
import { loadSavedDreams } from '../services/dreamRepository';
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

const MAX_DREAMS_PER_ANALYSIS = 45;
const MIN_DREAMS_PER_MONTHLY_ANALYSIS = 10;
const MONTHLY_ANALYSIS_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const RADAR_MAX_VALUE = 100;
const RADAR_MAX_SIZE = 320;
const RADAR_MIN_SIZE = 240;
const EMOTION_LIST_LIMIT = 5;

const formatPercent = (value) => `${Math.round(Number(value) || 0)}%`;

const formatEmotionLabel = (label) =>
  String(label || '').charAt(0).toUpperCase() + String(label || '').slice(1);

const sortEmotionData = (a, b) =>
  b.value - a.value ||
  (b.count || 0) - (a.count || 0) ||
  a.label.localeCompare(b.label, 'es');

const getCurrentMonthPeriod = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const label = now.toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  });

  return { start, end, key, label };
};

const getFunctionErrorCode = (error) =>
  String(error?.code || '').replace(/^functions\//, '');

const getFunctionErrorDetails = (error) =>
  error?.details || error?.customData?.details || {};

const formatRetryAt = (retryAt) => {
  if (!retryAt) return '';

  const date = new Date(retryAt);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString([], {
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
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

const buildMonthlyAnalysisErrorMessage = (error, dreamCount) => {
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
      details.requiredDreams || MIN_DREAMS_PER_MONTHLY_ANALYSIS;
    const currentDreams = details.currentDreams || dreamCount;
    const missingDreams = Math.max(requiredDreams - currentDreams, 0);

    return `Necesitas ${requiredDreams} suenos este mes. Te faltan ${missingDreams}.`;
  }

  if (code === 'resource-exhausted') {
    if (details.reason === 'premium-required') {
      return 'El analisis mensual requiere Lunentra Premium.';
    }

    if (details.reason === 'monthly-analysis-in-progress') {
      return 'Ya hay un analisis mensual en curso. Espera un momento antes de intentarlo otra vez.';
    }

    const retryAt = details.retryAt || details.retryAtMillis;
    const formattedRetryAt = formatRetryAt(retryAt);

    return formattedRetryAt
      ? `Ya generaste tu analisis mensual. Podras pedir otro a partir de ${formattedRetryAt}.`
      : 'Ya generaste tu analisis mensual. Podras pedir otro mas adelante.';
  }

  return 'No se pudo generar el analisis mensual en este momento.';
};

const confirmarPrivacidadIA = async () => {
  if (await hasAcceptedMonthlyAnalysisPrivacyNotice()) return true;

  return new Promise(resolve => {
    Alert.alert(
      'Privacidad del analisis',
      'Para generar este analisis se enviaran tus suenos guardados del mes y sus interpretaciones a nuestro servidor y al proveedor de IA. No se usa como diagnostico clinico.',
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
  const { width } = useWindowDimensions();
  const [data, setData] = useState([]);
  const [selectedEmocion, setSelectedEmocion] = useState(null);
  const [cantidadSuenos, setCantidadSuenos] = useState(0);
  const [suenos, setSuenos] = useState([]);
  const [analisisMensual, setAnalisisMensual] = useState('');
  const [monthlyAnalysisRecord, setMonthlyAnalysisRecord] = useState(null);
  const [analizandoMensual, setAnalizandoMensual] = useState(false);
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
        const dreamRecords = buildEmotionRecordsFromDreams(suenosGuardados);
        const registros = mergeEmotionRecords(legacyRecords, dreamRecords);
        const chart = buildEmotionChartData(registros);
        const currentPeriodKey = getCurrentMonthPeriod().key;
        const cachedAnalysisIsCurrent =
          cachedMonthlyAnalysis?.periodKey === currentPeriodKey &&
          typeof cachedMonthlyAnalysis?.text === 'string';

        setData(chart.chartData);
        setCantidadSuenos(chart.totalDreams);
        setSuenos(suenosGuardados);
        setMonthlyAnalysisRecord(cachedMonthlyAnalysis || null);
        setAnalisisMensual(
          cachedAnalysisIsCurrent ? cachedMonthlyAnalysis.text : ''
        );
      } catch (error) {
        console.error('Error al cargar datos emocionales:', error);
      }
    };

    cargarDatos();
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
            stroke: '#333',
            fontWeight: '600',
          }}
          gridConfig={{
            stroke: '#ddd',
            strokeWidth: 1,
            fill: '#fff',
            opacity: 0.12,
          }}
          asterLinesConfig={{
            stroke: '#e6e6e6',
            strokeWidth: 1,
          }}
          polygonConfig={{
            stroke: '#111',
            strokeWidth: 2,
            fill: '#111',
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

  const getCurrentMonthDreams = () => {
    const { start, end } = getCurrentMonthPeriod();

    return suenos.filter(sueno => {
      const timestamp = getDreamTimestamp(sueno);
      return timestamp >= start.getTime() && timestamp < end.getTime();
    });
  };

  const generarAnalisisMensual = async () => {
    if (analizandoMensual) return;

    if (subscription.isGuest) {
      subscription.showPaywall('monthly-analysis-account');
      return;
    }

    if (!subscription.isPremium) {
      subscription.showPaywall('monthly-analysis');
      return;
    }

    const { key, label } = getCurrentMonthPeriod();
    const suenosDelMes = getCurrentMonthDreams();

    if (suenosDelMes.length < MIN_DREAMS_PER_MONTHLY_ANALYSIS) {
      const suenosFaltantes =
        MIN_DREAMS_PER_MONTHLY_ANALYSIS - suenosDelMes.length;

      Alert.alert(
        'Aún no hay suficientes sueños',
        `Necesitas ${MIN_DREAMS_PER_MONTHLY_ANALYSIS} sueños este mes. ` +
          `Te faltan ${suenosFaltantes}.`
      );
      return;
    }

    const nextAvailableAt = monthlyAnalysisRecord?.nextAvailableAt || 0;
    if (nextAvailableAt > Date.now()) {
      Alert.alert(
        'Análisis mensual ya generado',
        `Podrás pedir otro a partir de ${formatRetryAt(nextAvailableAt)}.`
      );
      return;
    }

    const privacidadAceptada = await confirmarPrivacidadIA();
    if (!privacidadAceptada) return;

    setAnalizandoMensual(true);

    try {
      const suenosParaAnalisis = suenosDelMes
        .slice(0, MAX_DREAMS_PER_ANALYSIS)
        .sort((a, b) => getDreamTimestamp(a) - getDreamTimestamp(b))
        .map(buildDreamAnalysisText);

      const respuesta = await obtenerPatronEmocional(
        suenosParaAnalisis,
        `Mes actual: ${label}`
      );

      const createdAt = Date.now();
      const analysisRecord = {
        text: respuesta,
        periodKey: key,
        periodLabel: label,
        dreamCount: suenosDelMes.length,
        analyzedDreamCount: suenosParaAnalisis.length,
        createdAt,
        nextAvailableAt: createdAt + MONTHLY_ANALYSIS_COOLDOWN_MS,
      };

      setMonthlyAnalysisRecord(analysisRecord);
      setAnalisisMensual(respuesta);
      saveMonthlyAnalysis(analysisRecord).catch(storageError => {
        console.error('Error guardando análisis mensual:', storageError);
      });
    } catch (error) {
      console.error('Error generando análisis mensual:', error);
      const details = getFunctionErrorDetails(error);

      if (details.reason === 'account-required') {
        subscription.showPaywall('monthly-analysis-account');
      } else if (details.reason === 'premium-required') {
        subscription.showPaywall('monthly-analysis');
      }

      Alert.alert(
        'Análisis no disponible',
        buildMonthlyAnalysisErrorMessage(error, suenosDelMes.length)
      );
    } finally {
      setAnalizandoMensual(false);
    }
  };

  const suenosMesActual = getCurrentMonthDreams();
  const currentPeriod = getCurrentMonthPeriod();
  const suenosFaltantesAnalisis = Math.max(
    MIN_DREAMS_PER_MONTHLY_ANALYSIS - suenosMesActual.length,
    0
  );
  const hasMinimumMonthlyDreams =
    suenosMesActual.length >= MIN_DREAMS_PER_MONTHLY_ANALYSIS;
  const currentMonthlyAnalysisIsCached =
    monthlyAnalysisRecord?.periodKey === currentPeriod.key;
  const monthlyAnalysisNextAvailableAt =
    monthlyAnalysisRecord?.nextAvailableAt || 0;
  const monthlyAnalysisOnCooldown =
    monthlyAnalysisNextAvailableAt > Date.now();
  const monthlyAnalysisButtonDisabled =
    analizandoMensual || !hasMinimumMonthlyDreams || monthlyAnalysisOnCooldown;
  const monthlyAnalysisGeneratedAt =
    currentMonthlyAnalysisIsCached
      ? formatAnalysisDate(monthlyAnalysisRecord?.createdAt)
      : '';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>PATRONES PERSONALES</Text>
      <Text style={styles.title}>Lo que se repite en tus sueños</Text>
      <Text style={styles.subtitle}>
        Señales orientativas basadas en {cantidadSuenos} sueños. Puedes revisar la
        evidencia y decidir qué tiene sentido para ti.
      </Text>

      {renderRadarChart()}
      {renderEmotionBreakdown()}

      {selectedEmocion ? getLecturaEmocion() : getLecturaGeneral()}

      <View style={styles.analysisSection}>
        <Text style={styles.sectionTitle}>Lectura profunda del mes</Text>
        <Text style={styles.analysisMeta}>
          {`Sueños este mes: ${suenosMesActual.length}/${MIN_DREAMS_PER_MONTHLY_ANALYSIS}`}
        </Text>
        {!hasMinimumMonthlyDreams && (
          <Text style={styles.analysisHint}>
            Guarda {suenosFaltantesAnalisis} sueños más este mes para activar
            esta lectura.
          </Text>
        )}
        {hasMinimumMonthlyDreams && !subscription.isPremium && (
          <Text style={styles.analysisHint}>
            Premium desbloquea una lectura profunda de los cambios, repeticiones
            y preguntas abiertas del mes.
          </Text>
        )}
        {monthlyAnalysisOnCooldown && (
          <Text style={styles.analysisHint}>
            Disponible de nuevo a partir de{' '}
            {formatRetryAt(monthlyAnalysisNextAvailableAt)}.
          </Text>
        )}
        <TouchableOpacity
          style={[
            styles.analysisButton,
            monthlyAnalysisButtonDisabled && styles.analysisButtonDisabled,
          ]}
          onPress={generarAnalisisMensual}
          disabled={monthlyAnalysisButtonDisabled}
        >
          <Text style={styles.analysisButtonText}>
            {analizandoMensual ? 'Analizando...' : 'Explorar patrones del mes'}
          </Text>
        </TouchableOpacity>

        {analizandoMensual && (
          <ActivityIndicator
            size="small"
            color="#000"
            style={styles.analysisLoader}
          />
        )}

        {!!analisisMensual && (
          <View style={styles.analysisResult}>
            {!!monthlyAnalysisGeneratedAt && (
              <Text style={styles.analysisResultMeta}>
                Generado el {monthlyAnalysisGeneratedAt} con{' '}
                {monthlyAnalysisRecord?.dreamCount || suenosMesActual.length}{' '}
                sueños.
              </Text>
            )}
            <Markdown>{analisisMensual}</Markdown>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
    flexGrow: 1,
  },
  eyebrow: {
    color: '#6366F1',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 7,
  },
  title: {
    color: '#111827',
    fontSize: 27,
    fontWeight: '800',
    lineHeight: 33,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
    color: '#666',
  },
  chartSection: {
    alignItems: 'center',
    marginBottom: 18,
  },
  chartNote: {
    maxWidth: 320,
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    color: '#666',
    textAlign: 'center',
  },
  breakdownSection: {
    marginTop: 4,
  },
  emotionRow: {
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  emotionRowSelected: {
    borderColor: '#111',
    backgroundColor: '#f6f6f6',
  },
  emotionRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  emotionName: {
    fontSize: 15,
    color: '#222',
    fontWeight: '600',
  },
  emotionPercent: {
    fontSize: 15,
    color: '#111',
    fontWeight: '700',
  },
  emotionTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ededed',
    overflow: 'hidden',
  },
  emotionFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#111',
  },
  emotionEvidence: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 7,
  },
  detailBox: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 18,
    padding: 15,
  },
  detailLabel: {
    color: '#6366F1',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  detailText: {
    marginTop: 8,
    fontSize: 16,
    color: '#444',
    textAlign: 'left',
    lineHeight: 22,
  },
  bold: {
    fontWeight: 'bold',
    color: '#000',
  },
  analysisSection: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    marginTop: 28,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 6,
  },
  analysisMeta: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  analysisHint: {
    color: '#666',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  analysisButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#000',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  analysisButtonDisabled: {
    backgroundColor: '#999',
  },
  analysisButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  analysisLoader: {
    marginTop: 16,
    alignSelf: 'flex-start',
  },
  analysisResult: {
    marginTop: 18,
  },
  analysisResultMeta: {
    color: '#666',
    fontSize: 13,
    marginBottom: 10,
  },
});
