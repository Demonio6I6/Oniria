import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

const MAX_DREAMS_PER_ANALYSIS = 45;
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
  const label = now.toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  });

  return { start, end, label };
};

export default function DiagramaEmocional() {
  const { width } = useWindowDimensions();
  const [data, setData] = useState([]);
  const [selectedEmocion, setSelectedEmocion] = useState(null);
  const [cantidadSuenos, setCantidadSuenos] = useState(0);
  const [suenos, setSuenos] = useState([]);
  const [analisisMensual, setAnalisisMensual] = useState('');
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
        const [legacyRecords, suenosGuardados] = await Promise.all([
          loadEmotionRecords(),
          loadSavedDreams(),
        ]);
        const dreamRecords = buildEmotionRecordsFromDreams(suenosGuardados);
        const registros = mergeEmotionRecords(legacyRecords, dreamRecords);
        const chart = buildEmotionChartData(registros);

        setData(chart.chartData);
        setCantidadSuenos(chart.totalDreams);
        setSuenos(suenosGuardados);
      } catch (error) {
        console.error('Error al cargar datos emocionales:', error);
      }
    };

    cargarDatos();
  }, []);

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
      <Text style={styles.detailText}>
        En tus últimos {cantidadSuenos} sueños con emociones reconocidas destaca{' '}
        <Text style={styles.bold}>{principal.label}</Text> con{' '}
        {formatPercent(principal.value)}.{' '}
        {secundariasText
          ? `También aparecen ${secundariasText}.`
          : 'Por ahora no hay otra emoción con presencia clara.'}
      </Text>
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

    const { label } = getCurrentMonthPeriod();
    const suenosDelMes = getCurrentMonthDreams();

    if (!suenosDelMes.length) {
      Alert.alert(
        'Sin sueños este mes',
        'No hay sueños guardados en el mes actual.'
      );
      return;
    }

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

      setAnalisisMensual(respuesta);
    } catch (error) {
      console.error('Error generando análisis mensual:', error);
      Alert.alert(
        'Error',
        'No se pudo generar el análisis mensual en este momento.'
      );
    } finally {
      setAnalizandoMensual(false);
    }
  };

  const suenosMesActual = getCurrentMonthDreams();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Tu Lectura Emocional</Text>
      <Text style={styles.subtitle}>Sueños analizados: {cantidadSuenos}</Text>

      {renderRadarChart()}
      {renderEmotionBreakdown()}

      {selectedEmocion ? getLecturaEmocion() : getLecturaGeneral()}

      <View style={styles.analysisSection}>
        <Text style={styles.sectionTitle}>Análisis mensual</Text>
        <Text style={styles.analysisMeta}>
          Sueños este mes: {suenosMesActual.length}
        </Text>
        <TouchableOpacity
          style={[
            styles.analysisButton,
            analizandoMensual && styles.analysisButtonDisabled,
          ]}
          onPress={generarAnalisisMensual}
          disabled={analizandoMensual}
        >
          <Text style={styles.analysisButtonText}>Analizar mes actual</Text>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
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
  detailText: {
    marginTop: 20,
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
    marginBottom: 14,
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
});
