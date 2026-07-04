/* eslint-disable require-jsdoc */
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {defineSecret} = require("firebase-functions/params");
const admin = require("firebase-admin");
const axios = require("axios");

const {
  obtenerEmocionesDesdeContexto,
  obtenerInterpretacionSueno,
  obtenerPatronEmocional,
  obtenerReflexionDiaria,
  obtenerRespuestaChat,
  obtenerResumenInterpretacion,
} = require("./openai");

const REGION = "europe-west1";
const PROJECT_ID = "post-it-72f0b";
const ANONYMOUS_ACCOUNT_TTL_DAYS = 30;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const openaiApiKey = defineSecret("OPENAI_API_KEY");

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: PROJECT_ID,
});

function requireAuth(request) {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError(
        "unauthenticated",
        "Debes iniciar sesión para usar esta función.",
    );
  }
}

function readString(data, key, options = {}) {
  const {required = false, maxLength = 12000} = options;
  const value = data ? data[key] : undefined;

  if (required && typeof value !== "string") {
    throw new HttpsError(
        "invalid-argument",
        `El campo ${key} es obligatorio.`,
    );
  }

  if (value === undefined || value === null) return "";

  if (typeof value !== "string") {
    throw new HttpsError(
        "invalid-argument",
        `El campo ${key} debe ser texto.`,
    );
  }

  const trimmed = value.trim();
  if (required && !trimmed) {
    throw new HttpsError(
        "invalid-argument",
        `El campo ${key} no puede estar vacío.`,
    );
  }

  if (trimmed.length > maxLength) {
    throw new HttpsError(
        "invalid-argument",
        `El campo ${key} es demasiado largo.`,
    );
  }

  return trimmed;
}

function readStringArray(data, key, options = {}) {
  const {required = false, maxItems = 20, maxItemLength = 6000} = options;
  const value = data ? data[key] : undefined;

  if (required && !Array.isArray(value)) {
    throw new HttpsError(
        "invalid-argument",
        `El campo ${key} debe ser una lista.`,
    );
  }

  if (!value) return [];

  if (!Array.isArray(value) || value.length > maxItems) {
    throw new HttpsError(
        "invalid-argument",
        `El campo ${key} no tiene un formato válido.`,
    );
  }

  return value.map((item) => {
    if (typeof item !== "string" || item.length > maxItemLength) {
      throw new HttpsError(
          "invalid-argument",
          `Cada elemento de ${key} debe ser texto válido.`,
      );
    }
    return item.trim();
  }).filter(Boolean);
}

function getSignInProvider(authToken) {
  return authToken?.firebase?.sign_in_provider || "";
}

function isAnonymousAuthToken(authToken) {
  return getSignInProvider(authToken) === "anonymous";
}

function isAnonymousUserRecord(userRecord) {
  return Array.isArray(userRecord.providerData) &&
    userRecord.providerData.length === 0;
}

function getConfiguredStorageBucketName() {
  try {
    const firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG || "{}");
    return firebaseConfig.storageBucket || "";
  } catch (error) {
    console.warn("No se pudo leer FIREBASE_CONFIG:", error);
    return "";
  }
}

function isNotFoundStorageError(error) {
  const message = error?.message || "";
  return error?.code === 404 ||
    error?.code === "storage/bucket-not-found" ||
    message.includes("Bucket name not specified") ||
    message.includes("No such object") ||
    message.includes("Not Found") ||
    message.includes("not found");
}

