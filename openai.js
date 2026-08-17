import { createProtectedCallable } from './src/firebase/callable';
import { getInstallationId } from './src/services/installationId';

async function callFunction(name, payload) {
  const callable = createProtectedCallable(name, { timeout: 120000 });
  const installationId = await getInstallationId();
  const result = await callable({
    ...payload,
    installationId,
  });

  return result.data;
}

async function callTextFunction(name, payload) {
  const data = await callFunction(name, payload);
  const text = data?.text;

  if (typeof text !== 'string') {
    throw new Error(`La función ${name} no devolvió texto válido.`);
  }

  return text;
}

export const obtenerInterpretacionSueno = async (
  descripcion,
  contextoPerfil = '',
  contextoReciente = '',
  dreamSessionId = ''
) => {
  return callTextFunction('interpretDream', {
    descripcion,
    contextoPerfil,
    contextoReciente,
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

export const obtenerResumenInterpretacion = async (
  interpretacionCompleta,
  dreamSessionId = ''
) => {
  return callTextFunction('summarizeInterpretation', {
    interpretacionCompleta,
    dreamSessionId,
  });
};

export const obtenerEmocionesDesdeContexto = async (
  descripcion,
  contextoPerfil,
  dreamSessionId = ''
) => {
  const data = await callFunction('extractDreamEmotions', {
    descripcion,
    contextoPerfil,
    dreamSessionId,
  });
  const emociones = data?.emociones;

  return Array.isArray(emociones) ? emociones : [];
};

export const obtenerPatronEmocional = async (suenos, periodo = '') => {
  const data = await callFunction('findEmotionalPattern', { suenos, periodo });

  if (typeof data?.text !== 'string') {
    throw new Error('La función findEmotionalPattern no devolvió texto válido.');
  }

  return data;
};
