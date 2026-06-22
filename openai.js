import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './src/firebase/config';

const REGION = 'europe-west1';
const functions = getFunctions(app, REGION);

async function callTextFunction(name, payload) {
  const callable = httpsCallable(functions, name, { timeout: 120000 });
  const result = await callable(payload);
  const text = result.data?.text;

  if (typeof text !== 'string') {
    throw new Error(`La función ${name} no devolvió texto válido.`);
  }

  return text;
}

export const obtenerInterpretacionSueno = async (
  descripcion,
  contextoPerfil = '',
  dreamSessionId = ''
) => {
  return callTextFunction('interpretDream', {
    descripcion,
    contextoPerfil,
    dreamSessionId,
  });
};

export const obtenerRespuestaChat = async (
  mensajeUsuario,
  contextoPerfil = '',
  contextoConversacion = '',
  dreamSessionId = ''
) => {
  return callTextFunction('continueDreamChat', {
    mensajeUsuario,
    contextoPerfil,
    contextoConversacion,
    dreamSessionId,
  });
};

export const obtenerResumenInterpretacion = async (interpretacionCompleta) => {
  return callTextFunction('summarizeInterpretation', { interpretacionCompleta });
};

export const obtenerEmocionesDesdeContexto = async (descripcion, contextoPerfil) => {
  const callable = httpsCallable(functions, 'extractDreamEmotions', { timeout: 120000 });
  const result = await callable({ descripcion, contextoPerfil });
  const emociones = result.data?.emociones;

  return Array.isArray(emociones) ? emociones : [];
};

export const obtenerPatronEmocional = async (suenos, periodo = '') => {
  return callTextFunction('findEmotionalPattern', { suenos, periodo });
};
