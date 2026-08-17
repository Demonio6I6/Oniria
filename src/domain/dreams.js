export const getDreamTimestamp = (dream) => dream?.createdAt || dream?.timestamp || 0;

export const getDreamSummary = (dream) =>
  dream?.summary || dream?.description || 'Sueño sin título';

export const getDreamInterpretation = (dream) =>
  dream?.fullInterpretation || dream?.interpretation || '';

export const buildFullDreamInterpretation = ({
  initialInterpretation = '',
  followUpQuestion = '',
  followUpAnswer = '',
}) => {
  const sections = [initialInterpretation.trim()].filter(Boolean);

  if (followUpQuestion || followUpAnswer) {
    sections.push([
      '## Profundización',
      followUpQuestion ? `**Consulta:** ${followUpQuestion.trim()}` : '',
      followUpAnswer?.trim() || '',
    ].filter(Boolean).join('\n\n'));
  }

  return sections.join('\n\n');
};

export const buildDreamConversation = ({
  description = '',
  initialInterpretation = '',
  followUpQuestion = '',
  followUpAnswer = '',
}) => [
  { role: 'user', text: description },
  { role: 'assistant', text: initialInterpretation },
  ...(followUpQuestion ? [{ role: 'user', text: followUpQuestion }] : []),
  ...(followUpAnswer ? [{ role: 'assistant', text: followUpAnswer }] : []),
].filter(message => message.text);

export const getDreamId = (dream) =>
  dream?.id || `${getDreamTimestamp(dream)}_${getDreamSummary(dream)}`;

export const createDreamId = (timestamp) =>
  `${timestamp}_${Math.random().toString(36).slice(2, 10)}`;

export const formatDateKey = (timestamp) =>
  new Date(timestamp).toISOString().split('T')[0];

export const createFallbackSummary = (description) => {
  const cleanDescription = description.trim().replace(/\s+/g, ' ');
  return cleanDescription.length > 80
    ? `${cleanDescription.slice(0, 77)}...`
    : cleanDescription;
};

export const normalizeDreamEmotions = (emocionesDetectadas) =>
  Array.isArray(emocionesDetectadas)
    ? emocionesDetectadas
      .map(emocion => String(emocion).trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 5)
    : [];

export const sortDreamsByNewest = (dreams) =>
  [...dreams].sort((a, b) => getDreamTimestamp(b) - getDreamTimestamp(a));

const truncateText = (text, maxLength) => {
  const normalized = String(text || '').trim().replace(/\s+/g, ' ');

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 3)}...`
    : normalized;
};

export const RECENT_DREAM_CONTEXT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const getPreviousRecentDream = (
  dreams,
  {
    currentDreamId = '',
    currentTimestamp = Date.now(),
    maxAgeMs = RECENT_DREAM_CONTEXT_WINDOW_MS,
  } = {}
) => {
  const referenceTimestamp = Number(currentTimestamp) || Date.now();

  return sortDreamsByNewest(dreams).find(dream => {
    const dreamTimestamp = Number(getDreamTimestamp(dream));
    const dreamId = getDreamId(dream);
    const ageMs = referenceTimestamp - dreamTimestamp;

    return dreamId !== currentDreamId &&
      Number.isFinite(dreamTimestamp) &&
      ageMs >= 0 &&
      ageMs <= maxAgeMs;
  }) || null;
};

export const buildPreviousDreamContext = dream => {
  if (!dream) return '';

  const timestamp = getDreamTimestamp(dream);
  const description = dream?.description || getDreamSummary(dream);

  return [
    'Contexto del sueño anterior reciente aportado por el usuario:',
    timestamp ? `Fecha: ${formatDateKey(timestamp)}` : '',
    description
      ? `Sueño contado: ${truncateText(description, 650)}`
      : '',
    dream?.wakingEmotion
      ? `Emoción indicada al despertar: ${dream.wakingEmotion}`
      : '',
    dream?.wakingContext
      ? `Asociación con su vida: ${truncateText(dream.wakingContext, 350)}`
      : '',
    dream?.personalReflection
      ? `Reflexión personal posterior: ${truncateText(dream.personalReflection, 350)}`
      : '',
  ].filter(Boolean).join('\n');
};

export const buildDreamAnalysisText = (dream) => {
  const timestamp = getDreamTimestamp(dream);
  const date = timestamp ? formatDateKey(timestamp) : 'sin fecha';
  const emotions = Array.isArray(dream?.emotions) ? dream.emotions : [];

  return [
    `Fecha: ${date}`,
    `Resumen: ${truncateText(getDreamSummary(dream), 180)}`,
    dream?.description
      ? `Sueno contado: ${truncateText(dream.description, 700)}`
      : '',
    dream?.wakingEmotion
      ? `Emocion indicada al despertar: ${dream.wakingEmotion}`
      : '',
    dream?.wakingContext
      ? `Asociacion personal: ${truncateText(dream.wakingContext, 400)}`
      : '',
    emotions.length ? `Emociones detectadas: ${emotions.join(', ')}` : '',
    dream?.resonance ? `Valoracion de la lectura: ${dream.resonance}` : '',
    dream?.personalReflection
      ? `Reflexion personal: ${truncateText(dream.personalReflection, 500)}`
      : '',
  ].filter(Boolean).join('\n');
};

export const buildDreamCalendarData = (dreams) => {
  const markedDates = {};
  const dreamsByDate = {};

  dreams.forEach(dream => {
    const dateStr = formatDateKey(getDreamTimestamp(dream));
    markedDates[dateStr] = { marked: true, dotColor: '#2e86de' };
    if (!dreamsByDate[dateStr]) dreamsByDate[dateStr] = [];
    dreamsByDate[dateStr].push(dream);
  });

  return { markedDates, dreamsByDate };
};
