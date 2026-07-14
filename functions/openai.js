/* eslint-disable require-jsdoc */
const axios = require("axios");

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MODEL_DEEP = process.env.OPENAI_MODEL_DEEP || "gpt-5.5";
const MODEL_FAST = process.env.OPENAI_MODEL_FAST || "gpt-5.4-mini";
const REASONING_LOW = "low";
const REASONING_NONE = "none";
const OUTPUT_LIMITS = {
  dreamInterpretation: 1200,
  dreamFollowUp: 700,
  interpretationSummary: 80,
  dreamEmotions: 120,
  monthlyPattern: 1600,
  dailyReflection: 80,
};

const DREAM_CONSULTANT_PROMPT = `
Eres un acompanante onirico empatico y prudente. Ayudas al usuario a explorar
posibles significados de sus suenos, emociones y patrones personales como una
lectura orientativa, no como diagnostico clinico, terapia ni sustituto de un
profesional de salud mental.

Prioriza el contexto personal del usuario por encima de simbolos universales.
Si no hay contexto de perfil suficiente, no lo inventes: trabaja solo con el
sueno contado y dilo con naturalidad cuando sea relevante. Presenta varias
hipotesis posibles cuando corresponda, separa observaciones de inferencias,
indica limites de certeza y evita afirmaciones absolutas.

El usuario es la principal autoridad sobre su propia experiencia. Si ha
indicado una emocion al despertar, una asociacion con su vida o una reflexion
personal, dales mas peso que a cualquier simbolismo general. Invita a conservar
solo lo que le resulte util y a descartar lo que no le represente.

Si el usuario expresa riesgo de hacerse dano, hacer dano a otra persona o una
crisis grave, prioriza su seguridad. Recomienda contactar ahora con una persona
de confianza, llamar al 112 ante emergencia inmediata y, si esta en Espana,
usar la Linea 024 de atencion a la conducta suicida.

Usa Markdown para estructurar la respuesta con claridad.
`.trim();

function assertApiKey(apiKey) {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no esta configurada.");
  }
}

function extractResponseText(responseData) {
  if (typeof responseData.output_text === "string") {
    return responseData.output_text.trim();
  }

  const parts = [];
  const output = Array.isArray(responseData.output) ? responseData.output : [];

  output.forEach((item) => {
    const content = Array.isArray(item.content) ? item.content : [];
    content.forEach((contentItem) => {
      if (
        contentItem &&
        contentItem.type === "output_text" &&
        typeof contentItem.text === "string"
      ) {
        parts.push(contentItem.text);
      }
    });
  });

  const text = parts.join("").trim();
  if (!text) {
    throw new Error("La respuesta de OpenAI no contiene texto utilizable.");
  }

  return text;
}

async function createTextResponse(apiKey, {
  model = MODEL_DEEP,
  instructions = DREAM_CONSULTANT_PROMPT,
  input,
  maxOutputTokens,
  reasoningEffort,
}) {
  assertApiKey(apiKey);

  const payload = {
    model,
    instructions,
    input,
  };

  if (maxOutputTokens) {
    payload.max_output_tokens = maxOutputTokens;
  }

  if (reasoningEffort) {
    payload.reasoning = {effort: reasoningEffort};
  }

  const response = await axios.post(
      OPENAI_RESPONSES_URL,
      payload,
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 115000,
      },
  );

  return extractResponseText(response.data);
}

async function obtenerInterpretacionSueno(
    apiKey,
    descripcion,
    contextoPerfil = "",
) {
  return createTextResponse(apiKey, {
    model: MODEL_DEEP,
    reasoningEffort: REASONING_LOW,
    input:
      `Explora este sueno como una lectura orientativa.\n\n` +
      `Sueno:\n${descripcion}\n\n` +
      `${contextoPerfil}\n\n` +
      `Devuelve una respuesta clara con estas secciones:\n` +
      `## Lo que observamos\n` +
      `## Posibles lecturas\n` +
      `## Emociones posibles\n` +
      `## Simbolos o escenas relevantes\n` +
      `## Relacion con tu momento personal\n` +
      `## Preguntas para reflexionar\n\n` +
      `No afirmes que el sueno significa una sola cosa. Si falta contexto ` +
      `personal, indicalo brevemente. Cierra con una nota breve recordando ` +
      `que no es un diagnostico. Mantente en un maximo aproximado de ` +
      `650 palabras.`,
    maxOutputTokens: OUTPUT_LIMITS.dreamInterpretation,
  });
}

