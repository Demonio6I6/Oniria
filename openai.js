import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './src/firebase/config';
import { getInstallationId } from './src/services/installationId';

const REGION = 'europe-west1';
const functions = getFunctions(app, REGION);

async function callTextFunction(name, payload) {
  const callable = httpsCallable(functions, name, { timeout: 120000 });
  const installationId = await getInstallationId();
  const result = await callable({ ...payload, installationId });
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
  const callable = httpsCallable(
    functions,
    'extractDreamEmotions',
    { timeout: 120000 }
  );
  const installationId = await getInstallationId();
  const result = await callable({
    descripcion,
    contextoPerfil,
    dreamSessionId,
    installationId,
  });
  const emociones = result.data?.emociones;

  return Array.isArray(emociones) ? emociones : [];
};

export const obtenerPatronEmocional = async (suenos, periodo = '') => {
  return callTextFunction('findEmotionalPattern', { suenos, periodo });
};