async function touchUserActivity(uid, authToken) {
  await admin.firestore()
      .collection("users")
      .doc(uid)
      .set(
          {
            isAnonymous: isAnonymousAuthToken(authToken),
            lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          {merge: true},
      );
}

async function deleteUserFirestoreTree(uid) {
  const userRef = admin.firestore().collection("users").doc(uid);
  await admin.firestore().recursiveDelete(userRef);
}

async function deleteUserStorageFiles(uid) {
  const bucketName = getConfiguredStorageBucketName();
  let bucket;

  try {
    bucket = bucketName ?
      admin.storage().bucket(bucketName) :
      admin.storage().bucket();

    await bucket.deleteFiles({prefix: `users/${uid}/`});
  } catch (error) {
    if (isNotFoundStorageError(error)) {
      console.warn(`No hay bucket/archivos de Storage para ${uid}.`);
      return;
    }

    throw error;
  }
}

async function deleteAuthUser(uid) {
  try {
    await admin.auth().deleteUser(uid);
  } catch (error) {
    if (error?.code === "auth/user-not-found") return;
    throw error;
  }
}

async function deleteAnonymousAccount(uid) {
  await deleteUserFirestoreTree(uid);
  await deleteUserStorageFiles(uid);
  await deleteAuthUser(uid);
}

function getUserMetadataTime(userRecord) {
  const rawTime = userRecord.metadata.lastSignInTime ||
    userRecord.metadata.creationTime ||
    "";
  const time = Date.parse(rawTime);

  return Number.isFinite(time) ? time : null;
}

function getTimestampMillis(timestamp) {
  if (!timestamp) return null;
  if (typeof timestamp.toMillis === "function") return timestamp.toMillis();
  if (typeof timestamp === "number") return timestamp;
  return null;
}

async function isStaleAnonymousUser(userRecord, cutoffMs) {
  if (!isAnonymousUserRecord(userRecord)) return false;

  const authTime = getUserMetadataTime(userRecord);
  if (authTime && authTime >= cutoffMs) return false;

  const userSnapshot = await admin.firestore()
      .collection("users")
      .doc(userRecord.uid)
      .get();
  const lastSeenAt = getTimestampMillis(userSnapshot.get("lastSeenAt"));

  return !lastSeenAt || lastSeenAt < cutoffMs;
}

const getDreamSessionRef = (uid, dreamSessionId) =>
  admin.firestore()
      .collection("users")
      .doc(uid)
      .collection("dreamSessions")
      .doc(dreamSessionId);

async function registerDreamSession(uid, dreamSessionId) {
  if (!dreamSessionId) return;

  await getDreamSessionRef(uid, dreamSessionId).set(
      {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        followUpUsed: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true},
  );
}

async function claimDreamFollowUp(uid, dreamSessionId) {
  if (!dreamSessionId) {
    throw new HttpsError(
        "invalid-argument",
        "Falta el identificador de la interpretacion.",
    );
  }

  const sessionRef = getDreamSessionRef(uid, dreamSessionId);

  await admin.firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(sessionRef);

    if (!snapshot.exists) {
      throw new HttpsError(
          "failed-precondition",
          "Primero debes iniciar una interpretacion.",
      );
    }

    const sessionData = snapshot.data();
    if (sessionData && sessionData.followUpUsed) {
      throw new HttpsError(
          "resource-exhausted",
          "Esta interpretacion ya uso su ampliacion.",
      );
    }

    transaction.set(
        sessionRef,
        {
          followUpUsed: true,
          followUpUsedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true},
    );
  });
}

async function releaseDreamFollowUp(uid, dreamSessionId) {
  await getDreamSessionRef(uid, dreamSessionId).set(
      {
        followUpUsed: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true},
  );
}

function aiFunction(handler) {
  return onCall(
      {
        region: REGION,
        secrets: [openaiApiKey],
        timeoutSeconds: 120,
      },
      async (request) => {
        requireAuth(request);
        await touchUserActivity(
            request.auth.uid,
            request.auth.token,
        ).catch((error) => {
          console.error("Error registrando actividad de usuario:", error);
        });

        try {
          return await handler(
              request.data || {},
              openaiApiKey.value(),
              request.auth.uid,
          );
        } catch (error) {
          if (error instanceof HttpsError) {
            throw error;
          }

          console.error("Error en función de IA:", error);
          throw new HttpsError(
              "internal",
              "No se pudo procesar la solicitud en este momento.",
          );
        }
      },
  );
}

exports.deleteAnonymousUserData = onCall(
    {
      region: REGION,
      timeoutSeconds: 120,
    },
    async (request) => {
      requireAuth(request);

      const userRecord = await admin.auth().getUser(request.auth.uid);
      const isAnonymous = isAnonymousAuthToken(request.auth.token) ||
        isAnonymousUserRecord(userRecord);

      if (!isAnonymous) {
        throw new HttpsError(
            "permission-denied",
            "Solo las cuentas invitadas pueden usar esta limpieza.",
        );
      }

      try {
        await deleteAnonymousAccount(request.auth.uid);
        return {deleted: true};
      } catch (error) {
        console.error("Error borrando cuenta invitada:", error);
        throw new HttpsError(
            "internal",
            "No se pudieron borrar los datos de la cuenta invitada.",
        );
      }
    },
);

exports.interpretDream = aiFunction(async (data, apiKey, uid) => {
  const descripcion = readString(data, "descripcion", {
    required: true,
    maxLength: 6000,
  });
  const contextoPerfil = readString(data, "contextoPerfil", {
    maxLength: 8000,
  });
  const dreamSessionId = readString(data, "dreamSessionId", {
    maxLength: 120,
  });

  const text = await obtenerInterpretacionSueno(
      apiKey,
      descripcion,
      contextoPerfil,
  );
  await registerDreamSession(uid, dreamSessionId);

  return {text};
});

