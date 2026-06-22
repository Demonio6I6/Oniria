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

const EMOTION_ALIASES = {
  alegria: 'alegría',
  felicidad: 'alegría',
  temor: 'miedo',
  ansiedad: 'miedo',
  angustia: 'miedo',
  enojo: 'ira',
  rabia: 'ira',
  enfado: 'ira',
  sorpresa: 'sorpresa',
  culpa: 'culpa',
  esperanza: 'esperanza',
  tristeza: 'tristeza',
  miedo: 'miedo',
  ira: 'ira',
};

const stripAccents = (value) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const normalizeEmotion = (emocion) => {
  const normalized = String(emocion || '').trim().toLowerCase();
  if (!normalized) return '';

  return EMOTION_ALIASES[stripAccents(normalized)] || normalized;
};

const getRecordEmotions = (record) => {
  if (Array.isArray(record?.emociones)) return record.emociones;
  if (Array.isArray(record?.emotions)) return record.emotions;
  return [];
};

export const buildEmotionRecordsFromDreams = (suenos) =>
  (Array.isArray(suenos) ? suenos : [])
    .filter(sueno => Array.isArray(sueno.emotions) && sueno.emotions.length > 0)
    .map(sueno => ({
      dreamId: sueno.id,
      emociones: sueno.emotions,
      timestamp: getDreamTimestamp(sueno),
      source: 'dream_record_v2',
    }));

export const mergeEmotionRecords = (legacyRecords, dreamRecords) => {
  const recordsByKey = new Map();

  [
    ...(Array.isArray(legacyRecords) ? legacyRecords : []),
    ...(Array.isArray(dreamRecords) ? dreamRecords : []),
  ].forEach((record, index) => {
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

  let totalDreams = 0;

  (Array.isArray(records) ? records : []).forEach(record => {
    const emocionesUnicas = new Set();

    getRecordEmotions(record).forEach(emocionValue => {
      const emocion = normalizeEmotion(emocionValue);
      if (Object.prototype.hasOwnProperty.call(conteo, emocion)) {
        emocionesUnicas.add(emocion);
      }
    });

    if (!emocionesUnicas.size) return;

    totalDreams += 1;
    emocionesUnicas.forEach(emocion => {
      conteo[emocion] += 1;
    });
  });

  const chartData = FIXED_EMOTIONS.map(emocion => {
    const porcentaje = Math.round((conteo[emocion] / totalDreams) * 100) || 0;
    const grayValue = 255 - Math.round(porcentaje * 2.55);

    return {
      label: emocion,
      value: porcentaje,
      count: conteo[emocion],
      frontColor: `rgb(${grayValue},${grayValue},${grayValue})`,
    };
  });

  return { chartData, totalDreams };
};
