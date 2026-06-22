/* eslint-disable require-jsdoc */
const axios = require("axios");

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MODEL_DEEP = process.env.OPENAI_MODEL_DEEP || "gpt-5.5";
const MODEL_FAST = process.env.OPENAI_MODEL_FAST || "gpt-5.4-mini";

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
    input:
      `Explora este sueno como una lectura orientativa.\n\n` +
      `Sueno:\n${descripcion}\n\n` +
      `${contextoPerfil}\n\n` +
      `Devuelve una respuesta clara con estas secciones:\n` +
      `## Lectura orientativa\n` +
      `## Emociones posibles\n` +
      `## Simbolos o escenas relevantes\n` +
      `## Relacion con tu momento personal\n` +
      `## Preguntas para reflexionar\n\n` +
      `No afirmes que el sueno significa una sola cosa. Si falta contexto ` +
      `personal, indicalo brevemente. Cierra con una nota breve recordando ` +
      `que no es un diagnostico.`,
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
      "integra lo ya dicho y cierra sin invitar a mantener un chat abierto.",
    contextoPerfil ? `Contexto del perfil:\n${contextoPerfil}` : "",
    contextoConversacion ?
      `Contexto previo de la conversacion:\n${contextoConversacion}` :
      "",
    `Mensaje del usuario:\n${mensajeUsuario}`,
  ].filter(Boolean).join("\n\n");

  return createTextResponse(apiKey, {
    model: MODEL_DEEP,
    input,
  });
}

async function obtenerResumenInterpretacion(apiKey, interpretacionCompleta) {
  const text = await createTextResponse(apiKey, {
    model: MODEL_FAST,
    instructions:
      "Resume interpretaciones de suenos en titulos breves, claros y no " +
      "clinicos. Responde solo el titulo, sin comillas.",
    input:
      "Resume la siguiente interpretacion del sueno en una sola linea, " +
      "como un titulo atractivo y representativo:\n\n" +
      interpretacionCompleta,
    maxOutputTokens: 80,
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
    instructions:
      "Identifica emociones predominantes y responde solo un array JSON " +
      "valido.",
    input: prompt,
    maxOutputTokens: 120,
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
    "periodo y preguntas de reflexion. Si los datos son pocos, dilo con " +
    "claridad y baja la confianza de la lectura.\n\n" +
    (periodo ? `Periodo analizado: ${periodo}\n\n` : "") +
    `${suenos.join("\n\n---\n\n")}`;

  return createTextResponse(apiKey, {
    model: MODEL_DEEP,
    input: prompt,
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
    instructions:
      "Escribe notificaciones breves, reales y prudentes sobre psicologia.",
    input: prompt,
    maxOutputTokens: 100,
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