exports.continueDreamChat = aiFunction(async (data, apiKey, uid) => {
  const mensajeUsuario = readString(data, "mensajeUsuario", {
    required: true,
    maxLength: 6000,
  });
  const contextoPerfil = readString(data, "contextoPerfil", {
    maxLength: 8000,
  });
  const contextoConversacion = readString(data, "contextoConversacion", {
    maxLength: 16000,
  });
  const dreamSessionId = readString(data, "dreamSessionId", {
    required: true,
    maxLength: 120,
  });

  await claimDreamFollowUp(uid, dreamSessionId);

  try {
    const text = await obtenerRespuestaChat(
        apiKey,
        mensajeUsuario,
        contextoPerfil,
        contextoConversacion,
    );
    return {text};
  } catch (error) {
    try {
      await releaseDreamFollowUp(uid, dreamSessionId);
    } catch (releaseError) {
      console.error("Error liberando ampliacion de sueno:", releaseError);
    }
    throw error;
  }
});

exports.summarizeInterpretation = aiFunction(async (data, apiKey) => {
  const interpretacionCompleta = readString(data, "interpretacionCompleta", {
    required: true,
    maxLength: 16000,
  });

  const text = await obtenerResumenInterpretacion(
      apiKey,
      interpretacionCompleta,
  );
  return {text};
});

exports.extractDreamEmotions = aiFunction(async (data, apiKey) => {
  const descripcion = readString(data, "descripcion", {
    required: true,
    maxLength: 6000,
  });
  const contextoPerfil = readString(data, "contextoPerfil", {
    maxLength: 8000,
  });

  const emociones = await obtenerEmocionesDesdeContexto(
      apiKey,
      descripcion,
      contextoPerfil,
  );
  return {emociones};
});

exports.findEmotionalPattern = aiFunction(async (data, apiKey) => {
  const suenos = readStringArray(data, "suenos", {
    required: true,
    maxItems: 45,
    maxItemLength: 2500,
  });
  const periodo = readString(data, "periodo", {
    maxLength: 120,
  });

  const text = await obtenerPatronEmocional(apiKey, suenos, periodo);
  return {text};
});

async function sendPushNotification(token, message) {
  const expoPushEndpoint = "https://exp.host/--/api/v2/push/send";
  const payload = {
    to: token,
    sound: "default",
    title: "Reflexión del Día",
    body: message,
  };

  try {
    const response = await axios.post(
        expoPushEndpoint,
        payload,
        {
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
          },
        },
    );
    console.log("Notificación enviada:", response.data);
  } catch (error) {
    console.error("Error al enviar la notificación:", error);
  }
}

exports.dailyReflection = onSchedule(
    {
      schedule: "every 24 hours",
      timeZone: "UTC",
      region: REGION,
      secrets: [openaiApiKey],
    },
    async () => {
      let reflectionMessage;

      try {
        reflectionMessage = await obtenerReflexionDiaria(openaiApiKey.value());
      } catch (error) {
        console.error("Error al obtener la reflexión:", error);
        reflectionMessage =
          "Tómate un momento para observar cómo te sientes hoy.";
      }

      try {
        const usersSnapshot = await admin.firestore()
            .collection("users")
            .get();
        const sendNotifications = usersSnapshot.docs.map(async (doc) => {
          const data = doc.data();
          if (data.fcmToken) {
            return sendPushNotification(data.fcmToken, reflectionMessage);
          }

          console.log(`No hay token para el usuario ${doc.id}`);
          return null;
        });

        await Promise.all(sendNotifications);
        console.log("Notificaciones enviadas exitosamente.");
      } catch (error) {
        console.error("Error al enviar notificaciones:", error);
      }

      return null;
    },
);

exports.cleanupStaleAnonymousUsers = onSchedule(
    {
      schedule: "every 24 hours",
      timeZone: "UTC",
      region: REGION,
      timeoutSeconds: 540,
    },
    async () => {
      const cutoffMs = Date.now() -
        (ANONYMOUS_ACCOUNT_TTL_DAYS * DAY_IN_MS);
      let pageToken;
      let deletedCount = 0;

      do {
        const result = await admin.auth().listUsers(1000, pageToken);
        pageToken = result.pageToken;

        for (const userRecord of result.users) {
          try {
            const shouldDelete = await isStaleAnonymousUser(
                userRecord,
                cutoffMs,
            );

            if (!shouldDelete) continue;

            await deleteAnonymousAccount(userRecord.uid);
            deletedCount += 1;
          } catch (error) {
            console.error(
                `Error limpiando invitado ${userRecord.uid}:`,
                error,
            );
          }
        }
      } while (pageToken);

      console.log(
          `Cuentas invitadas antiguas borradas: ${deletedCount}.`,
      );

      return null;
    },
);
