import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
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
  const [data, setData] = useState([]);
  const [selectedEmocion, setSelectedEmocion] = useState(null);
  const [cantidadSuenos, setCantidadSuenos] = useState(0);
  const [suenos, setSuenos] = useState([]);
  const [analisisMensual, setAnalisisMensual] = useState('');
  const [analizandoMensual, setAnalizandoMensual] = useState(false);

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

  const renderBarChart = () => (
    <BarChart
      data={data}
      barWidth={40}
      spacing={24}
      roundedTop
      roundedBottom
      hideRules
      yAxisTextStyle={{ color: '#333' }}
      xAxisLabelTextStyle={{ color: '#333', fontSize: 12, flexWrap: 'wrap' }}
      xAxisThickness={1}
      xAxisColor="#ccc"
      maxValue={100}
      onPress={item => setSelectedEmocion(item.label)}
      yAxisLabelTexts={['0%', '20%', '40%', '60%', '80%', '100%']}
    />
  );

  const getLecturaGeneral = () => {
    if (!cantidadSuenos) {
      return (
        <Text style={styles.detailText}>
          Aún no hay suficientes sueños registrados para leer un patrón.
        </Text>
      );
    }

    const ordenadas = [...data].sort((a, b) => b.value - a.value);
    return (
      <Text style={styles.detailText}>
        En tus últimos {cantidadSuenos} sueños registrados aparece con más
        frecuencia <Text style={styles.bold}>{ordenadas[0].label}</Text> con{' '}
        {ordenadas[0].value}%.{' '}
        {ordenadas.slice(1).map((emocion, index) => {
          const intro =
            index === ordenadas.length - 2
              ? ' y con menor presencia aparece '
              : index === 0
                ? 'También aparece '
                : ' después aparece ';

          return `${intro}${emocion.label} con ${emocion.value}%`;
        }).join(', ')}
        .
      </Text>
    );
  };

  const getLecturaEmocion = () => {
    if (!cantidadSuenos) return getLecturaGeneral();

    const emocion = data.find(item => item.label === selectedEmocion);
    if (!emocion) return null;

    let mensaje =
      `En esta lectura orientativa, ${emocion.label} aparece en el ` +
      `${emocion.value}% de tus sueños registrados. `;

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
      <Text style={styles.subtitle}>Sueños registrados: {cantidadSuenos}</Text>

      {renderBarChart()}

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
