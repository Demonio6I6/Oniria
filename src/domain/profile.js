export const PROFILE_QUESTIONS = [
  {
    key: 'pregunta1',
    pregunta: '¿Cómo te has estado sintiendo últimamente?',
  },
  {
    key: 'pregunta2',
    pregunta: '¿Hay algo que te está causando mucho estrés o ansiedad en este momento?',
  },
  {
    key: 'pregunta3',
    pregunta: '¿Cómo manejas los momentos de tristeza y frustración?',
  },
  {
    key: 'pregunta4',
    pregunta: '¿Qué momentos del día te hacen sentir más equilibrado/a o en paz?',
  },
  {
    key: 'pregunta5',
    pregunta: '¿Te resulta fácil o difícil compartir tus emociones con otras personas? ¿Por qué?',
  },
  {
    key: 'pregunta6',
    pregunta: '¿Cómo te sientes acerca de la relación con tus amigos y familiares?',
  },
  {
    key: 'pregunta7',
    pregunta: '¿Hay algo en tu historia o pasado que te gustaría compartir o que crees que podría estar afectando cómo te sientes ahora?',
  },
];

export const createEmptyProfileResponses = () =>
  PROFILE_QUESTIONS.reduce((responses, { key }) => ({
    ...responses,
    [key]: '',
  }), {});

export const buildProfileSnapshot = (respuestas = {}) =>
  PROFILE_QUESTIONS
    .map(({ pregunta, key }) => ({
      key,
      pregunta,
      respuesta: respuestas[key]?.trim() || '',
    }))
    .filter(item => item.respuesta);

export const buildProfileContext = (profileSnapshot) => {
  if (!profileSnapshot.length) return '';

  return [
    'Contexto del perfil:',
    ...profileSnapshot.map((item, index) =>
      `Pregunta ${index + 1}: ${item.pregunta}\nRespuesta: ${item.respuesta}`
    ),
  ].join('\n');
};
