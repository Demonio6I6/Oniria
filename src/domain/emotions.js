import { getDreamTimestamp } from './dreams';

export const FIXED_EMOTIONS = [
  'miedo',
  'tristeza',
  'alegría',
  'ira',
  'sorpresa',
  'culpa',
  'esperanza',
];

export const normalizeEmotion = (emocion) =>
  String(emocion || '').trim().toLowerCase();

export const buildEmotionRecordsFromDreams = (suenos) =>
  suenos
    .filter(sueno => Array.isArray(sueno.emotions) && sueno.emotions.length > 0)
    .map(sueno => ({
      dreamId: sueno.id,
      emociones: sueno.emotions,
      timestamp: getDreamTimestamp(sueno),
      source: 'dream_record_v2',
    }));

export const mergeEmotionRecords = (legacyRecords, dreamRecords) => {
  const recordsByKey = new Map();

  [...legacyRecords, ...dreamRecords].forEach((record, index) => {
    const key = record.dreamId || `legacy_${record.timestamp || index}`;
    recordsByKey.set(key, record);
  });

  return Array.from(recordsByKey.values());
};

export const buildEmotionChartData = (records) => {
  const conteo = {};
  FIXED_EMOTIONS.forEach(emocion => {
    conteo[emocion] = 0;
  });

  records.forEach(({ emociones }) => {
    if (!Array.isArray(emociones)) return;

    emociones.forEach(emocionValue => {
      const emocion = normalizeEmotion(emocionValue);
      if (conteo[emocion] !== undefined) {
        conteo[emocion] += 1;
      }
    });
  });

  const totalDreams = records.length;
  const chartData = FIXED_EMOTIONS.map(emocion => {
    const porcentaje = Math.round((conteo[emocion] / totalDreams) * 100) || 0;
    const grayValue = 255 - Math.round(porcentaje * 2.55);

    return {
      label: emocion,
      value: porcentaje,
      frontColor: `rgb(${grayValue},${grayValue},${grayValue})`,
    };
  });

  return { chartData, totalDreams };
};