async function obtenerRespuestaChat(
    apiKey,
    mensajeUsuario,
    contextoPerfil = "",
    contextoConversacion = "",
) {
  const input = [
    "Esta es la unica ampliacion permitida dentro de la interpretacion " +
      "del sueno. Responde a la duda o al nuevo detalle del usuario, " +
      "integra lo ya dicho y cierra sin invitar a mantener un chat abierto. " +
      "Mantente en un maximo aproximado de 350 palabras.",
    contextoPerfil ? `Contexto del perfil:\n${contextoPerfil}` : "",
    contextoConversacion ?
      `Contexto previo de la conversacion:\n${contextoConversacion}` :
      "",
    `Mensaje del usuario:\n${mensajeUsuario}`,
  ].filter(Boolean).join("\n\n");

  return createTextResponse(apiKey, {
    model: MODEL_DEEP,
    reasoningEffort: REASONING_LOW,
    input,
    maxOutputTokens: OUTPUT_LIMITS.dreamFollowUp,
  });
}

async function obtenerResumenInterpretacion(apiKey, interpretacionCompleta) {
  const text = await createTextResponse(apiKey, {
    model: MODEL_FAST,
    reasoningEffort: REASONING_NONE,
    instructions:
      "Resume interpretaciones de suenos en titulos breves, claros y no " +
      "clinicos. Responde solo el titulo, sin comillas.",
    input:
      "Resume la siguiente interpretacion del sueno en una sola linea, " +
      "como un titulo atractivo y representativo:\n\n" +
      interpretacionCompleta,
    maxOutputTokens: OUTPUT_LIMITS.interpretationSummary,
  });

  return text.replace(/^["']|["']$/g, "").trim();
}

function parseJsonArray(text) {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];

    try {
      const parsed = JSON.parse(match[0]);
      return Array.isArray(parsed) ? parsed : [];
    } catch (nestedError) {
      return [];
    }
  }
}

async function obtenerEmocionesDesdeContexto(
    apiKey,
    descripcion,
    contextoPerfil,
) {
  const prompt = `
Usando la siguiente descripcion de un sueno y el contexto emocional del usuario,
identifica las emociones predominantes experimentadas por la persona.
Devuelve unicamente un array JSON valido con un maximo de 5 emociones
principales, en minusculas y de una sola palabra cada una.

Ejemplo: ["miedo", "tristeza", "esperanza", "culpa"]

Contexto del perfil:
${contextoPerfil}

Descripcion del sueno:
${descripcion}
  `.trim();

  const respuesta = await createTextResponse(apiKey, {
    model: MODEL_FAST,
    reasoningEffort: REASONING_NONE,
    instructions:
      "Identifica emociones predominantes y responde solo un array JSON " +
      "valido.",
    input: prompt,
    maxOutputTokens: OUTPUT_LIMITS.dreamEmotions,
  });

  return parseJsonArray(respuesta)
      .map((emocion) => String(emocion).trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 5);
}

async function obtenerPatronEmocional(apiKey, suenos, periodo = "") {
  const prompt =
    "Analiza los siguientes registros de suenos y encuentra patrones " +
    "emocionales comunes. No lo presentes como diagnostico. Distingue entre " +
    "evidencias observadas, hipotesis posibles, cambios a lo largo del " +
    "periodo y preguntas de reflexion. Cita ejemplos concretos por fecha o " +
    "resumen para que el usuario pueda revisar la evidencia. Da mas peso a " +
    "emociones, asociaciones y reflexiones confirmadas por el usuario que a " +
    "inferencias automaticas. No afirmes patrones de comportamiento si los " +
    "registros solo permiten observar emociones o temas. Si los datos son pocos, dilo con " +
    "claridad y baja la confianza de la lectura. Mantente en un maximo " +
    "aproximado de 900 palabras.\n\n" +
    (periodo ? `Periodo analizado: ${periodo}\n\n` : "") +
    `${suenos.join("\n\n---\n\n")}`;

  return createTextResponse(apiKey, {
    model: MODEL_DEEP,
    reasoningEffort: REASONING_LOW,
    input: prompt,
    maxOutputTokens: OUTPUT_LIMITS.monthlyPattern,
  });
}

async function obtenerReflexionDiaria(apiKey) {
  const prompt = `
Genera un dato cientifico breve sobre la mente, los suenos, las emociones o la
psicologia. Debe ser real, prudente, no clinico y en una sola oracion para una
notificacion.
  `.trim();

  return createTextResponse(apiKey, {
    model: MODEL_FAST,
    reasoningEffort: REASONING_NONE,
    instructions:
      "Escribe notificaciones breves, reales y prudentes sobre psicologia. " +
      "Usa una sola oracion de maximo 24 palabras.",
    input: prompt,
    maxOutputTokens: OUTPUT_LIMITS.dailyReflection,
  });
}

module.exports = {
  obtenerInterpretacionSueno,
  obtenerRespuestaChat,
  obtenerResumenInterpretacion,
  obtenerEmocionesDesdeContexto,
  obtenerPatronEmocional,
  obtenerReflexionDiaria,
};
